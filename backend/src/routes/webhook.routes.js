const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Order = require("../models/Order.model");
const Vendor = require("../models/Vendor.model");
const { applyRefundWebhook } = require("../services/orderRefund.service");
const { notifyOrderPlacedSafe } = require("../services/notify.service");
const { getVendorWebhookSecret } = require("../utils/getVendorRazorpayClient");

async function resolveTenantIdFromEvent(event) {
  const paymentEntity = event?.payload?.payment?.entity;
  const refundEntity = event?.payload?.refund?.entity;

  if (paymentEntity?.notes?.tenantId) {
    return paymentEntity.notes.tenantId;
  }

  if (refundEntity?.notes?.tenantId) {
    return refundEntity.notes.tenantId;
  }

  const orderId =
    paymentEntity?.notes?.orderId ||
    paymentEntity?.notes?.order_id ||
    refundEntity?.notes?.orderId ||
    refundEntity?.notes?.order_id;

  if (orderId) {
    const order = await Order.findById(orderId).select("tenantId").lean();
    return order?.tenantId || null;
  }

  const razorpayOrderId = paymentEntity?.order_id;
  if (razorpayOrderId) {
    const order = await Order.findOne({ razorpayOrderId })
      .select("tenantId")
      .lean();
    return order?.tenantId || null;
  }

  return null;
}

function resolveInternalOrderId(paymentEntity) {
  return (
    paymentEntity?.notes?.orderId || paymentEntity?.notes?.order_id || null
  );
}

router.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["x-razorpay-signature"];

    let event;
    try {
      event = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ message: "Invalid JSON payload" });
    }

    const tenantId = await resolveTenantIdFromEvent(event);
    if (!tenantId) {
      console.error("Webhook: missing tenantId in notes or order mapping");
      return res.status(400).json({ message: "Missing tenantId in webhook payload" });
    }

    const vendor = await Vendor.findOne({ tenantId });
    if (!vendor) {
      console.error("Webhook: vendor not found", { tenantId });
      return res.status(404).json({ message: "Vendor not found" });
    }

    let webhookSecret;
    try {
      webhookSecret = getVendorWebhookSecret(vendor);
    } catch (err) {
      console.error("Webhook: vendor secret unavailable", {
        tenantId,
        message: err.message,
      });
      return res.status(500).json({ message: "Vendor webhook secret not configured" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const eventName = event?.event;

    if (eventName && eventName.startsWith("refund.")) {
      const refundEntity = event?.payload?.refund?.entity;
      try {
        await applyRefundWebhook(refundEntity);
      } catch (err) {
        console.error("Webhook: refund handler failed", {
          tenantId,
          message: err.message,
        });
        return res.status(500).json({ message: "Internal error" });
      }
      return res.status(200).json({ received: true });
    }

    const paymentEntity = event?.payload?.payment?.entity;

    if (!paymentEntity) {
      return res.status(200).json({ received: true });
    }

    const razorpayPaymentId = paymentEntity.id;
    const razorpayOrderId = paymentEntity.order_id;
    const internalOrderId = resolveInternalOrderId(paymentEntity);

    const order = internalOrderId
      ? await Order.findById(internalOrderId)
      : await Order.findOne({ razorpayOrderId });

    if (!order) {
      console.error("Webhook: order not found", {
        tenantId,
        internalOrderId,
        razorpayOrderId,
      });
      return res.status(200).json({ received: true });
    }

    try {
      if (eventName === "payment.captured") {
        const updated = await Order.findOneAndUpdate(
          { _id: order._id, paymentStatus: { $nin: ["PAID", "REFUNDED"] } },
          { paymentStatus: "PAID", razorpayPaymentId },
          { new: true }
        );

        if (!updated) {
          console.log({
            tenantId: order.tenantId,
            orderId: order._id.toString(),
            razorpayOrderId,
            paymentStatus: order.paymentStatus,
          });
          return res.status(200).json({ received: true });
        }

        void notifyOrderPlacedSafe(updated);

        console.log({
          tenantId: updated.tenantId,
          orderId: updated._id.toString(),
          razorpayOrderId,
          paymentStatus: "PAID",
        });
      } else if (eventName === "payment.failed") {
        if (order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED") {
          console.log({
            tenantId: order.tenantId,
            orderId: order._id.toString(),
            razorpayOrderId,
            paymentStatus: order.paymentStatus,
          });
          return res.status(200).json({ received: true });
        }
        await Order.findByIdAndUpdate(order._id, {
          paymentStatus: "FAILED",
        });
        console.log({
          tenantId: order.tenantId,
          orderId: order._id.toString(),
          razorpayOrderId,
          paymentStatus: "FAILED",
        });
      }
    } catch (err) {
      console.error("Webhook: DB update failed", {
        tenantId,
        orderId: order._id.toString(),
        message: err.message,
      });
      return res.status(500).json({ message: "Internal error" });
    }

    return res.status(200).json({ received: true });
  }
);

module.exports = router;
