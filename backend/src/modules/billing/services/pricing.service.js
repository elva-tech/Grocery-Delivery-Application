const { resolveEffectivePricingModel } = require("../utils/enterprisePlan.util");

/**
 * Dynamic pricing engine — reads plan fields only; no hardcoded plan names.
 * ENTERPRISE resolves to PER_ORDER or SUBSCRIPTION based on configured fields per tenant.
 * @param {Object} plan - PaymentPlan document or snapshot
 * @param {number} currentOrdersUsed - orders already counted this cycle (before this order)
 * @returns {{ charge: number, type: 'PER_ORDER' | 'INCLUDED' | 'EXTRA' | 'NONE' }}
 */
function calculateOrderCharge(plan, currentOrdersUsed = 0) {
  const model = resolveEffectivePricingModel(plan);
  const used = Number(currentOrdersUsed) || 0;

  if (model === "PER_ORDER") {
    return {
      charge: Number(plan.price_per_order ?? plan.pricePerOrder) || 0,
      type: "PER_ORDER",
    };
  }

  if (model === "SUBSCRIPTION") {
    const included = Number(plan.included_orders ?? plan.includedOrders) || 0;
    if (included > 0 && used < included) {
      return { charge: 0, type: "INCLUDED" };
    }
    const extraRate = Number(plan.price_per_extra_order ?? plan.pricePerExtraOrder) || 0;
    return { charge: extraRate, type: "EXTRA" };
  }

  return { charge: 0, type: "NONE" };
}

function calculateRunningBill(plan, usage, invoice) {
  const model = resolveEffectivePricingModel(plan);
  const perOrder = Number(usage?.per_order_charges || invoice?.per_order_charges) || 0;
  const extra = Number(usage?.extra_charges || invoice?.extra_charges) || 0;

  if (model === "PER_ORDER") {
    return perOrder;
  }

  if (model === "SUBSCRIPTION") {
    // BASIC/enterprise subscription: monthly fee is prepaid; running bill is extra usage only
    return extra;
  }

  return Number(usage?.total_amount) || 0;
}

module.exports = { calculateOrderCharge, calculateRunningBill, resolveEffectivePricingModel };
