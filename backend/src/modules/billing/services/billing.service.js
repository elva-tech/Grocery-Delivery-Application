const mongoose = require("mongoose");
const PaymentPlan = require("../models/PaymentPlan.model");
const TenantSubscription = require("../models/TenantSubscription.model");
const BillingUsage = require("../models/BillingUsage.model");
const BillingInvoice = require("../models/BillingInvoice.model");
const Tenant = require("../../../models/Tenant.model");
const Store = require("../../../models/Store.model");
const { calculateOrderCharge, calculateRunningBill } = require("./pricing.service");
const { calculateProratedAmount } = require("../utils/proration.util");
const { buildPlanSnapshot } = require("../utils/planSnapshot.util");
const { generateSubscriptionUniqueKey } = require("../utils/subscriptionKey.util");
const { generateInvoiceNumber } = require("../utils/invoiceNumber.util");
const {
  billingPeriod,
  startOfMonth,
  endOfMonth,
  addDays,
  isLastDayOfMonth,
} = require("../utils/cycleDates.util");
const { getDefaultPlan, seedDefaultPlansIfEmpty } = require("./seed.service");
const {
  notifyDueSoon,
  notifyOverdue,
  notifySuspensionWarning,
  notifySuspended,
} = require("./notification.service");
const {
  INVOICE_TYPES,
  effectiveModel,
  isSubscriptionStyle,
  isPerOrderStyle,
  inferInvoiceType,
  prepaidAmountForPlan,
  resolvePrepaidChargeAmount,
} = require("../utils/billingModel.util");

function storeIdFor(tenantId) {
  return tenantId;
}

function syncSubscriptionMoneyFields(sub, plan, enrollmentDate = new Date()) {
  const prorated = isSubscriptionStyle(plan)
    ? resolvePrepaidChargeAmount(plan, enrollmentDate)
    : 0;
  return {
    prorated_base_amount: prorated,
    prorated_amount: prorated,
    prepaid_amount: prorated,
  };
}

async function findPrepaidInvoice(tenantId, store_id, billing_month, billing_year) {
  return BillingInvoice.findOne({
    tenant_id: tenantId,
    store_id,
    billing_month,
    billing_year,
    invoice_type: INVOICE_TYPES.MONTHLY_SUBSCRIPTION,
    invoice_status: { $ne: "CANCELLED" },
  })
    .sort({ created_at: -1 })
    .lean();
}

async function findCurrentCycleInvoice(tenantId, store_id, plan) {
  const model = effectiveModel(plan);
  const type =
    model === "SUBSCRIPTION" ? INVOICE_TYPES.EXTRA_USAGE : INVOICE_TYPES.PER_ORDER;
  return BillingInvoice.findOne({
    tenant_id: tenantId,
    store_id,
    is_current_cycle: true,
    invoice_type: type,
  }).lean();
}

async function getPayableInvoice(tenantId, plan) {
  const store_id = storeIdFor(tenantId);
  const { billing_month, billing_year } = billingPeriod();

  const prepaid = await BillingInvoice.findOne({
    tenant_id: tenantId,
    store_id,
    billing_month,
    billing_year,
    invoice_type: INVOICE_TYPES.MONTHLY_SUBSCRIPTION,
    payment_status: "UNPAID",
    invoice_status: { $nin: ["CANCELLED", "PAID"] },
  }).lean();
  if (prepaid) return prepaid;

  const cycleType = isSubscriptionStyle(plan)
    ? INVOICE_TYPES.EXTRA_USAGE
    : INVOICE_TYPES.PER_ORDER;
  const cycle = await BillingInvoice.findOne({
    tenant_id: tenantId,
    store_id,
    is_current_cycle: true,
    invoice_type: cycleType,
    payment_status: "UNPAID",
  }).lean();
  if (cycle && Number(cycle.total_amount) > 0) return cycle;

  return cycle;
}

async function createPrepaidSubscriptionInvoice(
  tenantId,
  store_id,
  subscription,
  plan,
  amount,
  enrollmentDate = new Date()
) {
  const { billing_month, billing_year } = billingPeriod();
  const charge =
    Number(amount) > 0 ? Number(amount) : resolvePrepaidChargeAmount(plan, enrollmentDate);
  const existing = await findPrepaidInvoice(tenantId, store_id, billing_month, billing_year);
  if (existing) {
    if (existing.payment_status === "PAID") return existing;
    await BillingInvoice.findByIdAndUpdate(existing._id, {
      $set: {
        base_amount: charge,
        total_amount: charge,
        plan_snapshot: buildPlanSnapshot(plan),
      },
    });
    return { ...existing, base_amount: charge, total_amount: charge };
  }

  const now = new Date();
  const dueDate = addDays(now, 7);

  return BillingInvoice.create({
    tenant_id: tenantId,
    store_id,
    subscription_id: subscription._id,
    invoice_number: await generateInvoiceNumber(tenantId, billing_year, billing_month),
    billing_month,
    billing_year,
    invoice_type: INVOICE_TYPES.MONTHLY_SUBSCRIPTION,
    invoice_date: now,
    due_date: dueDate,
    base_amount: charge,
    extra_charges: 0,
    per_order_charges: 0,
    total_amount: charge,
    invoice_status: "PENDING",
    payment_status: "UNPAID",
    plan_snapshot: buildPlanSnapshot(plan),
    is_current_cycle: false,
  });
}

