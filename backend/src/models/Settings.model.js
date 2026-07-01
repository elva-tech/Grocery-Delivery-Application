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
      default: 0,
      min: 0,
    },
    expressDeliveryCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    expressDeliveryDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 240,
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
    /** Caps PERCENTAGE store discount (₹). 0 = no cap — same semantics as coupon maxDiscount. */
    maxDiscount: {
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
    /** BOTH | COD_ONLY | ONLINE_ONLY — which payment options customers see at checkout */
    customerPaymentMethods: {
      type: String,
      enum: ["BOTH", "COD_ONLY", "ONLINE_ONLY"],
      default: "BOTH",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
