const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deliveryCharge: {
      type: Number,
      default: 40,
      min: 0,
    },
    freeDeliveryAbove: {
      type: Number,
      default: 500,
      min: 0,
    },
    discountType: {
      type: String,
      enum: ["NONE", "PERCENTAGE", "FLAT"],
      default: "NONE",
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    thresholdDistance: {
      type: Number,
      default: 10,
      min: 0,
    },
    allowRefunds: { type: Boolean, default: true },
    allowReportIssue: { type: Boolean, default: true },
    allowOrderCancellation: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
