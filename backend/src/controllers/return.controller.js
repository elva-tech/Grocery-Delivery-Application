const ReturnRequest = require("../models/ReturnRequest.model");
const Order = require("../models/Order.model");
const tenantPolicy = require("../config/tenantPolicy");
const { initiateOrderRefund } = require("../services/orderRefund.service");

exports.createReturnRequest = async (req, res) => {
  try {
    const { orderId, reason, customerComment, comment } = req.body;
    const evidenceUrl =
      req.body.evidenceUrl ||
      (typeof req.body.evidenceImage === "string" &&
      req.body.evidenceImage.trim().startsWith("http")
        ? req.body.evidenceImage.trim()
        : null);

    if (!orderId || !reason) {
      return res.status(400).json({
        success: false,
        message: "orderId and reason are required",
      });
    }
    if (!evidenceUrl) {
      return res.status(400).json({
        success: false,
        message: "Product photo (evidenceUrl) is required",
      });
    }

    const evidenceCheck = tenantPolicy.validateEvidenceImageUrlStrict(evidenceUrl);
    if (!evidenceCheck.ok) {
      return res.status(400).json({
        success: false,
        message: evidenceCheck.message,
      });
    }

    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Tenant context is required",
      });
    }

    const order = await Order.findOne({ _id: orderId, tenantId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.userId.toString() !== String(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized order access",
      });
    }

    if (order.orderStatus !== "DELIVERED") {
      return res.status(400).json({
        success: false,
        message: "Returns are allowed only for delivered orders",
      });
    }

    const existingReturn = await ReturnRequest.findOne({ orderId });
    if (existingReturn) {
      return res.status(400).json({
        success: false,
        message: "Return request already exists for this order",
      });
    }

    const returnRequest = await ReturnRequest.create({
      orderId,
      userId: req.user.userId,
      reason,
      customerComment: customerComment ?? comment,
      evidenceImage: evidenceUrl,
      refundAmount: order.totalAmount,
    });

    await Order.findByIdAndUpdate(orderId, { orderStatus: "ISSUE_REPORTED" });

    res.status(201).json({
      success: true,
      data: returnRequest,
    });
  } catch (error) {
    console.error("createReturnRequest error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllReturns = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Tenant context is required",
      });
    }

    const returns = await ReturnRequest.find({})
      .populate({
        path: "orderId",
        match: { tenantId },
        select:
          "_id orderStatus totalAmount paymentMode paymentStatus items tenantId",
      })
      .populate("userId", "_id name email phoneNumber")
      .sort({ createdAt: -1 });

    const data = returns.filter((r) => r.orderId);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.approveReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNote, refundAmount: refundAmountRaw } = req.body;

    if (!resolutionNote || !String(resolutionNote).trim()) {
      return res.status(400).json({
        success: false,
        message: "Resolution note is required",
      });
    }

    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Tenant context is required",
      });
    }

    const request = await ReturnRequest.findById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Return request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Return request already processed",
      });
    }

    const order = await Order.findOne({
      _id: request.orderId,
      tenantId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const refundAmount =
      refundAmountRaw !== undefined && refundAmountRaw !== null
        ? Number(refundAmountRaw)
        : order.totalAmount;

    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Refund amount must be greater than zero",
      });
    }

    if (refundAmount > order.totalAmount + 0.01) {
      return res.status(400).json({
        success: false,
        message: "Refund amount cannot exceed order total",
      });
    }

    let refundResult = { skipped: true, reason: "cod_or_unpaid" };

    if (order.paymentMode === "ONLINE") {
      if (order.paymentStatus !== "PAID" && order.paymentStatus !== "REFUND_PENDING") {
        return res.status(400).json({
          success: false,
          message: "Online order is not in a refundable payment state",
        });
      }
      try {
        refundResult = await initiateOrderRefund(order, {
          reason: "return_approved",
          amount: refundAmount,
        });
      } catch (refundErr) {
        console.error("approveReturn Razorpay refund failed", {
          orderId: order._id,
          message: refundErr.message,
        });
        return res.status(refundErr.status || 502).json({
          success: false,
          message:
            refundErr.message ||
            "Payment refund failed. Customer was not charged back.",
        });
      }
    } else {
      await Order.findByIdAndUpdate(order._id, {
        refundAmount,
        refundStatus: refundAmount >= order.totalAmount - 0.01 ? "FULL" : "PARTIAL",
        paymentStatus: "REFUNDED",
        refundedAt: new Date(),
      });
    }

    request.status = "approved";
    request.resolutionNote = String(resolutionNote).trim();
    request.refundAmount = refundAmount;
    await request.save();

    await Order.findByIdAndUpdate(request.orderId, {
      orderStatus: "REFUND_APPROVED",
    });

    console.log({
      tenantId,
      orderId: order._id.toString(),
      returnRequestId: request._id.toString(),
      refundAmount,
      paymentStatus: order.paymentMode,
      razorpayRefundId: refundResult.refundId || null,
    });

    res.json({
      success: true,
      message: "Return approved and refund initiated",
      data: request,
      refund: refundResult,
    });
  } catch (error) {
    console.error("approveReturn error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.rejectReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNote } = req.body;

    if (!resolutionNote || !String(resolutionNote).trim()) {
      return res.status(400).json({
        success: false,
        message: "Resolution note is required",
      });
    }

    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Tenant context is required",
      });
    }

    const request = await ReturnRequest.findById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Return request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Return request already processed",
      });
    }

    const orderBelongsToTenant = await Order.exists({
      _id: request.orderId,
      tenantId,
    });

    if (!orderBelongsToTenant) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    request.status = "rejected";
    request.resolutionNote = String(resolutionNote).trim();
    await request.save();

    await Order.findByIdAndUpdate(request.orderId, {
      orderStatus: "REFUND_REJECTED",
    });

    res.json({
      success: true,
      message: "Return rejected",
      data: request,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