async function ensureExtraUsageInvoice(tenantId, store_id, subscription, plan) {
  const { billing_month, billing_year } = billingPeriod();
  let invoice = await BillingInvoice.findOne({
    tenant_id: tenantId,
    store_id,
    billing_month,
    billing_year,
    invoice_type: INVOICE_TYPES.EXTRA_USAGE,
    is_current_cycle: true,
  }).lean();

  if (invoice) return invoice;

  invoice = await BillingInvoice.create({
    tenant_id: tenantId,
    store_id,
    subscription_id: subscription._id,
    invoice_number: await generateInvoiceNumber(tenantId, billing_year, billing_month),
    billing_month,
    billing_year,
    invoice_type: INVOICE_TYPES.EXTRA_USAGE,
    invoice_date: new Date(),
    due_date: addDays(endOfMonth(), 7),
    base_amount: 0,
    extra_charges: 0,
    per_order_charges: 0,
    total_amount: 0,
    invoice_status: "PENDING",
    payment_status: "UNPAID",
    plan_snapshot: buildPlanSnapshot(plan),
    is_current_cycle: true,
  });
  return invoice;
}

async function ensurePerOrderCycleInvoice(tenantId, store_id, subscription, plan) {
  const { billing_month, billing_year } = billingPeriod();
  let invoice = await BillingInvoice.findOne({
    tenant_id: tenantId,
    store_id,
    billing_month,
    billing_year,
    invoice_type: INVOICE_TYPES.PER_ORDER,
    is_current_cycle: true,
  }).lean();

  if (invoice) return invoice;

  return BillingInvoice.create({
    tenant_id: tenantId,
    store_id,
    subscription_id: subscription._id,
    invoice_number: await generateInvoiceNumber(tenantId, billing_year, billing_month),
    billing_month,
    billing_year,
    invoice_type: INVOICE_TYPES.PER_ORDER,
    invoice_date: new Date(),
    due_date: addDays(endOfMonth(), 7),
    base_amount: 0,
    extra_charges: 0,
    per_order_charges: 0,
    total_amount: 0,
    invoice_status: "PENDING",
    payment_status: "UNPAID",
    plan_snapshot: buildPlanSnapshot(plan),
    is_current_cycle: true,
  });
}

async function getActivePlan(planId) {
  return PaymentPlan.findById(planId).lean();
}

/**
 * Keeps subscription cycle dates aligned with the calendar month used for usage/invoice.
 * Stale dates happen when month-end cron did not run or legacy data was migrated.
 */
async function syncSubscriptionToActiveCycle(tenantId) {
  const store_id = storeIdFor(tenantId);
  const sub = await TenantSubscription.findOne({
    tenant_id: tenantId,
    store_id,
    subscription_status: "ACTIVE",
  });
  if (!sub) return null;

  const current = billingPeriod();
  const subEnd = new Date(sub.billing_end_date);
  const isCurrentMonth =
    subEnd.getFullYear() === current.billing_end_date.getFullYear() &&
    subEnd.getMonth() === current.billing_end_date.getMonth();

  if (isCurrentMonth) return sub.toObject();

  const plan = await getActivePlan(sub.plan_id);

  sub.billing_start_date = current.billing_start_date;
  sub.billing_end_date = current.billing_end_date;
  sub.next_billing_date = current.next_billing_date;
  const money = syncSubscriptionMoneyFields(sub, plan, current.billing_start_date);
  Object.assign(sub, money);
  await sub.save();

  await ensureCycleRecords(tenantId, store_id, sub, plan, 0);
  if (isSubscriptionStyle(plan)) {
    await createPrepaidSubscriptionInvoice(
      tenantId,
      store_id,
      sub,
      plan,
      money.prepaid_amount,
      current.billing_start_date
    );
  }
  return sub.toObject();
}

async function getOrCreateSubscription(tenantId, userId = null) {
  const store_id = storeIdFor(tenantId);
  let sub = await TenantSubscription.findOne({
    tenant_id: tenantId,
    store_id,
    subscription_status: "ACTIVE",
  }).lean();

  if (sub) {
    const synced = await syncSubscriptionToActiveCycle(tenantId);
    const activeSub = synced || sub;
    const plan = await getActivePlan(activeSub.plan_id);
    return { subscription: activeSub, plan };
  }

  await seedDefaultPlansIfEmpty();
  const defaultPlan = await getDefaultPlan();
  const period = billingPeriod();
  const money = syncSubscriptionMoneyFields({}, defaultPlan, new Date());

  sub = await TenantSubscription.create({
    tenant_id: tenantId,
    store_id,
    user_id: userId,
    subscription_unique_key: generateSubscriptionUniqueKey(tenantId, store_id),
    plan_id: defaultPlan._id,
    plan_snapshot: buildPlanSnapshot(defaultPlan),
    subscription_status: "ACTIVE",
    billing_start_date: period.billing_start_date,
    billing_end_date: period.billing_end_date,
    next_billing_date: period.next_billing_date,
    due_date: null,
    subscribed_at: new Date(),
    ...money,
  });

  await ensureCycleRecords(tenantId, store_id, sub, defaultPlan, 0);
  if (isSubscriptionStyle(defaultPlan)) {
    await createPrepaidSubscriptionInvoice(
      tenantId,
      store_id,
      sub,
      defaultPlan,
      money.prepaid_amount,
      new Date()
    );
  }
  await Tenant.updateOne({ tenantId }, { plan: defaultPlan.plan_code }).catch(() => {});

  return { subscription: sub.toObject(), plan: defaultPlan };
}

