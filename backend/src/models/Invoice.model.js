const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    billingCycleStart: {
      type: Date,
      required: true,
    },
    billingCycleEnd: {
      type: Date,
      required: true,
    },
    // Monthly subscription fee (populated on billing generation)
    baseAmount: {
      type: Number,
      default: 0,
    },
    // Sum of per-extra-order charges (SUBSCRIPTION plans)
    extraCharges: {
      type: Number,
      default: 0,
    },
    // Sum of per-order charges (PER_ORDER plans)
    perOrderCharges: {
      type: Number,
      default: 0,
    },
    // baseAmount + extraCharges + perOrderCharges
    totalAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["PENDING", "PAID"],
      default: "PENDING",
    },
    paidAt:    { type: Date,   default: null },
    paymentId: { type: String, default: null },
    // Full plan object snapshot at time of invoice generation
    planSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

// One invoice per tenant per billing cycle
invoiceSchema.index({ tenantId: 1, billingCycleStart: 1 }, { unique: true });

module.exports = mongoose.model("Invoice", invoiceSchema);
