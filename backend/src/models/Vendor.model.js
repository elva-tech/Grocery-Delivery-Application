const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    razorpayAccountId: {
      type: String,
      default: null,
    },
    commissionPercent: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vendor", vendorSchema);