async function ensureCycleRecords(tenantId, store_id, subscription, plan, proratedBase = 0) {
  const { billing_month, billing_year } = billingPeriod();

  await BillingInvoice.updateMany(
    {
      tenant_id: tenantId,
      store_id,
      is_current_cycle: true,
      $or: [{ billing_year: { $ne: billing_year } }, { billing_month: { $ne: billing_month } }],
    },
    { $set: { is_current_cycle: false } }
  );

  await BillingUsage.findOneAndUpdate(
    { tenant_id: tenantId, store_id, billing_month, billing_year },
    {
      $setOnInsert: {
        subscription_id: subscription._id,
        orders_used: 0,
        extra_orders: 0,
        subtotal: 0,
        extra_charges: 0,
        per_order_charges: 0,
        total_amount: 0,
      },
    },
    { upsert: true, new: true }
  );

  if (isSubscriptionStyle(plan)) {
    await ensureExtraUsageInvoice(tenantId, store_id, subscription, plan);
    await createPrepaidSubscriptionInvoice(
      tenantId,
      store_id,
      subscription,
      plan,
      0,
      new Date()
    );
    return;
  }

  await ensurePerOrderCycleInvoice(tenantId, store_id, subscription, plan);
}

async function getCurrentUsageAndInvoice(tenantId) {
  const store_id = storeIdFor(tenantId);
  await syncSubscriptionToActiveCycle(tenantId);
  const { billing_month, billing_year } = billingPeriod();

  const subscription = await TenantSubscription.findOne({
    tenant_id: tenantId,
    store_id,
    subscription_status: "ACTIVE",
  }).lean();

  let usage = await BillingUsage.findOne({ tenant_id: tenantId, store_id, billing_month, billing_year }).lean();

  let prepaidInvoice = null;
  let invoice = null;

  if (subscription) {
    const plan = await getActivePlan(subscription.plan_id);
    const subDoc = await TenantSubscription.findById(subscription._id);
    if (subDoc && plan) {
      await ensureCycleRecords(
        tenantId,
        store_id,
        subDoc,
        plan,
        subscription.prorated_amount ?? subscription.prorated_base_amount
      );
      usage = await BillingUsage.findOne({ tenant_id: tenantId, store_id, billing_month, billing_year }).lean();
      prepaidInvoice = await findPrepaidInvoice(tenantId, store_id, billing_month, billing_year);
      invoice = await findCurrentCycleInvoice(tenantId, store_id, plan);

      if (invoice?.invoice_type === INVOICE_TYPES.EXTRA_USAGE && usage) {
        const extra = Number(usage.extra_charges) || 0;
        if (usage.extra_orders === 0 && extra === 0 && Number(invoice.total_amount) > 0) {
          await BillingInvoice.findByIdAndUpdate(invoice._id, {
            $set: { total_amount: 0, extra_charges: 0, base_amount: 0 },
          });
          invoice = { ...invoice, total_amount: 0, extra_charges: 0, base_amount: 0 };
        }
      }
    }
  }

  return { usage, invoice, prepaidInvoice, subscription };
}

