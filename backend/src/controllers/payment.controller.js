const { createPayment, verifyPayment } = require("../services/payment.service");
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

exports.verifyPayment = async (req, res) => {
  try {
    const {
      order_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !order_id ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({ message: "All payment fields are required" });
    }

    const result = await verifyPayment({
      orderId: order_id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      userId: req.user.userId,
    });

    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error("verifyPayment error:", err);
    const status = err.status || 500;
    return res
      .status(status)
      .json({ message: err.message || "Payment verification failed" });
  }
};
