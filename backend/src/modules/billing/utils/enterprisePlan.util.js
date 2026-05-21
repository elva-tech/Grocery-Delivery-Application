const PaymentPlan = require("../models/PaymentPlan.model");

function enterprisePlanCodeFor(tenantId) {
  return `ENT_${String(tenantId || "")
    .replace(/[^A-Z0-9]/gi, "_")
    .toUpperCase()
    .slice(0, 40)}`;
}

/**
 * ENTERPRISE plans are negotiated per tenant — derive billing behavior from stored fields.
 */
function resolveEffectivePricingModel(plan) {
  const model = plan?.pricing_model || plan?.pricingType;
  if (model !== "ENTERPRISE") return model;

  const monthly = Number(plan.monthly_price ?? plan.monthlyPrice) || 0;
  const included = Number(plan.included_orders ?? plan.includedOrders) || 0;
  const perOrder = Number(plan.price_per_order ?? plan.pricePerOrder) || 0;

  if (monthly > 0 || included > 0) return "SUBSCRIPTION";
  if (perOrder > 0) return "PER_ORDER";
  return "ENTERPRISE";
}

async function getEnterprisePlanForTenant(tenantId) {
  const code = enterprisePlanCodeFor(tenantId);
  return PaymentPlan.findOne({ plan_code: code }).lean();
}

async function getOrCreateEnterprisePlanForTenant(tenantId, storeName = "") {
  const code = enterprisePlanCodeFor(tenantId);
  let plan = await PaymentPlan.findOne({ plan_code: code });
  if (plan) return plan;

  const template = await PaymentPlan.findOne({ plan_code: "ENTERPRISE", is_custom_plan: false }).lean();

  plan = await PaymentPlan.create({
    plan_code: code,
    name: `Enterprise — ${storeName || tenantId}`,
    description:
      template?.description ||
      "Custom enterprise pricing for this store. Rates are set by the platform admin.",
    pricing_model: "ENTERPRISE",
    monthly_price: template?.monthly_price || 0,
    included_orders: template?.included_orders ?? null,
    price_per_order: template?.price_per_order || 0,
    price_per_extra_order: template?.price_per_extra_order || 0,
    is_custom_plan: true,
    is_active: true,
    created_by: "SUPER_ADMIN",
    updated_by: "SUPER_ADMIN",
  });
  return plan;
}

function tenantPlanVisibilityFilter(tenantId) {
  const entCode = enterprisePlanCodeFor(tenantId);
  return {
    is_active: true,
    $or: [{ is_custom_plan: { $ne: true } }, { plan_code: entCode }],
  };
}

module.exports = {
  enterprisePlanCodeFor,
  resolveEffectivePricingModel,
  getEnterprisePlanForTenant,
  getOrCreateEnterprisePlanForTenant,
  tenantPlanVisibilityFilter,
};