async function recordOrderBilling(tenantId) {
  const store_id = storeIdFor(tenantId);
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { subscription, plan } = await getOrCreateSubscription(tenantId);
    const { billing_month, billing_year } = billingPeriod();

    let usage = await BillingUsage.findOne({
      tenant_id: tenantId,
      store_id,
      billing_month,
      billing_year,
    }).session(session);

    let invoice = await BillingInvoice.findOne({
      tenant_id: tenantId,
      store_id,
      is_current_cycle: true,
      invoice_type: isSubscriptionStyle(plan)
        ? INVOICE_TYPES.EXTRA_USAGE
        : INVOICE_TYPES.PER_ORDER,
    }).session(session);

    if (!usage || !invoice) {
      await ensureCycleRecords(
        tenantId,
        store_id,
        subscription,
        plan,
        subscription.prorated_amount ?? subscription.prorated_base_amount
      );
      usage = await BillingUsage.findOne({
        tenant_id: tenantId,
        store_id,
        billing_month,
        billing_year,
      }).session(session);
      invoice = await BillingInvoice.findOne({
        tenant_id: tenantId,
        store_id,
        is_current_cycle: true,
        invoice_type: isSubscriptionStyle(plan)
          ? INVOICE_TYPES.EXTRA_USAGE
          : INVOICE_TYPES.PER_ORDER,
      }).session(session);
    }

    if (!usage || !invoice) {
      throw new Error("Billing cycle records missing");
    }

    const prevCount = usage.orders_used || 0;
    const { charge, type } = calculateOrderCharge(plan, prevCount);

    const usageInc = { orders_used: 1, total_amount: charge };
    if (type === "EXTRA") usageInc.extra_orders = 1;
    if (type === "PER_ORDER") usageInc.per_order_charges = charge;

    await BillingUsage.findByIdAndUpdate(
      usage._id,
      { $inc: usageInc },
      { session }
    );

    const invoiceInc = { total_amount: charge };
    if (type === "PER_ORDER") invoiceInc.per_order_charges = charge;
    if (type === "EXTRA") invoiceInc.extra_charges = charge;

    await BillingInvoice.findByIdAndUpdate(invoice._id, { $inc: invoiceInc }, { session });

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function reverseOrderBilling(tenantId) {
  const store_id = storeIdFor(tenantId);
  const { billing_month, billing_year } = billingPeriod();

  const usage = await BillingUsage.findOne({
    tenant_id: tenantId,
    store_id,
    billing_month,
    billing_year,
  });
  if (!usage || usage.orders_used <= 0) return;

  const sub = await TenantSubscription.findOne({
    tenant_id: tenantId,
    store_id,
    subscription_status: "ACTIVE",
  });
  if (!sub) return;

  const plan = await getActivePlan(sub.plan_id);
  const prevCount = usage.orders_used - 1;
  const { charge, type } = calculateOrderCharge(plan, prevCount);

  const usageDec = { orders_used: -1, total_amount: -charge };
  if (type === "EXTRA" && usage.extra_orders > 0) usageDec.extra_orders = -1;
  if (type === "PER_ORDER") usageDec.per_order_charges = -charge;

  await BillingUsage.findByIdAndUpdate(usage._id, { $inc: usageDec });

  const cycleType = isSubscriptionStyle(plan)
    ? INVOICE_TYPES.EXTRA_USAGE
    : INVOICE_TYPES.PER_ORDER;
  const invoice = await BillingInvoice.findOne({
    tenant_id: tenantId,
    store_id,
    is_current_cycle: true,
    invoice_type: cycleType,
  });
  if (invoice) {
    const invoiceDec = { total_amount: -charge };
    if (type === "PER_ORDER") invoiceDec.per_order_charges = -charge;
    if (type === "EXTRA") invoiceDec.extra_charges = -charge;
    await BillingInvoice.findByIdAndUpdate(invoice._id, { $inc: invoiceDec });
  }
}

async function schedulePlanChange(tenantId, planId) {
  const plan = await PaymentPlan.findById(planId);
  if (!plan || !plan.is_active) throw new Error("Plan not found or inactive");

  const store_id = storeIdFor(tenantId);
  const sub = await TenantSubscription.findOneAndUpdate(
    { tenant_id: tenantId, store_id, subscription_status: "ACTIVE" },
    { $set: { next_plan_id: plan._id } },
    { new: true }
  );
  if (!sub) throw new Error("No active subscription");
  return { subscription: sub, plan };
}

async function activatePlanNow(tenantId, planId, userId = null) {
  const plan = await PaymentPlan.findById(planId);
  if (!plan || !plan.is_active) throw new Error("Plan not found");

  const store_id = storeIdFor(tenantId);
  const now = new Date();
  const period = billingPeriod(now);
  const money = syncSubscriptionMoneyFields({}, plan, now);

  const sub = await TenantSubscription.findOneAndUpdate(
    { tenant_id: tenantId, store_id, subscription_status: "ACTIVE" },
    {
      $set: {
        plan_id: plan._id,
        plan_snapshot: buildPlanSnapshot(plan),
        next_plan_id: null,
        billing_start_date: period.billing_start_date,
        billing_end_date: period.billing_end_date,
        next_billing_date: period.next_billing_date,
        user_id: userId || undefined,
        ...money,
      },
    },
    { new: true, upsert: false }
  );

  if (!sub) throw new Error("No active subscription");

  await BillingInvoice.updateMany(
    { tenant_id: tenantId, store_id, is_current_cycle: true },
    { $set: { is_current_cycle: false } }
  );

  await ensureCycleRecords(tenantId, store_id, sub, plan, 0);

  if (isSubscriptionStyle(plan) && money.prepaid_amount > 0) {
    await createPrepaidSubscriptionInvoice(
      tenantId,
      store_id,
      sub,
      plan,
      money.prepaid_amount,
      now
    );
  }

  await Tenant.updateOne({ tenantId }, { plan: plan.plan_code }).catch(() => {});
  return { subscription: sub, plan, prorated: money.prorated_amount };
}

async function _finalizeInvoiceForTenant(tenantId, sub, plan) {
  const store_id = storeIdFor(tenantId);
  const model = effectiveModel(plan);
  const invoiceDate = endOfMonth();
  const dueDate = addDays(invoiceDate, 7);

  if (model === "SUBSCRIPTION") {
    const invoice = await BillingInvoice.findOne({
      tenant_id: tenantId,
      store_id,
      is_current_cycle: true,
      invoice_type: INVOICE_TYPES.EXTRA_USAGE,
    });
    if (!invoice) return null;

    const usage = await BillingUsage.findOne({
      tenant_id: tenantId,
      store_id,
      billing_month: invoice.billing_month,
      billing_year: invoice.billing_year,
    });

    const extra = Number(usage?.extra_charges || invoice.extra_charges) || 0;
    if (extra <= 0) {
      await BillingInvoice.findByIdAndUpdate(invoice._id, {
        $set: { is_current_cycle: false, invoice_status: "CANCELLED" },
      });
      return null;
    }

    await BillingInvoice.findByIdAndUpdate(invoice._id, {
      $set: {
        base_amount: 0,
        extra_charges: extra,
        per_order_charges: 0,
        total_amount: extra,
        invoice_date: invoiceDate,
        due_date: dueDate,
        invoice_status: "PENDING",
        payment_status: "UNPAID",
        plan_snapshot: buildPlanSnapshot(plan),
        is_current_cycle: false,
      },
    });
    return { invoiceId: invoice._id, total: extra, dueDate };
  }

  const invoice = await BillingInvoice.findOne({
    tenant_id: tenantId,
    store_id,
    is_current_cycle: true,
    invoice_type: INVOICE_TYPES.PER_ORDER,
  });
  if (!invoice) return null;

  const usage = await BillingUsage.findOne({
    tenant_id: tenantId,
    store_id,
    billing_month: invoice.billing_month,
    billing_year: invoice.billing_year,
  });

  const total = Number(usage?.per_order_charges || invoice.per_order_charges) || 0;
  if (total <= 0) {
    await BillingInvoice.findByIdAndUpdate(invoice._id, {
      $set: { is_current_cycle: false, invoice_status: "CANCELLED" },
    });
    return null;
  }

  await BillingInvoice.findByIdAndUpdate(invoice._id, {
    $set: {
      base_amount: 0,
      extra_charges: 0,
      per_order_charges: total,
      total_amount: total,
      invoice_date: invoiceDate,
      due_date: dueDate,
      invoice_status: "PENDING",
      payment_status: "UNPAID",
      plan_snapshot: buildPlanSnapshot(plan),
      is_current_cycle: false,
    },
  });

  return { invoiceId: invoice._id, total, dueDate };
}

async function _openNextCycle(tenantId, sub, plan) {
  const store_id = storeIdFor(tenantId);
  const closedCycleEnd = sub.billing_end_date ? new Date(sub.billing_end_date) : endOfMonth();
  const nextStart = addDays(closedCycleEnd, 1);
  nextStart.setHours(0, 0, 0, 0);
  const nextPeriod = billingPeriod(nextStart);

  let newPlanId = sub.plan_id;
  if (sub.next_plan_id) {
    newPlanId = sub.next_plan_id;
    const newPlan = await getActivePlan(newPlanId);
    if (newPlan) {
      plan = newPlan;
      await Tenant.updateOne({ tenantId }, { plan: plan.plan_code }).catch(() => {});
    }
  }

  const fullMonthly = isSubscriptionStyle(plan) ? Number(plan.monthly_price) || 0 : 0;
  const money = syncSubscriptionMoneyFields({}, plan, 0);

  await TenantSubscription.findByIdAndUpdate(sub._id, {
    $set: {
      plan_id: newPlanId,
      plan_snapshot: buildPlanSnapshot(plan),
      next_plan_id: null,
      billing_start_date: nextPeriod.billing_start_date,
      billing_end_date: nextPeriod.billing_end_date,
      next_billing_date: nextPeriod.next_billing_date,
      ...money,
    },
  });

  const newSub = await TenantSubscription.findById(sub._id).lean();

  await BillingUsage.create({
    tenant_id: tenantId,
    store_id,
    subscription_id: newSub._id,
    billing_month: nextPeriod.billing_month,
    billing_year: nextPeriod.billing_year,
    orders_used: 0,
    extra_orders: 0,
    subtotal: 0,
    extra_charges: 0,
    per_order_charges: 0,
    total_amount: 0,
  });

  if (isSubscriptionStyle(plan)) {
    if (fullMonthly > 0) {
      await BillingInvoice.create({
        tenant_id: tenantId,
        store_id,
        subscription_id: newSub._id,
        invoice_number: await generateInvoiceNumber(
          tenantId,
          nextPeriod.billing_year,
          nextPeriod.billing_month
        ),
        billing_month: nextPeriod.billing_month,
        billing_year: nextPeriod.billing_year,
        invoice_type: INVOICE_TYPES.MONTHLY_SUBSCRIPTION,
        invoice_date: nextPeriod.billing_start_date,
        due_date: addDays(nextPeriod.billing_start_date, 7),
        base_amount: fullMonthly,
        extra_charges: 0,
        per_order_charges: 0,
        total_amount: fullMonthly,
        invoice_status: "PENDING",
        payment_status: "UNPAID",
        plan_snapshot: buildPlanSnapshot(plan),
        is_current_cycle: false,
      });
    }
    await BillingInvoice.create({
      tenant_id: tenantId,
      store_id,
      subscription_id: newSub._id,
      invoice_number: await generateInvoiceNumber(
        tenantId,
        nextPeriod.billing_year,
        nextPeriod.billing_month
      ),
      billing_month: nextPeriod.billing_month,
      billing_year: nextPeriod.billing_year,
      invoice_type: INVOICE_TYPES.EXTRA_USAGE,
      invoice_date: nextPeriod.billing_start_date,
      due_date: addDays(nextPeriod.billing_end_date, 7),
      base_amount: 0,
      extra_charges: 0,
      per_order_charges: 0,
      total_amount: 0,
      invoice_status: "PENDING",
      payment_status: "UNPAID",
      plan_snapshot: buildPlanSnapshot(plan),
      is_current_cycle: true,
    });
  } else {
    await BillingInvoice.create({
      tenant_id: tenantId,
      store_id,
      subscription_id: newSub._id,
      invoice_number: await generateInvoiceNumber(
        tenantId,
        nextPeriod.billing_year,
        nextPeriod.billing_month
      ),
      billing_month: nextPeriod.billing_month,
      billing_year: nextPeriod.billing_year,
      invoice_type: INVOICE_TYPES.PER_ORDER,
      invoice_date: nextPeriod.billing_start_date,
      due_date: addDays(nextPeriod.billing_end_date, 7),
      base_amount: 0,
      extra_charges: 0,
      per_order_charges: 0,
      total_amount: 0,
      invoice_status: "PENDING",
      payment_status: "UNPAID",
      plan_snapshot: buildPlanSnapshot(plan),
      is_current_cycle: true,
    });
  }

  return newSub;
}

async function generateMonthlyBilling(tenantId = null) {
  await seedDefaultPlansIfEmpty();

  const query = { subscription_status: "ACTIVE" };
  if (tenantId) query.tenant_id = tenantId;

  const subs = await TenantSubscription.find(query).lean();
  const results = [];

  for (const sub of subs) {
    try {
      const plan = await getActivePlan(sub.plan_id);
      const finalized = await _finalizeInvoiceForTenant(sub.tenant_id, sub, plan);
      await _openNextCycle(sub.tenant_id, sub, plan);
      results.push({
        tenantId: sub.tenant_id,
        success: true,
        finalized,
      });
    } catch (err) {
      results.push({ tenantId: sub.tenant_id, success: false, error: err.message });
    }
  }
  return results;
}

async function processOverdueInvoices() {
  const now = new Date();
  const overdueInvoices = await BillingInvoice.find({
    payment_status: "UNPAID",
    invoice_status: { $in: ["PENDING", "OVERDUE"] },
    due_date: { $lt: now },
    is_current_cycle: false,
  }).lean();

  const results = [];
  for (const inv of overdueInvoices) {
    await BillingInvoice.findByIdAndUpdate(inv._id, {
      $set: { invoice_status: "OVERDUE", payment_status: "UNPAID" },
    });

    await Tenant.updateOne(
      { tenantId: inv.tenant_id },
      { status: "SUSPENDED", isActive: false }
    );

    await TenantSubscription.updateMany(
      { tenant_id: inv.tenant_id, store_id: inv.store_id },
      { $set: { subscription_status: "SUSPENDED" } }
    );

    await Store.findOneAndUpdate(
      { tenantId: inv.tenant_id },
      { isOpen: false, manualOverride: true }
    );

    await notifyOverdue(inv.tenant_id, inv);
    await notifySuspensionWarning(inv.tenant_id);
    await notifySuspended(inv.tenant_id);

    results.push({ tenantId: inv.tenant_id, invoiceId: inv._id });
  }
  return results;
}

async function sendBillingReminders() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const results = [];

  const pending = await BillingInvoice.find({
    payment_status: "UNPAID",
    invoice_status: { $in: ["PENDING", "OVERDUE"] },
    is_current_cycle: false,
    total_amount: { $gt: 0 },
  }).lean();

  for (const inv of pending) {
    if (!inv.due_date) continue;
    const due = new Date(inv.due_date);
    const diffMs = due - startOfToday;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 3) {
      await notifyDueSoon(inv.tenant_id, inv, 3);
      results.push({ tenantId: inv.tenant_id, type: "3_DAY" });
    } else if (diffDays === 1) {
      await notifyDueSoon(inv.tenant_id, inv, 1);
      results.push({ tenantId: inv.tenant_id, type: "1_DAY" });
    } else if (diffDays <= 0 && inv.invoice_status !== "OVERDUE") {
      await notifyOverdue(inv.tenant_id, inv);
      results.push({ tenantId: inv.tenant_id, type: "OVERDUE_DAY" });
    }
  }
  return results;
}

