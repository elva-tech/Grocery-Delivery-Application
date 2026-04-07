const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    description: {
      type: String,
      default: "",
    },

    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FLAT"],
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },

    minOrderValue: {
      type: Number,
      default: 0,
    },

    // Only used when discountType = PERCENTAGE — caps the discount amount
    maxDiscount: {
      type: Number,
      default: null,
    },

    // null = unlimited
    usageLimit: {
      type: Number,
      default: null,
    },

    usedCount: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    validFrom: {
      type: Date,
      required: true,
    },

    validTo: {
      type: Date,
      required: true,
    },

    firstTimeUserOnly: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Unique code per tenant (case-insensitive handled by always storing uppercase)
couponSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("Coupon", couponSchema);
