const Order = require("../models/Order.model");
const Vendor = require("../models/Vendor.model");
const {
  getVendorRazorpayClient,
  assertVendorPaymentReady,
} = require("../utils/getVendorRazorpayClient");

function isRefundableOrder(order) {
  if (!order || order.paymentMode !== "ONLINE") return false;
  if (order.refundStatus === "FULL" || order.paymentStatus === "REFUNDED") return false;
  if (order.refundStatus === "FAILED") return true;
  return order.paymentStatus === "PAID" || order.paymentStatus === "REFUND_PENDING";
}

async function getVendorRazorpayForOrder(order) {
  const vendor = await Vendor.findOne({ tenantId: order.tenantId });
  assertVendorPaymentReady(vendor, order.tenantId);
  return getVendorRazorpayClient(vendor);
}

async function resolveRazorpayPaymentId(order) {
  if (order.razorpayPaymentId) return order.razorpayPaymentId;
  if (!order.razorpayOrderId || order.razorpayOrderId === "LOCKED") return null;

  try {
    const razorpay = await getVendorRazorpayForOrder(order);
    const payments = await razorpay.orders.fetchPayments(order.razorpayOrderId);
    const captured = (payments.items || []).find((p) => p.status === "captured");
    return captured?.id || null;
  } catch (err) {
    console.error("resolveRazorpayPaymentId failed", {
      orderId: order._id,
      tenantId: order.tenantId,
      message: err.message,
    });
    return null;
  }
}

function mapRefundToOrderFields(refund, order, requestedAmount) {
  const processed =
    refund.status === "processed" || refund.status === "completed";
  const refundedRupees =
    (refund.amount || Math.round((requestedAmount ?? order.totalAmount) * 100)) / 100;
  const isFullRefund = refundedRupees >= order.totalAmount - 0.01;
  return {
    razorpayRefundId: refund.id,
    razorpayPaymentId: refund.payment_id || order.razorpayPaymentId,
    refundStatus: processed ? (isFullRefund ? "FULL" : "PARTIAL") : "PENDING",
    paymentStatus: processed ? "REFUNDED" : "REFUND_PENDING",
    refundAmount: refundedRupees,
    refundedAt: processed ? new Date() : null,
    refundFailureReason: "",
  };
}

async function initiateOrderRefund(order, { reason = "order_cancelled", amount } = {}) {
  if (!isRefundableOrder(order)) {
    return {
      success: true,
      skipped: true,
      reason: "not_refundable",
    };
  }

  const refundRupees = Number(amount ?? order.totalAmount);
  if (!Number.isFinite(refundRupees) || refundRupees <= 0) {
    const err = new Error("Refund amount must be greater than zero");
    err.status = 400;
    throw err;
  }
  if (refundRupees > order.totalAmount + 0.01) {
    const err = new Error("Refund amount cannot exceed order total");
    err.status = 400;
    throw err;
  }

  const paymentId = await resolveRazorpayPaymentId(order);
  if (!paymentId) {
    await Order.findByIdAndUpdate(order._id, {
      refundStatus: "FAILED",
      refundFailureReason: "Razorpay payment ID not found",
    });
    const err = new Error("Cannot refund: payment not found for this order");
    err.status = 422;
    throw err;
  }

  const amountInPaise = Math.round(refundRupees * 100);

  try {
    const razorpay = await getVendorRazorpayForOrder(order);
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amountInPaise,
      notes: {
        tenantId: order.tenantId,
        orderId: order._id.toString(),
        reason,
      },
      speed: "normal",
    });

    const updates = mapRefundToOrderFields(refund, order, refundRupees);
    await Order.findByIdAndUpdate(order._id, {
      ...updates,
      razorpayPaymentId: paymentId,
    });

    console.log({
      tenantId: order.tenantId,
      orderId: order._id.toString(),
      razorpayOrderId: order.razorpayOrderId,
      paymentStatus: updates.paymentStatus,
    });

    return {
      success: true,
      skipped: false,
      refundId: refund.id,
      refundStatus: updates.refundStatus,
      paymentStatus: updates.paymentStatus,
      razorpayStatus: refund.status,
    };
  } catch (err) {
    const msg = (err.error?.description || err.message || "").toLowerCase();
    if (msg.includes("already been refunded") || msg.includes("already refunded")) {
      await Order.findByIdAndUpdate(order._id, {
        razorpayPaymentId: paymentId,
        refundStatus: "FULL",
        paymentStatus: "REFUNDED",
        refundedAt: new Date(),
        refundAmount: order.totalAmount,
        refundFailureReason: "",
      });
      return {
        success: true,
        skipped: false,
        alreadyRefunded: true,
        paymentStatus: "REFUNDED",
        refundStatus: "FULL",
      };
    }

    await Order.findByIdAndUpdate(order._id, {
      refundStatus: "FAILED",
      refundFailureReason: err.error?.description || err.message || "Refund failed",
    });

    console.error("initiateOrderRefund: failed", {
      tenantId: order.tenantId,
      orderId: order._id.toString(),
      message: err.message,
      description: err.error?.description,
    });

    throw err;
  }
}

async function applyRefundWebhook(refundEntity) {
  if (!refundEntity?.id) return { matched: false };

  const internalOrderId =
    refundEntity.notes?.orderId || refundEntity.notes?.order_id;

  let order =
    (internalOrderId && (await Order.findById(internalOrderId))) ||
    (refundEntity.payment_id &&
      (await Order.findOne({ razorpayPaymentId: refundEntity.payment_id }))) ||
    (await Order.findOne({ razorpayRefundId: refundEntity.id }));

  if (!order) {
    console.error("applyRefundWebhook: order not found", {
      refundId: refundEntity.id,
      paymentId: refundEntity.payment_id,
    });
    return { matched: false };
  }

  const processed =
    refundEntity.status === "processed" || refundEntity.status === "completed";
  const failed = refundEntity.status === "failed";

  const updates = {
    razorpayRefundId: refundEntity.id,
    razorpayPaymentId: refundEntity.payment_id || order.razorpayPaymentId,
    refundAmount: (refundEntity.amount || 0) / 100,
  };

  if (processed) {
    updates.refundStatus = "FULL";
    updates.paymentStatus = "REFUNDED";
    updates.refundedAt = new Date(refundEntity.created_at * 1000 || Date.now());
    updates.refundFailureReason = "";
  } else if (failed) {
    updates.refundStatus = "FAILED";
    updates.refundFailureReason =
      refundEntity.error_description || "Refund failed at payment gateway";
  } else {
    updates.refundStatus = "PENDING";
    updates.paymentStatus = "REFUND_PENDING";
  }

  await Order.findByIdAndUpdate(order._id, updates);

  console.log({
    tenantId: order.tenantId,
    orderId: order._id.toString(),
    razorpayOrderId: order.razorpayOrderId,
    paymentStatus: updates.paymentStatus,
  });

  return { matched: true, orderId: order._id, updates };
}

module.exports = {
  isRefundableOrder,
  initiateOrderRefund,
  applyRefundWebhook,
  resolveRazorpayPaymentId,
};