/** Cancels stray unpaid invoices when the same billing month is already paid (Razorpay / mark-paid). */
async function cleanupStaleUnpaidDuplicates(tenantId) {
  const store_id = storeIdFor(tenantId);
  const paidInvoices = await BillingInvoice.find({
    tenant_id: tenantId,
    store_id,
    payment_status: "PAID",
  })
    .select("billing_month billing_year")
    .lean();

  for (const paid of paidInvoices) {
    const type = paid.invoice_type || INVOICE_TYPES.MONTHLY_SUBSCRIPTION;
    await BillingInvoice.updateMany(
      {
        tenant_id: tenantId,
        store_id,
        billing_month: paid.billing_month,
        billing_year: paid.billing_year,
        payment_status: { $ne: "PAID" },
        invoice_type: type,
      },
      { $set: { invoice_status: "CANCELLED", is_current_cycle: false } }
    );
  }
}

function inferPaymentMethod(paymentId) {
  if (!paymentId) return null;
  const id = String(paymentId);
  if (id.startsWith("pay_")) return "RAZORPAY";
  if (id.startsWith("super_")) return "SUPER_ADMIN_MANUAL";
  if (id.startsWith("manual_")) return "MANUAL";
  return "OTHER";
}

async function markAllUnpaidInvoicesPaid(tenantId, paymentId = null) {
  const store_id = storeIdFor(tenantId);
  const paidAt = new Date();
  const payRef = paymentId || `super_${Date.now()}`;

  const result = await BillingInvoice.updateMany(
    {
      tenant_id: tenantId,
      store_id,
      payment_status: { $ne: "PAID" },
      invoice_status: { $nin: ["PAID", "CANCELLED"] },
    },
    {
      $set: {
        invoice_status: "PAID",
        payment_status: "PAID",
        paid_at: paidAt,
        payment_id: payRef,
        payment_method: "SUPER_ADMIN_MANUAL",
      },
    }
  );

  if (result.matchedCount === 0) {
    throw new Error("Invoice not found");
  }

  return _finalizeMarkPaid(tenantId, store_id, paidAt);
}

