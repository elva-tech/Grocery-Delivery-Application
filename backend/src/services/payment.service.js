const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../models/Order.model");
const Vendor = require("../models/Vendor.model");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const DEFAULT_COMMISSION_PERCENT = parseFloat(
  process.env.PLATFORM_COMMISSION_PERCENT || "10"
);

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

  // Idempotency: return existing Razorpay order without creating a duplicate
  if (order.razorpayOrderId && order.razorpayOrderId !== "LOCKED") {
    const rzpOrder = await razorpay.orders.fetch(order.razorpayOrderId);
    console.log("createPayment: returning existing razorpay order", {
      orderId,
      razorpayOrderId: rzpOrder.id,
    });
    return {
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    };
  }

  // Race condition fix: atomic lock — only one request proceeds if razorpayOrderId is null
  const locked = await Order.findOneAndUpdate(
    { _id: orderId, razorpayOrderId: null },
    { $set: { razorpayOrderId: "LOCKED" } },
    { new: false }
  );

  if (!locked) {
    // Another request already claimed the lock; wait briefly then return existing
    await new Promise((resolve) => setTimeout(resolve, 500));
    const refreshed = await Order.findById(orderId);
    if (refreshed?.razorpayOrderId && refreshed.razorpayOrderId !== "LOCKED") {
      const rzpOrder = await razorpay.orders.fetch(refreshed.razorpayOrderId);
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
    const vendor = await Vendor.findOne({ tenantId: order.tenantId });

    const amountInPaise = Math.round(order.totalAmount * 100);

    const rzpOrderOptions = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${orderId}`.substring(0, 40),
      notes: {
        order_id: order._id.toString(),
      },
    };

    // Only add route transfer if vendor is onboarded with a linked Razorpay account
    if (vendor?.razorpayAccountId) {
      const commissionPercent = vendor.commissionPercent ?? DEFAULT_COMMISSION_PERCENT;
      const commissionAmount = Math.round((amountInPaise * commissionPercent) / 100);
      const vendorAmount = amountInPaise - commissionAmount;
      rzpOrderOptions.transfers = [
        {
          account: vendor.razorpayAccountId,
          amount: vendorAmount,
          currency: "INR",
          notes: { order_id: order._id.toString() },
          linked_account_notes: ["order_id"],
          on_hold: 0,
        },
      ];
    } else {
      console.warn("createPayment: vendor not onboarded, skipping transfer split", {
        tenantId: order.tenantId,
      });
    }

    const rzpOrder = await razorpay.orders.create(rzpOrderOptions);

    await Order.findByIdAndUpdate(orderId, { razorpayOrderId: rzpOrder.id });

    console.log("createPayment: razorpay order created", {
      orderId,
      razorpayOrderId: rzpOrder.id,
      amountInPaise,
    });

    return {
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    };
  } catch (err) {
    // Release lock so the order is not stuck if Razorpay call fails
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

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    await Order.findByIdAndUpdate(orderId, { paymentStatus: "FAILED" });
    return { success: false, message: "Signature verification failed" };
  }

  await Order.findByIdAndUpdate(orderId, {
    paymentStatus: "PAID",
    orderStatus: "CONFIRMED",
    razorpayPaymentId,
  });

  console.log("verifyPayment: payment verified", {
    orderId,
    razorpayOrderId,
    razorpayPaymentId,
    paymentStatus: "PAID",
  });

  return { success: true, message: "Payment verified successfully" };
}

module.exports = { createPayment, verifyPayment };
