const crypto = require("crypto");
const PaymentPlan = require("../models/PaymentPlan.model");
const BillingInvoice = require("../models/BillingInvoice.model");
const Notification = require("../../../models/Notification.model");
const billing = require("../services/billing.service");
const invoiceDocument = require("../services/invoiceDocument.service");
const Tenant = require("../../../models/Tenant.model");
const Store = require("../../../models/Store.model");
const { getRazorpayClient } = require("../utils/razorpayClient.util");

exports.getPlans = async (req, res) => {
  try {
    await billing.seedDefaultPlansIfEmpty();
    const tenantId = req.user?.tenantId;
    const { tenantPlanVisibilityFilter } = require("../utils/enterprisePlan.util");
    const filter = tenantId ? tenantPlanVisibilityFilter(tenantId) : { is_active: true };
    const plans = await PaymentPlan.find(filter).sort({ monthly_price: 1 }).lean();
    res.json({ success: true, data: plans.map(billing.formatPlanForApi) });
  } catch (err) {
    console.error("[billing/getPlans]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getSubscription = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { subscription, plan } = await billing.getOrCreateSubscription(tenantId, req.user.userId);
    const { usage, invoice } = await billing.getCurrentUsageAndInvoice(tenantId);
    let nextPlan = null;
    if (subscription.next_plan_id) {
      nextPlan = await PaymentPlan.findById(subscription.next_plan_id).lean();
    }
    res.json({
      success: true,
      data: billing.formatSubscriptionForApi(subscription, plan, nextPlan),
    });
  } catch (err) {
    console.error("[billing/getSubscription]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getUsage = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { usage, subscription } = await billing.getCurrentUsageAndInvoice(tenantId);
    const plan = subscription
      ? await PaymentPlan.findById(subscription.plan_id).lean()
      : null;
    res.json({ success: true, data: billing.formatUsageForApi(usage, plan) });
  } catch (err) {
    console.error("[billing/getUsage]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getCurrentInvoice = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { invoice, prepaidInvoice, subscription } =
      await billing.getCurrentUsageAndInvoice(tenantId);
    const plan = subscription
      ? await PaymentPlan.findById(subscription.plan_id).lean()
      : null;
    res.json({
      success: true,
      data: billing.formatInvoiceForApi(invoice, plan),
      prepaidInvoice: prepaidInvoice
        ? billing.formatInvoiceForApi(prepaidInvoice, plan)
        : null,
    });
  } catch (err) {
    console.error("[billing/getCurrentInvoice]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getInvoiceHistory = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const store_id = billing.storeIdFor(tenantId);
    const invoices = await BillingInvoice.find({
      tenant_id: tenantId,
      store_id,
      $or: [{ is_current_cycle: false }, { payment_status: "PAID" }, { invoice_status: "PAID" }],
    })
      .sort({ billing_year: -1, billing_month: -1, paid_at: -1, created_at: -1 })
      .limit(36)
      .lean();

    res.json({
      success: true,
      data: invoices.map((inv) => billing.formatInvoiceForApi(inv, null)),
    });
  } catch (err) {
    console.error("[billing/getInvoiceHistory]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.downloadInvoiceAudit = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const audit = await invoiceDocument.buildInvoiceAuditPayload(tenantId, req.params.id);
    if (!audit) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const pdfBuffer = await invoiceDocument.generateBillingAuditPdfBuffer(audit);
    const safeName = String(audit.invoice.invoiceNumber || "invoice").replace(/[^\w.-]+/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}-audit.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("[billing/downloadInvoiceAudit]", err);
    res.status(500).json({ success: false, message: "Failed to generate invoice PDF" });
  }
};

exports.exportInvoiceHistoryCsv = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const store_id = billing.storeIdFor(tenantId);
    const invoices = await BillingInvoice.find({
      tenant_id: tenantId,
      store_id,
      $or: [{ is_current_cycle: false }, { payment_status: "PAID" }, { invoice_status: "PAID" }],
    })
      .sort({ billing_year: -1, billing_month: -1, paid_at: -1, created_at: -1 })
      .limit(120)
      .lean();

    const [tenant, store] = await Promise.all([
      Tenant.findOne({ tenantId }).lean(),
      Store.findOne({ tenantId }).lean(),
    ]);

    const rows = await invoiceDocument.buildCsvRowsFromInvoices(
      tenantId,
      invoices,
      tenant,
      store
    );
    const csv = invoiceDocument.buildCsvExport(rows);
    const slug = String(tenant?.name || tenantId).replace(/[^\w.-]+/g, "_");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${slug}-billing-invoices-audit.csv"`
    );
    res.send("\uFEFF" + csv);
  } catch (err) {
    console.error("[billing/exportInvoiceHistoryCsv]", err);
    res.status(500).json({ success: false, message: "Failed to export invoices" });
  }
};

exports.getBillingNotifications = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const notifications = await Notification.find({
      tenantId,
      userId,
      type: { $regex: /^BILLING/ },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ success: true, data: notifications });
  } catch (err) {
    console.error("[billing/getNotifications]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId, userId: req.user.userId },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.changePlan = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: "planId required" });

    const { subscription, plan } = await billing.schedulePlanChange(req.user.tenantId, planId);
    const currentPlan = await PaymentPlan.findById(subscription.plan_id).lean();
    res.json({
      success: true,
      message: `Plan change to "${plan.name}" scheduled for next billing cycle`,
      data: billing.formatSubscriptionForApi(subscription, currentPlan, plan),
    });
  } catch (err) {
    console.error("[billing/changePlan]", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

exports.createInvoicePayment = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const invoice = await BillingInvoice.findOne({ _id: req.params.id, tenant_id: tenantId });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    if (invoice.payment_status === "PAID") {
      return res.status(400).json({ success: false, message: "Invoice already paid" });
    }

    const chargeAmount = await billing.syncPrepaidInvoiceCharge(tenantId, invoice);
    if (!chargeAmount || chargeAmount <= 0) {
      return res.status(400).json({ success: false, message: "Nothing to pay" });
    }

    const tenant = await Tenant.findOne({ tenantId }).lean();
    const merchantName = tenant?.name || tenantId;

    const order = await getRazorpayClient().orders.create({
      amount: Math.round(chargeAmount * 100),
      currency: "INR",
      receipt: `inv_${invoice._id}`,
      notes: {
        tenantId: String(tenantId),
        invoiceId: String(invoice._id),
        storeName: merchantName,
      },
    });
    res.json({
      success: true,
      data: { order, amount: chargeAmount, merchantName },
    });
  } catch (err) {
    console.error("[billing/createInvoicePayment]", err);
    res.status(500).json({ success: false, message: "Failed to create payment order" });
  }
};

exports.verifyInvoicePayment = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, invoiceId } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment fields" });
    }

    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment signature invalid" });
    }

    const invoice = await billing.markInvoicePaid(tenantId, invoiceId, razorpay_payment_id, {
      paymentMethod: "RAZORPAY",
      razorpayOrderId: razorpay_order_id,
    });
    res.json({
      success: true,
      message: "Payment verified",
      data: billing.formatInvoiceForApi(invoice, null),
    });
  } catch (err) {
    console.error("[billing/verifyInvoicePayment]", err);
    res.status(500).json({ success: false, message: "Payment verification failed" });
  }
};