async function markInvoicePaid(tenantId, invoiceId, paymentId = null, options = {}) {
  const store_id = storeIdFor(tenantId);
  const paidAt = new Date();
  const payRef = paymentId || `manual_${Date.now()}`;
  const payment_method =
    options.paymentMethod || inferPaymentMethod(payRef) || "MANUAL";

  const paidFields = {
    invoice_status: "PAID",
    payment_status: "PAID",
    paid_at: paidAt,
    payment_id: payRef,
    payment_method,
  };
  if (options.razorpayOrderId) {
    paidFields.razorpay_order_id = options.razorpayOrderId;
  }

  const invoice = await BillingInvoice.findOneAndUpdate(
    { _id: invoiceId, tenant_id: tenantId, store_id },
    { $set: paidFields },
    { new: true }
  );

  if (!invoice) throw new Error("Invoice not found");

  return _finalizeMarkPaid(tenantId, store_id, paidAt, invoice);
}

async function _finalizeMarkPaid(tenantId, store_id, paidAt, singleInvoice = null) {
  await BillingInvoice.updateMany(
    {
      tenant_id: tenantId,
      store_id,
      payment_status: "PAID",
      is_current_cycle: true,
    },
    { $set: { is_current_cycle: false } }
  );

  await syncSubscriptionToActiveCycle(tenantId);

  const latestPaid =
    singleInvoice ||
    (await BillingInvoice.findOne({
      tenant_id: tenantId,
      store_id,
      payment_status: "PAID",
    })
      .sort({ paid_at: -1, billing_year: -1, billing_month: -1 })
      .lean());

  const hasOverdue = await BillingInvoice.exists({
    tenant_id: tenantId,
    invoice_status: "OVERDUE",
    payment_status: { $ne: "PAID" },
  });

  await cleanupStaleUnpaidDuplicates(tenantId);

  if (!hasOverdue) {
    await Tenant.updateOne({ tenantId }, { status: "ACTIVE", isActive: true });
    await TenantSubscription.updateMany(
      { tenant_id: tenantId, subscription_status: "SUSPENDED" },
      { $set: { subscription_status: "ACTIVE" } }
    );
    await Store.findOneAndUpdate({ tenantId }, { manualOverride: false });
  }

  return latestPaid;
}

