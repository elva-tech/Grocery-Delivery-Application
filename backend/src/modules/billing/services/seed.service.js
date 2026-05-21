const PaymentPlan = require("../models/PaymentPlan.model");

const DEFAULT_PLANS = [
  {
    plan_code: "FREE",
    name: "Free Plan",
    description: "Pay per order — no monthly fee",
    pricing_model: "PER_ORDER",
    monthly_price: 0,
    included_orders: null,
    price_per_order: 7,
    price_per_extra_order: 0,
    is_custom_plan: false,
    is_active: true,
    created_by: "SYSTEM",
    updated_by: "SYSTEM",
  },
  {
    plan_code: "BASIC",
    name: "Basic Subscription",
    description: "Monthly subscription with included orders",
    pricing_model: "SUBSCRIPTION",
    monthly_price: 5000,
    included_orders: 1000,
    price_per_order: 0,
    price_per_extra_order: 5,
    is_custom_plan: false,
    is_active: true,
    created_by: "SYSTEM",
    updated_by: "SYSTEM",
  },
  {
    plan_code: "ENTERPRISE",
    name: "Enterprise Plan",
    description: "Custom pricing and features — configured per tenant",
    pricing_model: "ENTERPRISE",
    monthly_price: 0,
    included_orders: null,
    price_per_order: 0,
    price_per_extra_order: 0,
    is_custom_plan: true,
    is_active: true,
    created_by: "SYSTEM",
    updated_by: "SYSTEM",
  },
];

async function seedDefaultPlansIfEmpty() {
  const count = await PaymentPlan.countDocuments();
  if (count > 0) return { seeded: false, count };

  for (const plan of DEFAULT_PLANS) {
    await PaymentPlan.findOneAndUpdate({ plan_code: plan.plan_code }, plan, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }
  return { seeded: true, count: DEFAULT_PLANS.length };
}

async function getDefaultPlan() {
  let plan = await PaymentPlan.findOne({ plan_code: "FREE", is_active: true });
  if (!plan) {
    await seedDefaultPlansIfEmpty();
    plan = await PaymentPlan.findOne({ plan_code: "FREE", is_active: true });
  }
  return plan;
}

module.exports = { seedDefaultPlansIfEmpty, getDefaultPlan, DEFAULT_PLANS };
