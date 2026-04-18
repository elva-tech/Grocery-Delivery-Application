const jwt               = require("jsonwebtoken");
const bcrypt            = require("bcryptjs");
const Tenant            = require("../models/Tenant.model");
const User              = require("../models/User.model");
const Plan              = require("../models/Plan.model");
const StoreSubscription = require("../models/StoreSubscription.model");
const StoreUsage        = require("../models/StoreUsage.model");
const Invoice           = require("../models/Invoice.model");
const Store             = require("../models/Store.model");

const VALID_PLANS    = ["FREE", "BASIC", "PREMIUM", "ENTERPRISE"];
const VALID_STATUSES = ["ACTIVE", "SUSPENDED", "INACTIVE"];

/* ─────────────────────────────────────────────
   POST /api/super/login
   Credentials sourced from env: SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD
───────────────────────────────────────────── */
exports.login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  const superEmail    = process.env.SUPER_ADMIN_EMAIL;
  const superPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!superEmail || !superPassword) {
    return res.status(500).json({ success: false, message: "Super admin credentials not configured on server" });
  }

  if (email !== superEmail || password !== superPassword) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { role: "SUPER_ADMIN", email },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return res.json({ success: true, token });
};

/* ─────────────────────────────────────────────
   GET /api/super/tenants
───────────────────────────────────────────── */
exports.getTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find({})
      .sort({ createdAt: -1 })
      .select("tenantId name ownerName phoneNumber plan status isActive createdAt logo storeAddress contactEmail customerDomain adminDomain")
      .lean();

    return res.json({ success: true, tenants });
  } catch (err) {
    console.error("[super/getTenants]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────
   PATCH /api/super/tenant/:id/plan
   Body: { plan: "FREE" | "BASIC" | "PREMIUM" | "ENTERPRISE" }
───────────────────────────────────────────── */
exports.updatePlan = async (req, res) => {
  try {
    const { id }   = req.params;
    const { plan } = req.body;

    if (!VALID_PLANS.includes(plan)) {
      return res.status(400).json({
        success: false,
        message: `plan must be one of: ${VALID_PLANS.join(", ")}`,
      });
    }

    const tenant = await Tenant.findByIdAndUpdate(id, { plan }, { new: true });
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    // Sync the billing StoreSubscription to match the new plan label
    // — also resets the billing cycle and invoice so the store sees correct data immediately
    try {
      const dbPlan = await Plan.findOne({ name: plan, isActive: true });
      if (dbPlan) {
        const now        = new Date();
        const cycleStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const cycleEnd   = new Date(cycleStart);
        cycleEnd.setDate(cycleEnd.getDate() + 30);
        cycleEnd.setHours(23, 59, 59, 999);

        await StoreSubscription.findOneAndUpdate(
          { tenantId: tenant.tenantId, status: "ACTIVE" },
          { $set: { planId: dbPlan._id, nextPlanId: null, billingCycleStart: cycleStart, billingCycleEnd: cycleEnd } }
        );

        await StoreUsage.findOneAndUpdate(
          { tenantId: tenant.tenantId, billingCycleStart: cycleStart },
          { $set: { planId: dbPlan._id, billingCycleEnd: cycleEnd, ordersCount: 0, extraOrders: 0, totalAmount: 0, lastUpdated: now } },
          { upsert: true }
        );

        const baseAmount = dbPlan.pricingType === "SUBSCRIPTION" ? dbPlan.monthlyPrice : 0;
        await Invoice.findOneAndUpdate(
          { tenantId: tenant.tenantId, billingCycleStart: cycleStart },
          { $set: { billingCycleEnd: cycleEnd, baseAmount, extraCharges: 0, perOrderCharges: 0, totalAmount: baseAmount, status: "PENDING" } },
          { upsert: true }
        );
      }
    } catch (syncErr) {
      console.error("[super/updatePlan] billing sync failed:", syncErr.message);
    }

    return res.json({ success: true, tenant });
  } catch (err) {
    console.error("[super/updatePlan]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────
   PATCH /api/super/tenant/:id/status
   Body: { status: "ACTIVE" | "SUSPENDED" | "INACTIVE" }
───────────────────────────────────────────── */
exports.updateStatus = async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const isActive = status === "ACTIVE";

    const tenant = await Tenant.findByIdAndUpdate(
      id,
      { status, isActive },
      { new: true }
    );
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    // Mirror suspension into the Store so the public /api/store/status reflects it
    if (status === "SUSPENDED") {
      await Store.findOneAndUpdate(
        { tenantId: tenant.tenantId },
        { isOpen: false, manualOverride: true }
      );
    } else if (status === "ACTIVE") {
      // Restore manual control to the admin (open store, clear suspension lock)
      await Store.findOneAndUpdate(
        { tenantId: tenant.tenantId },
        { isOpen: true, manualOverride: false }
      );
    }

    return res.json({ success: true, tenant });
  } catch (err) {
    console.error("[super/updateStatus]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────
   PATCH /api/super/tenant/:id/details
   Updates editable store fields. Password change is optional.
───────────────────────────────────────────── */
exports.updateTenantDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { storeName, ownerName, phoneNumber, storeAddress, contactEmail, logo, newPassword } = req.body;

    if (!storeName || !storeName.trim()) {
      return res.status(400).json({ success: false, message: "storeName is required" });
    }
    if (!ownerName || ownerName.trim().length < 2) {
      return res.status(400).json({ success: false, message: "ownerName must be at least 2 characters" });
    }
    if (!phoneNumber || !/^\d{10}$/.test(String(phoneNumber).trim())) {
      return res.status(400).json({ success: false, message: "phoneNumber must be exactly 10 digits" });
    }
    if (contactEmail && contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      return res.status(400).json({ success: false, message: "contactEmail format is invalid" });
    }
    if (newPassword !== undefined && newPassword !== '' && newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const tenantUpdates = {
      name:         storeName.trim(),
      ownerName:    ownerName.trim(),
      phoneNumber:  String(phoneNumber).trim(),
      storeAddress: storeAddress ? storeAddress.trim() : "",
      contactEmail: contactEmail ? contactEmail.trim().toLowerCase() : "",
      logo:         logo ? logo.trim() : "",
    };

    // Hash and update password only if a new one was supplied
    if (newPassword && newPassword.trim()) {
      const hashed = await bcrypt.hash(newPassword.trim(), 12);
      tenantUpdates.adminPassword = hashed;

      // Also update the admin User record for this tenant
      const tenant = await Tenant.findById(id).lean();
      if (tenant) {
        await User.updateOne(
          { tenantId: tenant.tenantId, role: "ADMIN" },
          { $set: { password: hashed } }
        );
      }
    }

    const updated = await Tenant.findByIdAndUpdate(id, tenantUpdates, { new: true })
      .select("tenantId name ownerName phoneNumber plan status isActive createdAt logo storeAddress contactEmail customerDomain adminDomain");
    if (!updated) return res.status(404).json({ success: false, message: "Tenant not found" });

    return res.json({ success: true, tenant: updated });
  } catch (err) {
    console.error("[super/updateTenantDetails]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────
   GET /api/super/billing?days=30
   Returns current invoice + revenue for every tenant.
   days=0 → all-time revenue.
───────────────────────────────────────────── */
exports.getBillingOverview = async (req, res) => {
  try {
    const days  = parseInt(req.query.days) || 30;
    const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

    const tenants = await Tenant.find({}).select("_id tenantId name").lean();
    const ids     = tenants.map((t) => t.tenantId);

    // Current active subscriptions (for billing cycle bounds)
    const subs = await StoreSubscription.find({ tenantId: { $in: ids }, status: "ACTIVE" }).lean();
    const subMap = {};
    subs.forEach((s) => { subMap[s.tenantId] = s; });

    // Fetch each tenant's current cycle invoice in parallel
    const invoices = await Promise.all(
      tenants.map(async (t) => {
        const sub = subMap[t.tenantId];
        if (!sub) return { tenantId: t.tenantId, invoice: null };
        const inv = await Invoice.findOne({
          tenantId:          t.tenantId,
          billingCycleStart: sub.billingCycleStart,
        }).lean();
        return { tenantId: t.tenantId, invoice: inv };
      })
    );
    const invoiceMap = {};
    invoices.forEach((r) => { invoiceMap[r.tenantId] = r.invoice; });

    // Subscription revenue = sum of PAID invoices filtered by paidAt date
    // This is what we (the platform) have actually collected from tenants.
    const revenueMatch = since
      ? { tenantId: { $in: ids }, status: "PAID", paidAt: { $gte: since } }
      : { tenantId: { $in: ids }, status: "PAID" };

    const revenueAgg = await Invoice.aggregate([
      { $match: revenueMatch },
      { $group: { _id: "$tenantId", revenue: { $sum: "$totalAmount" } } },
    ]);
    const revenueMap = {};
    revenueAgg.forEach((r) => { revenueMap[r._id] = r.revenue; });

    const data = tenants.map((t) => ({
      tenantId: t.tenantId,
      invoice:  invoiceMap[t.tenantId] || null,
      revenue:  revenueMap[t.tenantId] || 0,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error("[super/getBillingOverview]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────
   PATCH /api/super/tenant/:id/invoice/mark-paid
   Marks the tenant's current cycle invoice as PAID.
   Syncs instantly with admin billing view (same Invoice document).
───────────────────────────────────────────── */
exports.markInvoicePaid = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id).lean();
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    const sub = await StoreSubscription.findOne({ tenantId: tenant.tenantId, status: "ACTIVE" }).lean();
    if (!sub) return res.status(404).json({ success: false, message: "No active subscription" });

    const invoice = await Invoice.findOneAndUpdate(
      { tenantId: tenant.tenantId, billingCycleStart: sub.billingCycleStart },
      { $set: { status: "PAID", paidAt: new Date(), paymentId: "manual-super-admin" } },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    return res.json({ success: true, invoice });
  } catch (err) {
    console.error("[super/markInvoicePaid]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
