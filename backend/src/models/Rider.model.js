const mongoose = require("mongoose");

const riderSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },

    vehicle: {
      type: String,
      enum: ["Bike", "Scooter", "Electric Van"],
      required: true,
    },

    licenseNumber: {
      type: String,
      default: "",
      trim: true,
    },

    licenseExpiry: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["Online", "Offline", "On Rest", "Inactive"],
      default: "Offline",
      index: true,
    },

    activeOrders: {
      type: Number,
      default: 0,
      index: true,
    },

    totalDeliveries: {
      type: Number,
      default: 0,
    },

    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalEarnings: {
      type: Number,
      default: 0,
    },

    documentsVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastOnlineAt: {
      type: Date,
      default: null,
    },

    lastOfflineAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// 🔍 Indexes
riderSchema.index({ tenantId: 1, phoneNumber: 1 }, { unique: true });
riderSchema.index({ tenantId: 1, status: 1 });
riderSchema.index({ tenantId: 1, activeOrders: 1 });
riderSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model("Rider", riderSchema);
