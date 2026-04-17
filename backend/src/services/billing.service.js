const Plan             = require("../models/Plan.model");
const StoreSubscription = require("../models/StoreSubscription.model");
const StoreUsage       = require("../models/StoreUsage.model");
const Invoice          = require("../models/Invoice.model");
const { calculateCharge } = require("./pricing.service");
const plansConfig      = require("../config/plans.config.json");

/* ─────────────────────────────────────────────
   PLAN CONFIG  (sourced from plans.config.json)
───────────────────────────────────────────── */
/**
 * Returns the plans that should be seeded/visible for a given tenantId.
 * - Always includes the defaultPlans from the JSON.
 * - Merges any tenantOverrides for the specific tenant.
 */
function getPlansForTenant(tenantId) {
  const base     = plansConfig.defaultPlans || [];
  const overrides = (plansConfig.tenantOverrides || {})[String(tenantId)] || [];
  return [...base, ...overrides];
}

async function seedPlans(tenantId) {
  const plans = tenantId ? getPlansForTenant(tenantId) : (plansConfig.defaultPlans || []);
  for (const p of plans) {
    await Plan.findOneAndUpdate({ name: p.name }, p, { upsert: true, new: true });
  }
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
/** Returns the last moment of the month that contains `start`. */
function cycleEndDate(start) {
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0); // last day of the same month as start
  end.setHours(23, 59, 59, 999);
  return end;
}

/* ─────────────────────────────────────────────
   SUBSCRIPTION
───────────────────────────────────────────── */
/**
 * Returns the active subscription for a tenant.
 * If none exists, auto-assigns the default (FREE) plan.
 */
async function getOrCreateSubscription(tenantId) {
  let sub = await StoreSubscription.findOne({ tenantId, status: "ACTIVE" }).populate("planId");
  if (sub) return sub;

  // Auto-assign default plan
  let defaultPlan = await Plan.findOne({ isDefault: true, isActive: true });
  if (!defaultPlan) {
    await seedPlans();
    defaultPlan = await Plan.findOne({ isDefault: true, isActive: true });
  }

  const now = new Date();
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of month, midnight
  const cycleEnd   = cycleEndDate(cycleStart);

  sub = await StoreSubscription.create({
    tenantId,
    planId:           defaultPlan._id,
    startDate:        now,
    billingCycleStart: cycleStart,
    billingCycleEnd:   cycleEnd,
    status:           "ACTIVE",
  });

  sub = await StoreSubscription.findById(sub._id).populate("planId");
  return sub;
}

/* ─────────────────────────────────────────────
   USAGE
───────────────────────────────────────────── */
async function getOrCreateUsage(tenantId, planId, cycleStart, cycleEnd) {
  return StoreUsage.findOneAndUpdate(
    { tenantId, billingCycleStart: cycleStart },
    {
      $setOnInsert: {
        tenantId,
        planId,
        billingCycleStart: cycleStart,
        billingCycleEnd:   cycleEnd,
        ordersCount:  0,
        extraOrders:  0,
        totalAmount:  0,
        lastUpdated:  new Date(),
      },
    },
    { upsert: true, new: true }
  );
}

/* ─────────────────────────────────────────────
   INVOICE
───────────────────────────────────────────── */
async function getOrCreateInvoice(tenantId, cycleStart, cycleEnd) {
  return Invoice.findOneAndUpdate(
    { tenantId, billingCycleStart: cycleStart },
    {
      $setOnInsert: {
        tenantId,
        billingCycleStart: cycleStart,
        billingCycleEnd:   cycleEnd,
        baseAmount:        0,
        extraCharges:      0,
        perOrderCharges:   0,
        totalAmount:       0,
        status:            "PENDING",
      },
    },
    { upsert: true, new: true }
  );
}

/* ─────────────────────────────────────────────
   ORDER PLACED — increment usage + invoice
───────────────────────────────────────────── */
async function recordOrderBilling(tenantId) {
  const sub = await getOrCreateSubscription(tenantId);
  const plan = sub.planId; // already populated

  const cycleStart = sub.billingCycleStart;
  const cycleEnd   = sub.billingCycleEnd;

  // Fetch (or create) usage first so we know the count BEFORE this order
  const usage   = await getOrCreateUsage(tenantId, plan._id, cycleStart, cycleEnd);
  const invoice = await getOrCreateInvoice(tenantId, cycleStart, cycleEnd);

  const { charge, type } = calculateCharge(plan, usage.ordersCount);

  // Increment usage
  const usageInc = { ordersCount: 1, totalAmount: charge };
  if (type === "EXTRA") usageInc.extraOrders = 1;

  await StoreUsage.findByIdAndUpdate(usage._id, {
    $inc: usageInc,
    $set: { lastUpdated: new Date() },
  });

  // Increment invoice
  const invoiceInc = { totalAmount: charge };
  if (type === "PER_ORDER") invoiceInc.perOrderCharges = charge;
  if (type === "EXTRA")     invoiceInc.extraCharges    = charge;

  await Invoice.findByIdAndUpdate(invoice._id, { $inc: invoiceInc });
}

