const PaymentPlan = require("../models/PaymentPlan.model");
const BillingInvoice = require("../models/BillingInvoice.model");
const BillingUsage = require("../models/BillingUsage.model");
const TenantSubscription = require("../models/TenantSubscription.model");
const Tenant = require("../../../models/Tenant.model");
const billing = require("../services/billing.service");
const { buildPlanSnapshot } = require("../utils/planSnapshot.util");
const {
  getEnterprisePlanForTenant,
  getOrCreateEnterprisePlanForTenant,
} = require("../utils/enterprisePlan.util");
const { resolveEffectivePricingModel } = require("../services/pricing.service");

exports.createPlan = async (req, res) => {
  try {
    const body = req.body;
    if (!body.plan_code || !body.name || !body.pricing_model) {
      return res.status(400).json({
        success: false,
        message: "plan_code, name, and pricing_model are required",
      });
    }

    const plan = await PaymentPlan.create({
      ...body,
      plan_code: String(body.plan_code).toUpperCase().trim(),
      created_by: req.superAdmin?.email || "SUPER_ADMIN",
      updated_by: req.superAdmin?.email || "SUPER_ADMIN",
    });

    res.status(201).json({ success: true, data: billing.formatPlanForApi(plan) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "plan_code already exists" });
    }
    console.error("[superBilling/createPlan]", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const allowed = [
      "name",
      "description",
      "pricing_model",
      "monthly_price",
      "included_orders",
      "price_per_order",
      "price_per_extra_order",
      "is_custom_plan",
      "is_active",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_by = req.superAdmin?.email || "SUPER_ADMIN";

    const plan = await PaymentPlan.findByIdAndUpdate(req.params.id, { $set: updates }, {
      new: true,
      runValidators: true,
    });
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
    res.json({ success: true, data: billing.formatPlanForApi(plan) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.disablePlan = async (req, res) => {
  try {
    const plan = await PaymentPlan.findByIdAndUpdate(
      req.params.id,
      { $set: { is_active: false, updated_by: req.superAdmin?.email || "SUPER_ADMIN" } },
      { new: true }
    );
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
    res.json({ success: true, data: billing.formatPlanForApi(plan) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.listPlans = async (req, res) => {
  try {
    await billing.seedDefaultPlansIfEmpty();
    const plans = await PaymentPlan.find().sort({ created_at: -1 }).lean();
    res.json({ success: true, data: plans.map(billing.formatPlanForApi) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.assignTenantPlan = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    const planId = req.body.planId;
    const planCode = req.body.plan || req.body.plan_code;
    let plan = null;
    if (planId) plan = await PaymentPlan.findById(planId);
    else if (planCode) plan = await PaymentPlan.findOne({ plan_code: String(planCode).toUpperCase() });

    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    const selectedCode = String(planCode || plan.plan_code || "").toUpperCase();
    let tenantPlanLabel = selectedCode;

    if (selectedCode === "ENTERPRISE") {
      plan = await getOrCreateEnterprisePlanForTenant(tenant.tenantId, tenant.name);
      const hasRates =
        Number(plan.price_per_order) > 0 ||
        Number(plan.monthly_price) > 0 ||
        Number(plan.included_orders) > 0;
      if (!hasRates) {
        return res.status(400).json({
          success: false,
          message:
            "Configure enterprise pricing for this store first (per-order rate, monthly fee, or included orders).",
          requiresEnterpriseConfig: true,
          tenantId: tenant._id,
        });
      }
      tenantPlanLabel = "ENTERPRISE";
    }

    await billing.activatePlanNow(tenant.tenantId, plan._id);
    await Tenant.findByIdAndUpdate(tenant._id, { plan: tenantPlanLabel });

    res.json({ success: true, tenant, plan: billing.formatPlanForApi(plan) });
  } catch (err) {
    console.error("[superBilling/assignTenantPlan]", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

function normalizeInvoiceForDashboard(inv) {
  if (!inv) return null;
  const paymentStatus =
    inv.payment_status === "PAID" || inv.invoice_status === "PAID"
      ? "PAID"
      : inv.payment_status || "UNPAID";
  const status =
    paymentStatus === "PAID" ? "PAID" : inv.invoice_status || inv.status || "PENDING";
  const month = inv.billing_month;
  const year = inv.billing_year;
  const periodLabel =
    month && year
      ? `${String(month).padStart(2, "0")}/${year}`
      : null;
  return {
    ...inv,
    _id: inv._id,
    status,
    invoice_status: status,
    payment_status: paymentStatus,
    totalAmount: inv.total_amount ?? inv.totalAmount ?? 0,
    total_amount: inv.total_amount ?? inv.totalAmount ?? 0,
    paidAt: inv.paid_at || inv.paidAt || null,
    paid_at: inv.paid_at || inv.paidAt || null,
    is_current_cycle: !!inv.is_current_cycle,
    invoice_number: inv.invoice_number || null,
    billing_month: month,
    billing_year: year,
    period_label: periodLabel,
    due_date: inv.due_date || null,
  };
}

function isInvoiceUnpaid(inv) {
  return (
    inv.payment_status !== "PAID" &&
    inv.invoice_status !== "PAID" &&
    inv.invoice_status !== "CANCELLED"
  );
}

function hasPaidInvoiceForPeriod(invoices, inv) {
  return invoices.some(
    (other) =>
      other.payment_status === "PAID" &&
      other.billing_month === inv.billing_month &&
      other.billing_year === inv.billing_year
  );
}

function pickDisplayInvoice(invoices) {
  if (!invoices.length) return null;

  const unpaidList = invoices.filter(isInvoiceUnpaid);

  const overdueUnpaid = unpaidList.find((inv) => inv.invoice_status === "OVERDUE");
  if (overdueUnpaid) return overdueUnpaid;

  const pastUnpaid = unpaidList.find(
    (inv) => !inv.is_current_cycle && Number(inv.total_amount) > 0
  );
  if (pastUnpaid) return pastUnpaid;

  const prepaidUnpaid = unpaidList.find(
    (inv) =>
      inv.invoice_type === "MONTHLY_SUBSCRIPTION" && Number(inv.total_amount) > 0
  );
  if (prepaidUnpaid) return prepaidUnpaid;

  const currentUnpaid = unpaidList.find((inv) => {
    if (!inv.is_current_cycle && inv.invoice_type !== "EXTRA_USAGE") return false;
    if (hasPaidInvoiceForPeriod(invoices, inv)) return false;
    return Number(inv.total_amount) > 0;
  });
  if (currentUnpaid) return currentUnpaid;

  const anyUnpaid = unpaidList.find(
    (inv) => Number(inv.total_amount) > 0 && !hasPaidInvoiceForPeriod(invoices, inv)
  );
  if (anyUnpaid) return anyUnpaid;

  const paidSorted = invoices
    .filter((inv) => inv.payment_status === "PAID" || inv.invoice_status === "PAID")
    .sort((a, b) => new Date(b.paid_at || 0) - new Date(a.paid_at || 0));
  if (paidSorted.length) return paidSorted[0];

  return invoices[0];
}

exports.getBillingOverview = async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const tenants = await Tenant.find({}).select("tenantId").lean();
    const tenantIds = tenants.map((t) => t.tenantId);

    const allInvoices = await BillingInvoice.find({
      tenant_id: { $in: tenantIds },
    })
      .sort({ billing_year: -1, billing_month: -1, created_at: -1 })
      .lean();

    const byTenantInvoices = {};
    for (const inv of allInvoices) {
      if (!byTenantInvoices[inv.tenant_id]) byTenantInvoices[inv.tenant_id] = [];
      byTenantInvoices[inv.tenant_id].push(inv);
    }

    const revenueAgg = await BillingInvoice.aggregate([
      {
        $match: {
          tenant_id: { $in: tenantIds },
          payment_status: "PAID",
          paid_at: { $gte: since },
        },
      },
      { $group: { _id: "$tenant_id", revenue: { $sum: "$total_amount" } } },
    ]);
    const revenueMap = {};
    revenueAgg.forEach((r) => {
      revenueMap[r._id] = r.revenue;
    });

    for (const tenantId of tenantIds) {
      await billing.cleanupStaleUnpaidDuplicates(tenantId);
    }

    const refreshedInvoices = await BillingInvoice.find({
      tenant_id: { $in: tenantIds },
    })
      .sort({ billing_year: -1, billing_month: -1, created_at: -1 })
      .lean();

    const refreshedByTenant = {};
    for (const inv of refreshedInvoices) {
      if (!refreshedByTenant[inv.tenant_id]) refreshedByTenant[inv.tenant_id] = [];
      refreshedByTenant[inv.tenant_id].push(inv);
    }

    const data = tenantIds.map((tenantId) => {
      const list = refreshedByTenant[tenantId] || [];
      const picked = pickDisplayInvoice(list);
      return {
        tenantId,
        invoice: normalizeInvoiceForDashboard(picked),
        revenue: revenueMap[tenantId] || 0,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markInvoicePaid = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const updated = await billing.markAllUnpaidInvoicesPaid(
      tenant.tenantId,
      body.paymentId || `super_${Date.now()}`
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "No unpaid invoice" });
    }

    res.json({
      success: true,
      invoice: normalizeInvoiceForDashboard(updated),
      message: "All outstanding invoices marked as paid",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEnterprisePlanForTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id).lean();
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    let plan = await getEnterprisePlanForTenant(tenant.tenantId);
    if (!plan) {
      plan = (await getOrCreateEnterprisePlanForTenant(tenant.tenantId, tenant.name)).toObject();
    }

    const formatted = billing.formatPlanForApi(plan);
    formatted.effective_pricing_model = resolveEffectivePricingModel(plan);
    res.json({ success: true, data: formatted, tenantId: tenant.tenantId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateEnterprisePlanForTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    const {
      description,
      monthly_price,
      included_orders,
      price_per_order,
      price_per_extra_order,
      assign_now,
    } = req.body;

    let plan = await getOrCreateEnterprisePlanForTenant(tenant.tenantId, tenant.name);

    const updates = {
      description:
        description !== undefined ? String(description) : plan.description,
      monthly_price:
        monthly_price !== undefined ? Number(monthly_price) : plan.monthly_price,
      included_orders:
        included_orders === null || included_orders === ""
          ? null
          : included_orders !== undefined
            ? Number(included_orders)
            : plan.included_orders,
      price_per_order:
        price_per_order !== undefined ? Number(price_per_order) : plan.price_per_order,
      price_per_extra_order:
        price_per_extra_order !== undefined
          ? Number(price_per_extra_order)
          : plan.price_per_extra_order,
      pricing_model: "ENTERPRISE",
      is_custom_plan: true,
      is_active: true,
      updated_by: "SUPER_ADMIN",
    };

    plan = await PaymentPlan.findByIdAndUpdate(plan._id, { $set: updates }, { new: true });

    const store_id = billing.storeIdFor(tenant.tenantId);
    const sub = await TenantSubscription.findOne({
      tenant_id: tenant.tenantId,
      store_id,
      subscription_status: "ACTIVE",
    });

    if (sub) {
      await TenantSubscription.findByIdAndUpdate(sub._id, {
        $set: { plan_id: plan._id, plan_snapshot: buildPlanSnapshot(plan) },
      });
    } else if (assign_now) {
      await billing.activatePlanNow(tenant.tenantId, plan._id);
    }

    await Tenant.updateOne({ tenantId: tenant.tenantId }, { plan: "ENTERPRISE" });

    const formatted = billing.formatPlanForApi(plan);
    formatted.effective_pricing_model = resolveEffectivePricingModel(plan);
    res.json({ success: true, plan: formatted, tenant: { tenantId: tenant.tenantId, plan: "ENTERPRISE" } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
