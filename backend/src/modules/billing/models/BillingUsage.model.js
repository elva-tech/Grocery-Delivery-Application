const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const billingUsageSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    tenant_id: { type: String, required: true, index: true },
    store_id: { type: String, required: true, index: true },
    subscription_id: { type: String, ref: "TenantSubscription", required: true },
    billing_month: { type: Number, required: true, min: 1, max: 12 },
    billing_year: { type: Number, required: true },
    orders_used: { type: Number, default: 0, min: 0 },
    extra_orders: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, default: 0, min: 0 },
    extra_charges: { type: Number, default: 0, min: 0 },
    total_amount: { type: Number, default: 0, min: 0 },
    per_order_charges: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "billing_usage",
  }
);

billingUsageSchema.index(
  { tenant_id: 1, store_id: 1, billing_month: 1, billing_year: 1 },
  { unique: true }
);
billingUsageSchema.index({ subscription_id: 1 });

module.exports = mongoose.model("BillingUsage", billingUsageSchema);
