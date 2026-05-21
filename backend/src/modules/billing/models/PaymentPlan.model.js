const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const paymentPlanSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    plan_code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    pricing_model: {
      type: String,
      enum: ["PER_ORDER", "SUBSCRIPTION", "ENTERPRISE"],
      required: true,
    },
    monthly_price: { type: Number, default: 0, min: 0 },
    included_orders: { type: Number, default: null },
    price_per_order: { type: Number, default: 0, min: 0 },
    price_per_extra_order: { type: Number, default: 0, min: 0 },
    is_custom_plan: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
    created_by: { type: String, default: "SYSTEM" },
    updated_by: { type: String, default: "SYSTEM" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "payment_plans",
  }
);

paymentPlanSchema.index({ is_active: 1, pricing_model: 1 });

module.exports = mongoose.model("PaymentPlan", paymentPlanSchema);
