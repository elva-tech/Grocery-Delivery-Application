const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isMyAddress: {
      type: Boolean,
      default: true,
    },
    label: {
      type: String,
      default: "",
      trim: true,
    },
    line1: {
      type: String,
      required: true,
      trim: true,
    },
    line2: {
      type: String,
      default: "",
      trim: true,
    },
    landmark: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    altPhone: {
      type: String,
      default: "",
      trim: true,
    },
    recipientName: {
      type: String,
      default: "",
      trim: true,
    },
    recipientPhone: {
      type: String,
      default: "",
      trim: true,
    },
    full: {
      type: String,
      default: "",
      trim: true,
    },
    lat: {
      type: Number,
      default: 0,
    },
    lng: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

addressSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
addressSchema.index({ tenantId: 1, userId: 1, isMyAddress: 1, isActive: 1 });

module.exports = mongoose.model("Address", addressSchema);
