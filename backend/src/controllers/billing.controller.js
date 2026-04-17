const Razorpay          = require("razorpay");
const crypto            = require("crypto");
const Plan              = require("../models/Plan.model");
const StoreSubscription = require("../models/StoreSubscription.model");
const StoreUsage        = require("../models/StoreUsage.model");
const Invoice           = require("../models/Invoice.model");

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
const {
  seedPlans,
  getOrCreateSubscription,
  generateMonthlyBilling,
} = require("../services/billing.service");

/* ── GET /api/billing/plans ────────────────────────────────────── */
exports.getPlans = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    await seedPlans(tenantId);

    // Build list of plan names visible to this tenant
    const plansConfig = require("../config/plans.config.json");
    const defaultNames  = (plansConfig.defaultPlans || []).map((p) => p.name);
    const tenantNames   = ((plansConfig.tenantOverrides || {})[String(tenantId)] || []).map((p) => p.name);
    const visibleNames  = [...new Set([...defaultNames, ...tenantNames])];

    const plans = await Plan.find({ name: { $in: visibleNames }, isActive: true }).sort({ monthlyPrice: 1 });
    res.json({ success: true, data: plans });
  } catch (err) {
    console.error("getPlans error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── GET /api/billing/subscription ─────────────────────────────── */
exports.getSubscription = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    await seedPlans(tenantId);
    const sub = await getOrCreateSubscription(tenantId);
    res.json({ success: true, data: sub });
  } catch (err) {
    console.error("getSubscription error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── GET /api/billing/usage ─────────────────────────────────────── */
exports.getUsage = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const sub = await StoreSubscription.findOne({ tenantId, status: "ACTIVE" });
    if (!sub) return res.json({ success: true, data: null });

    const usage = await StoreUsage.findOne({
      tenantId,
      billingCycleStart: sub.billingCycleStart,
    });
    res.json({ success: true, data: usage });
  } catch (err) {
    console.error("getUsage error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── GET /api/billing/invoice/current ──────────────────────────── */
exports.getCurrentInvoice = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const sub = await StoreSubscription.findOne({ tenantId, status: "ACTIVE" });
    if (!sub) return res.json({ success: true, data: null });

    const invoice = await Invoice.findOne({
      tenantId,
      billingCycleStart: sub.billingCycleStart,
    });
    res.json({ success: true, data: invoice });
  } catch (err) {
    console.error("getCurrentInvoice error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── POST /api/billing/generate ────────────────────────────────── */
exports.triggerBillingGeneration = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    // If tenantId provided → single store; otherwise → all active stores
    const targetTenant = req.body.tenantId || null;
    const result = await generateMonthlyBilling(targetTenant);

    res.json({ success: true, result });
  } catch (err) {
    console.error("triggerBillingGeneration error:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

/* ── PUT /api/billing/subscription/plan ───────────────────────── */
/* Schedule a plan change for the next billing cycle               */
exports.changePlan = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }

    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({ success: false, message: "planId required" });
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    const tenantId = req.user.tenantId;
    const sub = await StoreSubscription.findOneAndUpdate(
      { tenantId, status: "ACTIVE" },
      { $set: { nextPlanId: plan._id } },
      { new: true }
    ).populate("planId").populate("nextPlanId");

    if (!sub) {
      return res.status(404).json({ success: false, message: "No active subscription" });
    }

    res.json({
      success: true,
      message: `Plan change to "${plan.name}" scheduled for next billing cycle`,
      data: sub,
    });
  } catch (err) {
    console.error("changePlan error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── POST /api/billing/invoice/:id/pay ─────────────────────────── */
exports.createInvoicePayment = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const invoice  = await Invoice.findOne({ _id: req.params.id, tenantId });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    if (invoice.status === "PAID") return res.status(400).json({ success: false, message: "Invoice already paid" });
    if (!invoice.totalAmount || invoice.totalAmount <= 0) {
      return res.status(400).json({ success: false, message: "Nothing to pay" });
    }

    const order = await razorpay.orders.create({
      amount:   Math.round(invoice.totalAmount * 100), // paise
      currency: "INR",
      receipt:  `inv_${invoice._id}`,
      notes:    { tenantId: String(tenantId), invoiceId: String(invoice._id) },
    });

    res.json({ success: true, data: order });
  } catch (err) {
    console.error("createInvoicePayment error:", err);
    res.status(500).json({ success: false, message: "Failed to create payment order" });
  }
};

/* ── POST /api/billing/invoice/:id/verify ──────────────────────── */
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

    const invoice = await Invoice.findOneAndUpdate(
      { _id: invoiceId, tenantId },
      { $set: { status: "PAID", paidAt: new Date(), paymentId: razorpay_payment_id } },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    res.json({ success: true, message: "Payment verified", data: invoice });
  } catch (err) {
    console.error("verifyInvoicePayment error:", err);
    res.status(500).json({ success: false, message: "Payment verification failed" });
  }
};

/* ── POST /api/billing/plan/initiate-payment ───────────────────── */
/* Creates a Razorpay order for immediately activating a new plan  */
exports.initiatePlanPayment = async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: "planId required" });

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) return res.status(404).json({ success: false, message: "Plan not found" });
    if (plan.pricingType !== "SUBSCRIPTION" || plan.monthlyPrice <= 0) {
      return res.status(400).json({ success: false, message: "Plan does not require payment" });
    }

    const tenantId = req.user.tenantId;
    const order = await razorpay.orders.create({
      amount:   Math.round(plan.monthlyPrice * 100), // paise
      currency: "INR",
      receipt:  `plan_${tenantId}_${Date.now()}`,
      notes:    { tenantId: String(tenantId), planId: String(plan._id), purpose: "plan_activation" },
    });

    res.json({ success: true, data: { order, plan } });
  } catch (err) {
    console.error("initiatePlanPayment error:", err);
    res.status(500).json({ success: false, message: "Failed to create payment order" });
  }
};