function formatPlanForApi(plan) {
  if (!plan) return null;
  const { resolveEffectivePricingModel } = require("./pricing.service");
  const effective = resolveEffectivePricingModel(plan);
  return {
    _id: plan._id,
    id: plan._id,
    plan_code: plan.plan_code,
    name: plan.name,
    description: plan.description,
    pricing_model: plan.pricing_model,
    pricingType: plan.pricing_model,
    effective_pricing_model: effective,
    monthly_price: plan.monthly_price,
    monthlyPrice: plan.monthly_price,
    included_orders: plan.included_orders,
    includedOrders: plan.included_orders,
    price_per_order: plan.price_per_order,
    pricePerOrder: plan.price_per_order,
    price_per_extra_order: plan.price_per_extra_order,
    pricePerExtraOrder: plan.price_per_extra_order,
    is_custom_plan: plan.is_custom_plan,
    is_active: plan.is_active,
    isActive: plan.is_active,
  };
}

function resolveDisplayCycleDates() {
  const current = billingPeriod();
  return {
    billingCycleStart: current.billing_start_date,
    billingCycleEnd: current.billing_end_date,
    billing_month: current.billing_month,
    billing_year: current.billing_year,
  };
}

function formatSubscriptionForApi(sub, plan, nextPlan = null) {
  if (!sub) return null;
  const cycle = resolveDisplayCycleDates();
  return {
    _id: sub._id,
    tenantId: sub.tenant_id,
    storeId: sub.store_id,
    subscription_unique_key: sub.subscription_unique_key,
    planId: formatPlanForApi(plan),
    plan_snapshot: sub.plan_snapshot,
    subscription_status: sub.subscription_status,
    status: sub.subscription_status,
    billingCycleStart: cycle.billingCycleStart,
    billingCycleEnd: cycle.billingCycleEnd,
    billing_start_date: cycle.billingCycleStart,
    billing_end_date: cycle.billingCycleEnd,
    billing_month: cycle.billing_month,
    billing_year: cycle.billing_year,
    next_billing_date: cycle.billingCycleEnd ? addDays(cycle.billingCycleEnd, 1) : sub.next_billing_date,
    due_date: sub.due_date,
    nextPlanId: nextPlan ? formatPlanForApi(nextPlan) : null,
    prorated_base_amount: sub.prorated_base_amount,
    prorated_amount: sub.prorated_amount ?? sub.prorated_base_amount,
    prepaid_amount: sub.prepaid_amount ?? sub.prorated_base_amount,
    effective_pricing_model: plan ? effectiveModel(plan) : null,
  };
}

