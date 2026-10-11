const crypto = require("crypto");
const Order = require("../models/Order.model");
const Vendor = require("../models/Vendor.model");
const { notifyOrderPlacedSafe } = require("./notify.service");
const {
  placePaidOnlineOrder,
  cancelUnpaidOnlineOrder,
} = require("./onlineOrderPlacement.service");
const {
  getVendorRazorpayClient,
  getVendorKeySecret,
  assertVendorPaymentReady,
} = require("../utils/getVendorRazorpayClient");
const { resolvePaymentProvider } = require("../utils/paymentGateway.util");
const {
  createCashfreePayment,
  verifyCashfreePayment,
} = require("./cashfreePayment.service");

async function loadVendorForOrder(order) {
  const vendor = await Vendor.findOne({ tenantId: order.tenantId });
  assertVendorPaymentReady(vendor, order.tenantId);
  return vendor;
}

async function fetchExistingRazorpayOrder(vendor, razorpayOrderId) {
  const razorpay = getVendorRazorpayClient(vendor);
  return razorpay.orders.fetch(razorpayOrderId);
}

async function createRazorpayPayment(orderId, userId) {
  const order = await Order.findById(orderId);

  if (!order) {
    const err = new Error("Order not found");
    err.status = 404;
    throw err;
  }

  if (order.userId.toString() !== userId.toString()) {
    const err = new Error("Unauthorized");
    err.status = 403;
    throw err;
  }

  if (order.paymentStatus === "PAID") {
    const err = new Error("Order is already paid");
    err.status = 400;
    throw err;
  }

  const vendor = await loadVendorForOrder(order);

  if (order.razorpayOrderId && order.razorpayOrderId !== "LOCKED") {
    const rzpOrder = await fetchExistingRazorpayOrder(
      vendor,
      order.razorpayOrderId
    );
    console.log({
      tenantId: order.tenantId,
      orderId: order._id.toString(),
      razorpayOrderId: rzpOrder.id,
      paymentStatus: order.paymentStatus,
    });
    await Order.updateOne(
      { _id: orderId, paymentProvider: null },
      { $set: { paymentProvider: "RAZORPAY" } }
    );
    return {
      provider: "RAZORPAY",
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: vendor.razorpay.keyId,
    };
  }

  const locked = await Order.findOneAndUpdate(
    { _id: orderId, razorpayOrderId: null },
    { $set: { razorpayOrderId: "LOCKED", paymentProvider: "RAZORPAY" } },
    { new: false }
  );

  if (!locked) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const refreshed = await Order.findById(orderId);
    if (refreshed?.razorpayOrderId && refreshed.razorpayOrderId !== "LOCKED") {
      const rzpOrder = await fetchExistingRazorpayOrder(
        vendor,
        refreshed.razorpayOrderId
      );
      return {
        provider: "RAZORPAY",
        razorpay_order_id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        key_id: vendor.razorpay.keyId,
      };
    }
    const err = new Error("Payment initiation already in progress");
    err.status = 409;
    throw err;
  }

  try {
    const amountInPaise = Math.round(order.totalAmount * 100);
    const razorpay = getVendorRazorpayClient(vendor);

    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${orderId}`.substring(0, 40),
      notes: {
        tenantId: order.tenantId,
        orderId: order._id.toString(),
      },
    });

    await Order.findByIdAndUpdate(orderId, { razorpayOrderId: rzpOrder.id });

    console.log({
      tenantId: order.tenantId,
      orderId: order._id.toString(),
      razorpayOrderId: rzpOrder.id,
      paymentStatus: order.paymentStatus,
    });

    return {
      provider: "RAZORPAY",
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: vendor.razorpay.keyId,
    };
  } catch (err) {
    await Order.findByIdAndUpdate(orderId, { razorpayOrderId: null });
    throw err;
  }
}

async function createPayment(orderId, userId) {
  const order = await Order.findById(orderId);

  if (!order) {
    const err = new Error("Order not found");
    err.status = 404;
    throw err;
  }

  if (order.userId.toString() !== userId.toString()) {
    const err = new Error("Unauthorized");
    err.status = 403;
    throw err;
  }

  if (order.paymentStatus === "PAID") {
    const err = new Error("Order is already paid");
    err.status = 400;
    throw err;
  }

  if (order.orderStatus === "CANCELLED") {
    const err = new Error("This order is no longer payable");
    err.status = 400;
    throw err;
  }

  const provider = await resolvePaymentProvider(order);
  if (provider === "CASHFREE") {
    return createCashfreePayment(order);
  }
  if (provider === "RAZORPAY") {
    return createRazorpayPayment(orderId, userId);
  }

  const err = new Error("Payment gateway is not configured");
  err.status = 400;
  err.code = "PAYMENT_GATEWAY_NOT_CONFIGURED";
  throw err;
}

async function verifyRazorpayPayment({
  orderId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  order,
}) {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    const err = new Error("All payment fields are required");
    err.status = 400;
    throw err;
  }

  const vendor = await loadVendorForOrder(order);
  const keySecret = getVendorKeySecret(vendor);

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    await cancelUnpaidOnlineOrder(orderId);
    console.log({
      tenantId: order.tenantId,
      orderId: order._id.toString(),
      razorpayOrderId,
      paymentStatus: "FAILED",
    });
    return { success: false, message: "Signature verification failed" };
  }

  const updated = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $nin: ["PAID", "REFUNDED"] } },
    { paymentStatus: "PAID", razorpayPaymentId, paymentProvider: "RAZORPAY" },
    { new: true }
  );

  if (!updated) {
    const current = await Order.findById(orderId);
    if (current?.paymentStatus === "PAID") {
      return { success: true, message: "Payment verified successfully" };
    }
    return { success: false, message: "Unable to confirm payment for this order" };
  }

  const placed = await placePaidOnlineOrder(updated);

  console.log({
    tenantId: updated.tenantId,
    orderId: updated._id.toString(),
    razorpayOrderId,
    paymentStatus: "PAID",
    orderStatus: placed?.orderStatus || updated.orderStatus,
  });

  void notifyOrderPlacedSafe(placed || updated);

  return { success: true, message: "Payment verified successfully" };
}

async function verifyPayment({
  orderId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  userId,
}) {
  const order = await Order.findById(orderId);

  if (!order) {
    const err = new Error("Order not found");
    err.status = 404;
    throw err;
  }

  if (order.userId.toString() !== userId.toString()) {
    const err = new Error("Unauthorized");
    err.status = 403;
    throw err;
  }

  const provider = await resolvePaymentProvider(order);
  if (provider === "CASHFREE") {
    return verifyCashfreePayment(order);
  }
  if (provider === "RAZORPAY") {
    return verifyRazorpayPayment({
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      order,
    });
  }

  const err = new Error("Payment gateway is not configured");
  err.status = 400;
  err.code = "PAYMENT_GATEWAY_NOT_CONFIGURED";
  throw err;
}

module.exports = { createPayment, verifyPayment };
