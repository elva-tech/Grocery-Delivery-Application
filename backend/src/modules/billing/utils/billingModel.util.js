const { resolveEffectivePricingModel } = require("./enterprisePlan.util");
const { calculateProratedAmount } = require("./proration.util");

const INVOICE_TYPES = {
  MONTHLY_SUBSCRIPTION: "MONTHLY_SUBSCRIPTION",
  EXTRA_USAGE: "EXTRA_USAGE",
  PER_ORDER: "PER_ORDER",
};

function effectiveModel(plan) {
  return resolveEffectivePricingModel(plan);
}

function isSubscriptionStyle(plan) {
  return effectiveModel(plan) === "SUBSCRIPTION";
}

function isPerOrderStyle(plan) {
  return effectiveModel(plan) === "PER_ORDER";
}

function inferInvoiceType(invoice, plan) {
  if (invoice?.invoice_type) return invoice.invoice_type;
  if (!plan) return INVOICE_TYPES.PER_ORDER;
  if (isPerOrderStyle(plan)) return INVOICE_TYPES.PER_ORDER;
  const base = Number(invoice?.base_amount) || 0;
  const perOrder = Number(invoice?.per_order_charges) || 0;
  const extra = Number(invoice?.extra_charges) || 0;
  if (perOrder > 0 && base === 0) return INVOICE_TYPES.PER_ORDER;
  if (extra > 0 && base === 0) return INVOICE_TYPES.EXTRA_USAGE;
  if (base > 0) return INVOICE_TYPES.MONTHLY_SUBSCRIPTION;
  return INVOICE_TYPES.EXTRA_USAGE;
}

/** Prepaid charge from enrollment date (today = mid-month proration). */
function resolvePrepaidChargeAmount(plan, enrollmentDate = new Date()) {
  if (!isSubscriptionStyle(plan)) return 0;
  const monthly = Number(plan.monthly_price ?? plan.monthlyPrice) || 0;
  return calculateProratedAmount(monthly, enrollmentDate);
}

/** @deprecated prefer resolvePrepaidChargeAmount */
function prepaidAmountForPlan(plan, proratedAmount = 0) {
  if (!isSubscriptionStyle(plan)) return 0;
  const prorated = Number(proratedAmount) || 0;
  if (prorated > 0) return prorated;
  return resolvePrepaidChargeAmount(plan, new Date());
}

module.exports = {
  INVOICE_TYPES,
  effectiveModel,
  isSubscriptionStyle,
  isPerOrderStyle,
  inferInvoiceType,
  prepaidAmountForPlan,
  resolvePrepaidChargeAmount,
};
