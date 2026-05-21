function buildPlanSnapshot(plan) {
  if (!plan) return null;
  const p = plan.toObject ? plan.toObject() : plan;
  return {
    id: p._id || p.id,
    plan_code: p.plan_code,
    name: p.name,
    description: p.description,
    pricing_model: p.pricing_model,
    monthly_price: p.monthly_price,
    included_orders: p.included_orders,
    price_per_order: p.price_per_order,
    price_per_extra_order: p.price_per_extra_order,
    is_custom_plan: p.is_custom_plan,
  };
}

module.exports = { buildPlanSnapshot };