exports.initiatePlanPayment = async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: "planId required" });

    const plan = await PaymentPlan.findById(planId).lean();
    if (!plan || !plan.is_active) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }
    if (plan.pricing_model === "PER_ORDER" || plan.monthly_price <= 0) {
      return res.status(400).json({ success: false, message: "Plan does not require payment" });
    }

    const tenantId = req.user.tenantId;
    const { resolvePrepaidChargeAmount } = require("../utils/billingModel.util");
    await billing.getOrCreateSubscription(tenantId);
    const amount = resolvePrepaidChargeAmount(plan, new Date());

    const tenant = await Tenant.findOne({ tenantId }).lean();
    const merchantName = tenant?.name || tenantId;

    const order = await getRazorpayClient().orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `plan_${tenantId}_${Date.now()}`,
      notes: {
        tenantId: String(tenantId),
        planId: String(plan._id),
        purpose: "plan_activation",
        storeName: merchantName,
      },
    });

    res.json({
      success: true,
      data: {
        order,
        plan: billing.formatPlanForApi(plan),
        amount,
        merchantName,
      },
    });
  } catch (err) {
    console.error("[billing/initiatePlanPayment]", err);
    res.status(500).json({ success: false, message: "Failed to create payment order" });
  }
};

exports.activatePlanNow = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment signature invalid" });
    }

    const { subscription, plan } = await billing.activatePlanNow(
      req.user.tenantId,
      planId,
      req.user.userId
    );

    const { billing_month, billing_year } = require("../utils/cycleDates.util").billingPeriod();
    const prepaidInv = await BillingInvoice.findOne({
      tenant_id: req.user.tenantId,
      billing_month,
      billing_year,
      invoice_type: "MONTHLY_SUBSCRIPTION",
      payment_status: { $ne: "PAID" },
    });
    if (prepaidInv) {
      await billing.markInvoicePaid(req.user.tenantId, prepaidInv._id, razorpay_payment_id, {
        paymentMethod: "RAZORPAY",
        razorpayOrderId: razorpay_order_id,
      });
    }

    res.json({
      success: true,
      message: `Plan activated: ${plan.name}`,
      data: billing.formatSubscriptionForApi(subscription, plan, null),
    });
  } catch (err) {
    console.error("[billing/activatePlanNow]", err);
    res.status(500).json({ success: false, message: err.message || "Plan activation failed" });
  }
};

exports.payInvoicePlaceholder = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const invoice = await billing.markInvoicePaid(
      tenantId,
      req.params.id,
      `manual_${Date.now()}`
    );
    res.json({
      success: true,
      message: "Invoice marked paid (placeholder)",
      data: billing.formatInvoiceForApi(invoice, null),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