/* ── POST /api/billing/plan/activate ──────────────────────────── */
/* Verifies payment and immediately activates the new plan         */
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

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    const tenantId      = req.user.tenantId;
    const cycleStart    = new Date();
    const cycleEnd      = new Date();
    cycleEnd.setDate(cycleEnd.getDate() + 30);

    // Immediately switch plan and reset billing cycle
    const sub = await StoreSubscription.findOneAndUpdate(
      { tenantId, status: "ACTIVE" },
      {
        $set: {
          planId:             plan._id,
          nextPlanId:         null,
          billingCycleStart:  cycleStart,
          billingCycleEnd:    cycleEnd,
        },
      },
      { new: true }
    ).populate("planId").populate("nextPlanId");

    if (!sub) return res.status(404).json({ success: false, message: "No active subscription" });

    // Reset usage for new cycle
    await StoreUsage.findOneAndUpdate(
      { tenantId, billingCycleStart: cycleStart },
      {
        $setOnInsert: {
          planId:           plan._id,
          billingCycleEnd:  cycleEnd,
          ordersCount:      0,
          extraOrders:      0,
          totalAmount:      0,
          lastUpdated:      new Date(),
        },
      },
      { upsert: true, new: true }
    );

    // Create a PAID invoice for this activation payment
    await Invoice.findOneAndUpdate(
      { tenantId, billingCycleStart: cycleStart },
      {
        $setOnInsert: {
          billingCycleEnd:  cycleEnd,
          baseAmount:       plan.monthlyPrice,
          extraCharges:     0,
          perOrderCharges:  0,
          totalAmount:      plan.monthlyPrice,
          status:           "PAID",
          paidAt:           new Date(),
          paymentId:        razorpay_payment_id,
          planSnapshot:     plan.toObject(),
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: `Plan activated: ${plan.name}`, data: sub });
  } catch (err) {
    console.error("activatePlanNow error:", err);
    res.status(500).json({ success: false, message: "Plan activation failed" });
  }
};
