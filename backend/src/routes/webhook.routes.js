const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Order = require("../models/Order.model");

// Must be registered BEFORE express.json() in app.js
// Uses express.raw() to preserve the raw body for signature verification
router.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET is not set");
      return res.status(500).json({ message: "Webhook secret not configured" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    let event;
    try {
      event = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ message: "Invalid JSON payload" });
    }

    const paymentEntity = event?.payload?.payment?.entity;

    if (!paymentEntity) {
      return res.status(200).json({ received: true });
    }

    const razorpayPaymentId = paymentEntity.id;
    const razorpayOrderId = paymentEntity.order_id;

    // Resolve order: prefer notes.order_id, fallback to razorpayOrderId field
    const internalOrderId = paymentEntity.notes?.order_id;
    const order = internalOrderId
      ? await Order.findById(internalOrderId)
      : await Order.findOne({ razorpayOrderId });

    if (!order) {
      console.error("Webhook: order not found", { internalOrderId, razorpayOrderId });
      return res.status(200).json({ received: true });
    }

    try {
      if (event.event === "payment.captured") {
        // Idempotency: skip if already PAID
        if (order.paymentStatus === "PAID") {
          console.log("Webhook: already PAID, skipping", { orderId: order._id, event: event.event });
          return res.status(200).json({ received: true });
        }
        await Order.findByIdAndUpdate(order._id, {
          paymentStatus: "PAID",
          orderStatus: "CONFIRMED",
          razorpayPaymentId,
        });
        console.log("Webhook: order marked PAID", {
          orderId: order._id,
          razorpayOrderId,
          razorpayPaymentId,
          event: event.event,
        });
      } else if (event.event === "payment.failed") {
        if (order.paymentStatus === "PAID") {
          console.log("Webhook: already PAID, ignoring failed event", { orderId: order._id });
          return res.status(200).json({ received: true });
        }
        await Order.findByIdAndUpdate(order._id, {
          paymentStatus: "FAILED",
        });
        console.log("Webhook: order marked FAILED", {
          orderId: order._id,
          razorpayOrderId,
          event: event.event,
        });
      }
    } catch (err) {
      console.error("Webhook: DB update failed", err);
      return res.status(500).json({ message: "Internal error" });
    }

    return res.status(200).json({ received: true });
  }
);

module.exports = router;

module.exports = router;
