const mongoose = require("mongoose");

const storeUsageSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    billingCycleStart: {
      type: Date,
      required: true,
    },
    billingCycleEnd: {
      type: Date,
      required: true,
    },
    ordersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Orders beyond includedOrders quota (SUBSCRIPTION only)
    extraOrders: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Accumulated charge for this cycle (does NOT include monthly base fee)
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// One usage record per tenant per billing cycle
storeUsageSchema.index({ tenantId: 1, billingCycleStart: 1 }, { unique: true });

module.exports = mongoose.model("StoreUsage", storeUsageSchema);
