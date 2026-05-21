/**
 * One-time migration from legacy Plan / StoreSubscription / Invoice collections.
 */
const LegacyPlan = require("../../../models/Plan.model");
const LegacySub = require("../../../models/StoreSubscription.model");
const LegacyUsage = require("../../../models/StoreUsage.model");
const LegacyInvoice = require("../../../models/Invoice.model");
const PaymentPlan = require("../models/PaymentPlan.model");
const TenantSubscription = require("../models/TenantSubscription.model");
const BillingUsage = require("../models/BillingUsage.model");
const BillingInvoice = require("../models/BillingInvoice.model");
const { seedDefaultPlansIfEmpty } = require("./seed.service");
const { buildPlanSnapshot } = require("../utils/planSnapshot.util");
const { generateSubscriptionUniqueKey } = require("../utils/subscriptionKey.util");
const { generateInvoiceNumber } = require("../utils/invoiceNumber.util");

function mapPricingType(t) {
  if (t === "PER_ORDER") return "PER_ORDER";
  if (t === "SUBSCRIPTION") return "SUBSCRIPTION";
  return "ENTERPRISE";
}

async function migrateLegacyBilling() {
  const existing = await PaymentPlan.countDocuments();
  if (existing > 0) {
    const subs = await TenantSubscription.countDocuments();
    if (subs > 0) return { migrated: false, reason: "already_initialized" };
  }

  await seedDefaultPlansIfEmpty();

  const planMap = {};
  const legacyPlans = await LegacyPlan.find().lean();
  for (const lp of legacyPlans) {
    const code = String(lp.name || "LEGACY").toUpperCase().replace(/\s+/g, "_");
    const doc = await PaymentPlan.findOneAndUpdate(
      { plan_code: code },
      {
        plan_code: code,
        name: lp.name,
        description: "",
        pricing_model: mapPricingType(lp.pricingType),
        monthly_price: lp.monthlyPrice || 0,
        included_orders: lp.includedOrders,
        price_per_order: lp.pricePerOrder || 0,
        price_per_extra_order: lp.pricePerExtraOrder || 0,
        is_custom_plan: code === "ENTERPRISE",
        is_active: lp.isActive !== false,
      },
      { upsert: true, new: true }
    );
    planMap[String(lp._id)] = doc._id;
  }

  const defaultFree = await PaymentPlan.findOne({ plan_code: "FREE" });

  const legacySubs = await LegacySub.find().lean();
  for (const ls of legacySubs) {
    const planId = planMap[String(ls.planId)] || defaultFree?._id;
    const plan = await PaymentPlan.findById(planId).lean();
    const store_id = ls.tenantId;
    const start = ls.billingCycleStart || new Date();
    const month = start.getMonth() + 1;
    const year = start.getFullYear();

    const sub = await TenantSubscription.findOneAndUpdate(
      { tenant_id: ls.tenantId, store_id, subscription_status: "ACTIVE" },
      {
        tenant_id: ls.tenantId,
        store_id,
        subscription_unique_key: generateSubscriptionUniqueKey(ls.tenantId, store_id),
        plan_id: planId,
        plan_snapshot: buildPlanSnapshot(plan),
        subscription_status: ls.status === "EXPIRED" ? "EXPIRED" : "ACTIVE",
        billing_start_date: ls.billingCycleStart,
        billing_end_date: ls.billingCycleEnd,
        next_billing_date: ls.billingCycleEnd,
        subscribed_at: ls.startDate || ls.createdAt,
        next_plan_id: ls.nextPlanId ? planMap[String(ls.nextPlanId)] : null,
      },
      { upsert: true, new: true }
    );

    const usage = await LegacyUsage.findOne({
      tenantId: ls.tenantId,
      billingCycleStart: ls.billingCycleStart,
    }).lean();

    if (usage) {
      await BillingUsage.findOneAndUpdate(
        { tenant_id: ls.tenantId, store_id, billing_month: month, billing_year: year },
        {
          subscription_id: sub._id,
          orders_used: usage.ordersCount || 0,
          extra_orders: usage.extraOrders || 0,
          extra_charges: 0,
          per_order_charges: 0,
          subtotal: plan?.monthly_price || 0,
          total_amount: usage.totalAmount || 0,
        },
        { upsert: true }
      );
    }

    const inv = await LegacyInvoice.findOne({
      tenantId: ls.tenantId,
      billingCycleStart: ls.billingCycleStart,
    }).lean();

    if (inv) {
      const invNum = await generateInvoiceNumber(ls.tenantId, year, month);
      await BillingInvoice.findOneAndUpdate(
        { tenant_id: ls.tenantId, store_id, billing_month: month, billing_year: year },
        {
          subscription_id: sub._id,
          invoice_number: invNum,
          invoice_date: inv.createdAt || start,
          due_date: inv.billingCycleEnd,
          base_amount: inv.baseAmount || 0,
          extra_charges: inv.extraCharges || 0,
          per_order_charges: inv.perOrderCharges || 0,
          total_amount: inv.totalAmount || 0,
          invoice_status: inv.status === "PAID" ? "PAID" : "PENDING",
          payment_status: inv.status === "PAID" ? "PAID" : "UNPAID",
          is_current_cycle: true,
          plan_snapshot: buildPlanSnapshot(plan),
        },
        { upsert: true }
      );
    }
  }

  return { migrated: true, plans: legacyPlans.length, subs: legacySubs.length };
}

module.exports = { migrateLegacyBilling };
