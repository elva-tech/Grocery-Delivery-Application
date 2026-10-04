const Order = require("../models/Order.model");
const { createPayment, verifyPayment } = require("../services/payment.service");
const { cancelUnpaidOnlineOrder } = require("../services/onlineOrderPlacement.service");
const { customerPaymentErrorMessage } = require("../utils/customerFacingErrors.util");

exports.initiatePayment = async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ message: "order_id is required" });
    }

    const result = await createPayment(order_id, req.user.userId);
    return res.status(200).json(result);
  } catch (err) {
    console.error("initiatePayment error:", err.message, err.cause?.message || "");
    const status = err.status || 500;
    const message = customerPaymentErrorMessage(err);
    return res.status(status).json({ message });
  }
};

exports.abandonPayment = async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) {
      return res.status(400).json({ message: "order_id is required" });
    }

    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.userId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    if (req.user.tenantId && order.tenantId !== req.user.tenantId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const cancelled = await cancelUnpaidOnlineOrder(order._id);
    return res.status(200).json({ success: true, cancelled: Boolean(cancelled) });
  } catch (err) {
    console.error("abandonPayment error:", err.message);
    return res.status(500).json({ message: "Unable to cancel unpaid order" });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const {
      order_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!order_id) {
      return res.status(400).json({ message: "order_id is required" });
    }

    const result = await verifyPayment({
      orderId: order_id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      userId: req.user.userId,
    });

    const statusCode = result.success || result.status === "PENDING" ? 200 : 400;
    return res.status(statusCode).json(result);
  } catch (err) {
    console.error("verifyPayment error:", err.message);
    const status = err.status || 500;
    return res.status(status).json({ message: customerPaymentErrorMessage(err) });
  }
};
