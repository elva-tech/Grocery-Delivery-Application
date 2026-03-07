const mongoose = require("mongoose");

const returnRequestSchema = new mongoose.Schema(
{
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  reason: {
    type: String,
    required: true,
  },

  customerComment: {
    type: String,
  },

  evidenceImage: {
    type: String,
  },

  refundAmount: {
    type: Number,
    required: true,
  },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },

  resolutionNote: {
    type: String,
  }

},
{ timestamps: true }
);

module.exports = mongoose.model("ReturnRequest", returnRequestSchema);