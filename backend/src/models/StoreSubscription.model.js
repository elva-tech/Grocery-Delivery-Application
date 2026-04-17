const mongoose = require("mongoose");

const storeSubscriptionSchema = new mongoose.Schema(
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
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    billingCycleStart: {
      type: Date,
      required: true,
    },
    billingCycleEnd: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED"],
      default: "ACTIVE",
    },
    // If set, this plan takes effect from the next billing cycle
    nextPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      default: null,
    },
  },
  { timestamps: true }
);

storeSubscriptionSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model("StoreSubscription", storeSubscriptionSchema);
