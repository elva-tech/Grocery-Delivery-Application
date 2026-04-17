const jwt    = require("jsonwebtoken");
const Tenant = require("../models/Tenant.model");

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
      .select("tenantId name ownerName phoneNumber plan status isActive createdAt")
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

    return res.json({ success: true, tenant });
  } catch (err) {
    console.error("[super/updateStatus]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
