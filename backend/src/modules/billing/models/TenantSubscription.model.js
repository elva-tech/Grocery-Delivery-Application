const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const tenantSubscriptionSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    tenant_id: { type: String, required: true, index: true },
    store_id: { type: String, required: true, index: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    subscription_unique_key: {
      type: String,
      required: true,
      unique: true,
    },
    plan_id: { type: String, ref: "PaymentPlan", required: true },
    plan_snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    subscription_status: {
      type: String,
      enum: ["ACTIVE", "PENDING", "SUSPENDED", "EXPIRED"],
      default: "ACTIVE",
    },
    billing_start_date: { type: Date, required: true },
    billing_end_date: { type: Date, required: true },
    next_billing_date: { type: Date, required: true },
    due_date: { type: Date, default: null },
    subscribed_at: { type: Date, default: Date.now },
    cancellation_date: { type: Date, default: null },
    next_plan_id: { type: String, ref: "PaymentPlan", default: null },
    prorated_base_amount: { type: Number, default: 0 },
    prepaid_amount: { type: Number, default: 0 },
    prorated_amount: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "tenant_subscriptions",
  }
);

tenantSubscriptionSchema.index({ tenant_id: 1, store_id: 1, subscription_status: 1 });

module.exports = mongoose.model("TenantSubscription", tenantSubscriptionSchema);