function formatUsageForApi(usage, plan) {
  if (!usage) return null;
  const bill = calculateRunningBill(plan, usage, null);
  return {
    _id: usage._id,
    tenantId: usage.tenant_id,
    orders_used: usage.orders_used,
    ordersCount: usage.orders_used,
    extra_orders: usage.extra_orders,
    extraOrders: usage.extra_orders,
    subtotal: usage.subtotal,
    extra_charges: usage.extra_charges,
    per_order_charges: usage.per_order_charges,
    total_amount: usage.total_amount,
    totalAmount: bill,
    billing_month: usage.billing_month,
    billing_year: usage.billing_year,
  };
}

function formatPeriodLabel(month, year) {
  if (!month || !year) return null;
  const start = dateAtISTFromModule(year, month, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const end = dateAtISTFromModule(year, month, lastDay);
  const fmt = (d) =>
    d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

function dateAtISTFromModule(year, month1to12, day) {
  const iso = `${year}-${String(month1to12).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+05:30`;
  return new Date(iso);
}

function formatInvoiceForApi(invoice, plan) {
  if (!invoice) return null;
  const running =
    invoice.is_current_cycle && plan
      ? calculateRunningBill(plan, null, invoice)
      : invoice.total_amount;
  const rawStatus = invoice.invoice_status || "PENDING";
  const status =
    invoice.payment_status === "PAID" || rawStatus === "PAID" ? "PAID" : rawStatus;
  const periodStart = dateAtISTFromModule(invoice.billing_year, invoice.billing_month, 1);
  const lastDay = new Date(invoice.billing_year, invoice.billing_month, 0).getDate();
  const periodEnd = dateAtISTFromModule(
    invoice.billing_year,
    invoice.billing_month,
    lastDay
  );
  return {
    _id: invoice._id,
    tenantId: invoice.tenant_id,
    invoice_number: invoice.invoice_number,
    invoice_type: inferInvoiceType(invoice, plan),
    billing_month: invoice.billing_month,
    billing_year: invoice.billing_year,
    period_label: formatPeriodLabel(invoice.billing_month, invoice.billing_year),
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date,
    base_amount: invoice.base_amount,
    baseAmount: invoice.base_amount,
    extra_charges: invoice.extra_charges,
    extraCharges: invoice.extra_charges,
    per_order_charges: invoice.per_order_charges,
    perOrderCharges: invoice.per_order_charges,
    total_amount: running,
    totalAmount: running,
    invoice_status: status,
    status: status === "PAID" ? "PAID" : status,
    payment_status: invoice.payment_status,
    is_current_cycle: invoice.is_current_cycle,
    paid_at: invoice.paid_at,
    paidAt: invoice.paid_at,
    paymentId: invoice.payment_id,
    payment_id: invoice.payment_id,
    payment_method:
      invoice.payment_method || inferPaymentMethod(invoice.payment_id),
    razorpay_order_id: invoice.razorpay_order_id || null,
    razorpayOrderId: invoice.razorpay_order_id || null,
    subscription_id: invoice.subscription_id,
    plan_snapshot: invoice.plan_snapshot,
    created_at: invoice.created_at,
    updated_at: invoice.updated_at,
    billingCycleStart: periodStart,
    billingCycleEnd: periodEnd,
  };
}

async function getUsageCycleInvoice(tenantId, plan) {
  const store_id = storeIdFor(tenantId);
  return findCurrentCycleInvoice(tenantId, store_id, plan);
}

async function syncPrepaidInvoiceCharge(tenantId, invoice) {
  if (!invoice || invoice.invoice_type !== INVOICE_TYPES.MONTHLY_SUBSCRIPTION) {
    return Number(invoice?.total_amount) || 0;
  }
  const sub = await TenantSubscription.findById(invoice.subscription_id).lean();
  const plan = sub ? await getActivePlan(sub.plan_id) : null;
  if (!plan) return Number(invoice.total_amount) || 0;
  const charge = resolvePrepaidChargeAmount(plan, new Date());
  if (charge !== Number(invoice.total_amount)) {
    await BillingInvoice.findByIdAndUpdate(invoice._id, {
      $set: { base_amount: charge, total_amount: charge },
    });
  }
  return charge;
}

module.exports = {
  seedDefaultPlansIfEmpty,
  syncSubscriptionToActiveCycle,
  syncPrepaidInvoiceCharge,
  getPayableInvoice,
  getUsageCycleInvoice,
  getOrCreateSubscription,
  getCurrentUsageAndInvoice,
  recordOrderBilling,
  reverseOrderBilling,
  schedulePlanChange,
  activatePlanNow,
  generateMonthlyBilling,
  processOverdueInvoices,
  sendBillingReminders,
  markInvoicePaid,
  markAllUnpaidInvoicesPaid,
  cleanupStaleUnpaidDuplicates,
  formatPlanForApi,
  formatSubscriptionForApi,
  formatUsageForApi,
  formatInvoiceForApi,
  isLastDayOfMonth,
  storeIdFor,
};
