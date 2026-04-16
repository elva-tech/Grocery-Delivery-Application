const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    pricingType: {
      type: String,
      enum: ["PER_ORDER", "SUBSCRIPTION"],
      required: true,
    },
    monthlyPrice: {
      type: Number,
      default: 0,
    },
    // For SUBSCRIPTION: how many orders are included in the monthly fee
    includedOrders: {
      type: Number,
      default: null,
    },
    // Per-order charge for orders beyond the included quota (SUBSCRIPTION)
    pricePerExtraOrder: {
      type: Number,
      default: 0,
    },
    // Flat per-order charge (PER_ORDER plans)
    pricePerOrder: {
      type: Number,
      default: 0,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

planSchema.index({ isDefault: 1, isActive: 1 });

module.exports = mongoose.model("Plan", planSchema);
