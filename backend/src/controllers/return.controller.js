const ReturnRequest = require("../models/ReturnRequest.model");
const Order = require("../models/Order.model");


/* CREATE RETURN REQUEST (Customer) */

exports.createReturnRequest = async (req, res) => {
  try {

    const { orderId, reason, customerComment, refundAmount } = req.body;

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
  .populate("orderId")
  .populate("userId")
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

    const request = await ReturnRequest.findByIdAndUpdate(
      id,
      {
        status: "approved",
        resolutionNote
      },
      { new: true }
    );

    if (!request) {
        return res.status(404).json({
            success: false,
            message: "Return request not found"
        });
    }

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

  const { id } = req.params;
  const { resolutionNote } = req.body;

  const request = await ReturnRequest.findByIdAndUpdate(
    id,
    {
      status: "rejected",
      resolutionNote
    },
    { new: true }
  );

  res.json({
    success: true,
    message: "Return rejected",
    data: request
  });

};