/* ─────────────────────────────────────────────
   ORDER CANCELLED — reverse the charge
───────────────────────────────────────────── */
async function reverseOrderBilling(tenantId) {
  const sub = await StoreSubscription.findOne({ tenantId, status: "ACTIVE" }).populate("planId");
  if (!sub) return;

  const plan       = sub.planId;
  const cycleStart = sub.billingCycleStart;

  const usage   = await StoreUsage.findOne({ tenantId, billingCycleStart: cycleStart });
  const invoice = await Invoice.findOne({ tenantId, billingCycleStart: cycleStart });

  if (!usage || usage.ordersCount <= 0) return;

  // The cancelled order was the (ordersCount)th order.
  // Its charge was calculated when ordersCount was (ordersCount - 1).
  const prevCount = usage.ordersCount - 1;
  const { charge, type } = calculateCharge(plan, prevCount);

  const usageDec = { ordersCount: -1, totalAmount: -charge };
  if (type === "EXTRA" && usage.extraOrders > 0) usageDec.extraOrders = -1;

  await StoreUsage.findByIdAndUpdate(usage._id, {
    $inc: usageDec,
    $set: { lastUpdated: new Date() },
  });

  if (invoice) {
    const invoiceDec = { totalAmount: -charge };
    if (type === "PER_ORDER") invoiceDec.perOrderCharges = -charge;
    if (type === "EXTRA")     invoiceDec.extraCharges    = -charge;

    await Invoice.findByIdAndUpdate(invoice._id, { $inc: invoiceDec });
  }
}

/* ─────────────────────────────────────────────
   MONTHLY BILLING GENERATION
───────────────────────────────────────────── */
/**
 * Finalises the current invoice, resets usage, and opens the next billing cycle.
 * If tenantId is provided, runs for a single store.  Otherwise runs for ALL active stores.
 */
async function generateMonthlyBilling(tenantId) {
  if (tenantId) {
    return _generateForTenant(tenantId);
  }

  // Run for all active subscriptions
  const subs = await StoreSubscription.find({ status: "ACTIVE" });
  const results = [];
  for (const s of subs) {
    try {
      const r = await _generateForTenant(s.tenantId);
      results.push({ tenantId: s.tenantId, ...r });
    } catch (err) {
      results.push({ tenantId: s.tenantId, error: err.message });
    }
  }
  return results;
}

async function _generateForTenant(tenantId) {
  const sub = await StoreSubscription.findOne({ tenantId, status: "ACTIVE" }).populate("planId");
  if (!sub) throw new Error(`No active subscription for tenant: ${tenantId}`);

  const plan       = sub.planId;
  const cycleStart = sub.billingCycleStart;
  const cycleEnd   = sub.billingCycleEnd;

  const invoice = await Invoice.findOne({ tenantId, billingCycleStart: cycleStart });
  if (!invoice) throw new Error(`No invoice found for tenant ${tenantId} cycle ${cycleStart}`);

  // ── Finalise invoice ──────────────────────────────────────────
  let finalTotal = invoice.totalAmount;
  if (plan.pricingType === "SUBSCRIPTION") {
    finalTotal = plan.monthlyPrice + (invoice.extraCharges || 0);
  }

  await Invoice.findByIdAndUpdate(invoice._id, {
    $set: {
      baseAmount:    plan.pricingType === "SUBSCRIPTION" ? plan.monthlyPrice : 0,
      totalAmount:   finalTotal,
      status:        "PENDING",
      planSnapshot:  plan.toObject(),
    },
  });

  // ── Reset usage for this cycle ────────────────────────────────
  const usage = await StoreUsage.findOne({ tenantId, billingCycleStart: cycleStart });
  if (usage) {
    await StoreUsage.findByIdAndUpdate(usage._id, {
      $set: { ordersCount: 0, extraOrders: 0, totalAmount: 0, lastUpdated: new Date() },
    });
  }

  // ── Advance billing cycle ─────────────────────────────────────
  const newCycleStart = new Date(cycleEnd);
  newCycleStart.setDate(newCycleStart.getDate() + 1);
  newCycleStart.setHours(0, 0, 0, 0);
  const newCycleEnd = cycleEndDate(newCycleStart);

  // Apply scheduled plan change (if any)
  const newPlanId = sub.nextPlanId || sub.planId._id;

  await StoreSubscription.findByIdAndUpdate(sub._id, {
    $set: {
      planId:            newPlanId,
      billingCycleStart: newCycleStart,
      billingCycleEnd:   newCycleEnd,
      nextPlanId:        null,
    },
  });

  // ── Create fresh usage + invoice for new cycle ────────────────
  await StoreUsage.create({
    tenantId,
    planId:            newPlanId,
    billingCycleStart: newCycleStart,
    billingCycleEnd:   newCycleEnd,
    ordersCount:       0,
    extraOrders:       0,
    totalAmount:       0,
    lastUpdated:       new Date(),
  });

  await Invoice.create({
    tenantId,
    billingCycleStart: newCycleStart,
    billingCycleEnd:   newCycleEnd,
    baseAmount:        0,
    extraCharges:      0,
    perOrderCharges:   0,
    totalAmount:       0,
    status:            "PENDING",
  });

  return {
    message:    "Billing generated",
    cycleStart: cycleStart.toISOString(),
    cycleEnd:   cycleEnd.toISOString(),
    finalTotal,
  };
}

module.exports = {
  seedPlans,
  getOrCreateSubscription,
  recordOrderBilling,
  reverseOrderBilling,
  generateMonthlyBilling,
};
