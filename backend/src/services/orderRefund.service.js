const Razorpay = require("razorpay");
const Order = require("../models/Order.model");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

function isRefundableOrder(order) {
  if (!order || order.paymentMode !== "ONLINE") return false;
  if (order.refundStatus === "FULL" || order.paymentStatus === "REFUNDED") return false;
  if (order.refundStatus === "FAILED") return true;
  return order.paymentStatus === "PAID" || order.paymentStatus === "REFUND_PENDING";
}

async function resolveRazorpayPaymentId(order) {
  if (order.razorpayPaymentId) return order.razorpayPaymentId;
  if (!order.razorpayOrderId || order.razorpayOrderId === "LOCKED") return null;

  try {
    const payments = await razorpay.orders.fetchPayments(order.razorpayOrderId);
    const captured = (payments.items || []).find((p) => p.status === "captured");
    return captured?.id || null;
  } catch (err) {
    console.error("resolveRazorpayPaymentId failed", {
      orderId: order._id,
      message: err.message,
    });
    return null;
  }
}

function mapRefundToOrderFields(refund, order) {
  const processed =
    refund.status === "processed" || refund.status === "completed";
  return {
    razorpayRefundId: refund.id,
    razorpayPaymentId: refund.payment_id || order.razorpayPaymentId,
    refundStatus: processed ? "FULL" : "PENDING",
    paymentStatus: processed ? "REFUNDED" : "REFUND_PENDING",
    refundAmount: (refund.amount || Math.round(order.totalAmount * 100)) / 100,
    refundedAt: processed ? new Date() : null,
    refundFailureReason: "",
  };
}

/**
 * Initiate a full Razorpay refund for a paid online order.
 * Idempotent when refund is already FULL / REFUNDED.
 */
async function initiateOrderRefund(order, { reason = "order_cancelled" } = {}) {
  if (!isRefundableOrder(order)) {
    return {
      success: true,
      skipped: true,
      reason: "not_refundable",
    };
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

  const amountInPaise = Math.round(order.totalAmount * 100);

  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amountInPaise,
      notes: {
        order_id: order._id.toString(),
        reason,
      },
      speed: "normal",
    });

    const updates = mapRefundToOrderFields(refund, order);
    await Order.findByIdAndUpdate(order._id, {
      ...updates,
      razorpayPaymentId: paymentId,
    });

    console.log("initiateOrderRefund: success", {
      orderId: order._id,
      refundId: refund.id,
      refundStatus: refund.status,
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
      orderId: order._id,
      message: err.message,
      description: err.error?.description,
    });

    throw err;
  }
}

/** Apply Razorpay webhook refund entity to our order record. */
async function applyRefundWebhook(refundEntity) {
  if (!refundEntity?.id) return { matched: false };

  let order =
    (refundEntity.notes?.order_id &&
      (await Order.findById(refundEntity.notes.order_id))) ||
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
  return { matched: true, orderId: order._id, updates };
}

module.exports = {
  isRefundableOrder,
  initiateOrderRefund,
  applyRefundWebhook,
  resolveRazorpayPaymentId,
};
