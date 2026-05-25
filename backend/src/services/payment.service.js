const crypto = require("crypto");
const Order = require("../models/Order.model");
const Vendor = require("../models/Vendor.model");
const {
  getVendorRazorpayClient,
  getVendorKeySecret,
  assertVendorPaymentReady,
} = require("../utils/getVendorRazorpayClient");

async function loadVendorForOrder(order) {
  const vendor = await Vendor.findOne({ tenantId: order.tenantId });
  assertVendorPaymentReady(vendor, order.tenantId);
  return vendor;
}

async function fetchExistingRazorpayOrder(vendor, razorpayOrderId) {
  const razorpay = getVendorRazorpayClient(vendor);
  return razorpay.orders.fetch(razorpayOrderId);
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
    return {
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    };
  }

  const locked = await Order.findOneAndUpdate(
    { _id: orderId, razorpayOrderId: null },
    { $set: { razorpayOrderId: "LOCKED" } },
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
        razorpay_order_id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
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
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    };
  } catch (err) {
    await Order.findByIdAndUpdate(orderId, { razorpayOrderId: null });
    throw err;
  }
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

  const vendor = await loadVendorForOrder(order);
  const keySecret = getVendorKeySecret(vendor);

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    await Order.findByIdAndUpdate(orderId, { paymentStatus: "FAILED" });
    console.log({
      tenantId: order.tenantId,
      orderId: order._id.toString(),
      razorpayOrderId,
      paymentStatus: "FAILED",
    });
    return { success: false, message: "Signature verification failed" };
  }

  await Order.findByIdAndUpdate(orderId, {
    paymentStatus: "PAID",
    razorpayPaymentId,
  });

  console.log({
    tenantId: order.tenantId,
    orderId: order._id.toString(),
    razorpayOrderId,
    paymentStatus: "PAID",
  });

  return { success: true, message: "Payment verified successfully" };
}

module.exports = { createPayment, verifyPayment };
