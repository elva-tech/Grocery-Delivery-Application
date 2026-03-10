const ReturnRequest = require("../models/ReturnRequest.model");
const Order = require("../models/Order.model");


/* CREATE RETURN REQUEST (Customer) */

exports.createReturnRequest = async (req, res) => {
  try {

    const { orderId, reason, customerComment, refundAmount } = req.body;

    // Validation
    if (!orderId || !reason || refundAmount === undefined) {
        return res.status(400).json({
            success: false,
            message: "orderId, reason and refundAmount are required"
        });
    }
    
    if (refundAmount < 0) {
        return res.status(400).json({
            success: false,
            message: "refundAmount cannot be negative"
        });
    }

    const order = await Order.findById(orderId);

    if (!order) {
        return res.status(404).json({
            success: false,
            message: "Order not found"
        });
    }

    // Ensure order belongs to the logged-in user
    if (order.userId.toString() !== req.user.userId) {
        return res.status(403).json({
            success: false,
            message: "Unauthorized order access"
        });
    }
    
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
      customerComment,
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

  const returns = await ReturnRequest.find()
  .populate("orderId", "_id status totalAmount")
  .populate("userId", "_id name email")
  .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: returns
  });

};


/* APPROVE RETURN */

exports.approveReturn = async (req, res) => {
  try {

    const { id } = req.params;
    const { resolutionNote } = req.body;

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

    request.status = "approved";
    request.resolutionNote = resolutionNote;

    await request.save();

    // Update Order Status
    await Order.findByIdAndUpdate(request.orderId, {
      status: "REFUNDED"
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

    request.status = "rejected";
    request.resolutionNote = resolutionNote;

    await request.save();

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