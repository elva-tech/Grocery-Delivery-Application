const ReturnRequest = require("../models/ReturnRequest.model");
const Order = require("../models/Order.model");
const tenantPolicy = require("../config/tenantPolicy");

/* CREATE RETURN REQUEST (Customer) */

exports.createReturnRequest = async (req, res) => {
  try {

    const { orderId, reason, customerComment, comment } = req.body;
    // Primary: evidenceUrl (mobile / standard). Alias: evidenceImage when it is a URL string.
    const evidenceUrl =
      req.body.evidenceUrl ||
      (typeof req.body.evidenceImage === "string" && req.body.evidenceImage.trim().startsWith("http")
        ? req.body.evidenceImage.trim()
        : null);

    // Validation
    if (!orderId || !reason) {
      return res.status(400).json({
        success: false,
        message: "orderId and reason are required"
      });
    }
    if (!evidenceUrl) {
      return res.status(400).json({
        success: false,
        message: "evidenceUrl is required"
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
            message: "Order not found"
        });
    }

    // Ensure order belongs to the logged-in user
    // if (order.userId.toString() !== req.user.userId) {
    //     return res.status(403).json({
    //         success: false,
    //         message: "Unauthorized order access"
    //     });
    // }

    // Ensure order belongs to the logged-in user
    if (order.userId && req.user.userId && order.userId.toString() !== req.user.userId.toString()) {
        return res.status(403).json({
            success: false,
            message: "Unauthorized order access"
        });
        console.log("order.userId:", order.userId?.toString());
    console.log("req.user.userId:", req.user.userId);
    }
    
    // calculate refund amount from order
    const refundAmount = order.totalAmount;

    // Prevent duplicate return request
    const existingReturn = await ReturnRequest.findOne({ orderId });

    if (existingReturn) {
        return res.status(400).json({
            success: false,
            message: "Return request already exists for this order"
        });
    }

    const returnRequest = await ReturnRequest.create({
      orderId,
      userId: req.user.userId,
      reason,
      // Accept both legacy and new frontend key; persist in existing schema field
      customerComment: customerComment ?? comment,
      evidenceImage: evidenceUrl,
      refundAmount
    });

    res.status(201).json({
      success: true,
      data: returnRequest
    });

  } catch (error) {
    console.log(error);   // helps debugging
    res.status(500).json({
      message: error.message
    });
  }
};


/* GET ALL RETURN REQUESTS (ADMIN) */

exports.getAllReturns = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Tenant context is required",
      });
    }

    const returns = await ReturnRequest.find({ orderId: { $ne: null } })
      .populate({
        path: "orderId",
        match: { tenantId },
        select: "_id status totalAmount tenantId",
      })
      .populate("userId", "_id name email")
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


/* APPROVE RETURN */
exports.approveReturn = async (req, res) => {
  try {

    const { id } = req.params;
    const { resolutionNote, refundAmount } = req.body;

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
        message: "Return request not found"
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Return request already processed"
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

    request.status = "approved";
    request.resolutionNote = resolutionNote;

    // Default refund = order total
    request.refundAmount = order.totalAmount;

    // Allow admin to edit refund
    if (refundAmount !== undefined) {

      if (refundAmount > order.totalAmount) {
        return res.status(400).json({
          success: false,
          message: "Refund amount cannot exceed order total"
        });
      }

      request.refundAmount = refundAmount;
    }

    await request.save();

   await Order.findByIdAndUpdate(request.orderId, {
      orderStatus: "REFUND_APPROVED",
      adminNote: resolutionNote || "",
    });

    res.json({
      success: true,
      message: "Refund approved",
      data: request
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};


/* REJECT RETURN */
exports.rejectReturn = async (req, res) => {
  try {

    const { id } = req.params;
    const { resolutionNote } = req.body;

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
        message: "Return request not found"
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Return request already processed"
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
    request.resolutionNote = resolutionNote;
    await request.save();

    await Order.findByIdAndUpdate(request.orderId, {
      orderStatus: "REFUND_REJECTED",
      adminNote: resolutionNote || "",
    });

    res.json({
      success: true,
      message: "Return rejected",
      data: request
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};