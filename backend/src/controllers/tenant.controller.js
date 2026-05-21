const Tenant   = require("../models/Tenant.model");
const User     = require("../models/User.model");
const Store    = require("../models/Store.model");
const Settings = require("../models/Settings.model");
const bcrypt   = require("bcryptjs");
const QRCode   = require("qrcode");
const { billingService } = require("../modules/billing");
const { seedDefaultPlansIfEmpty } = require("../modules/billing/services/seed.service");
const getOrCreateSubscription = (tenantId, userId) =>
  billingService.getOrCreateSubscription(tenantId, userId);
const seedPlans = seedDefaultPlansIfEmpty;

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */

const BASE_DOMAIN      = "enandi.com";
const TENANT_ID_REGEX  = /^[a-z0-9-]+$/;

/* ─────────────────────────────────────────────
   STORE CODE GENERATOR
───────────────────────────────────────────── */

/**
 * Generates a unique 4-character uppercase alphanumeric storeCode.
 * Retries up to 20 times before throwing.
 */
async function generateStoreCode() {
  for (let i = 0; i < 20; i++) {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const exists = await Tenant.exists({ storeCode: code });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique storeCode after 20 attempts.");
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

const validatePhone = (phoneNumber) => {
  const phone = String(phoneNumber || "").trim();
  if (!phone)            return "phoneNumber is required";
  if (!/^\d+$/.test(phone)) return "phoneNumber must contain only digits";
  if (phone.length !== 10)  return "phoneNumber must be exactly 10 digits";
  return null;
};

/**
 * Converts arbitrary text to a slug safe for use as a tenantId.
 * "Fresh Mart!" → "fresh-mart"
 */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // strip non-alphanumeric (keep spaces/hyphens)
    .replace(/\s+/g, "-")          // spaces → hyphens
    .replace(/-+/g, "-")           // collapse consecutive hyphens
    .replace(/^-|-$/g, "");        // trim leading/trailing hyphens
}

/**
 * Appends a random 4-digit suffix to a base slug, retrying up to 10 times
 * until a unique value is found.
 */
async function appendUniqueSuffix(base) {
  for (let i = 0; i < 10; i++) {
    const suffix    = Math.floor(1000 + Math.random() * 9000); // 1000–9999
    const candidate = `${base}-${suffix}`;
    const exists    = await Tenant.exists({ tenantId: candidate });
    if (!exists) return candidate;
  }
  throw new Error(
    "Could not generate a unique tenantId after 10 attempts. Try a different store name."
  );
}

/**
 * Resolves the final tenantId from either the caller-supplied value or
 * the store name, guaranteeing DB uniqueness.
 *
 * Returns { tenantId } on success or { error } on validation failure.
 */
async function resolveTenantId(rawTenantId, storeName) {
  if (rawTenantId) {
    // ── Manual path ──────────────────────────────────────────────────────
    const normalized = rawTenantId.toLowerCase().replace(/\s+/g, "-");

    if (!TENANT_ID_REGEX.test(normalized)) {
      return {
        error:
          "tenantId may only contain lowercase letters, digits, and hyphens (a-z, 0-9, -)",
      };
    }

    const exists = await Tenant.exists({ tenantId: normalized });
    if (!exists) return { tenantId: normalized };

    // Collision: append suffix
    const unique = await appendUniqueSuffix(normalized);
    return { tenantId: unique };
  }

  // ── Auto-generate from storeName ─────────────────────────────────────
  const base = slugify(storeName);
  if (!base) {
    return { error: "Could not derive a valid tenantId from storeName" };
  }

  const exists = await Tenant.exists({ tenantId: base });
  if (!exists) return { tenantId: base };

  // Collision: append suffix
  const unique = await appendUniqueSuffix(base);
  return { tenantId: unique };
}

/* ─────────────────────────────────────────────
   ROLLBACK  (best-effort cleanup on partial failure)
───────────────────────────────────────────── */

async function rollback(tenantId) {
  if (!tenantId) return;
  await Promise.allSettled([
    Tenant.deleteOne({ tenantId }),
    User.deleteOne({ tenantId, role: "ADMIN" }),
    Store.deleteOne({ tenantId }),
    Settings.deleteOne({ tenantId }),
  ]);
  console.log(`[createTenant] Rolled back documents for tenantId: ${tenantId}`);
}

/* ─────────────────────────────────────────────
   GET /api/tenant/details
   Public — returns brand info for the current tenant
───────────────────────────────────────────── */
exports.getTenantDetails = async (req, res) => {
  const tenantId = req.headers["x-tenant-id"];
  if (!tenantId) {
    return res.status(400).json({ success: false, message: "x-tenant-id header is required" });
  }

  const tenant = await Tenant.findOne({ tenantId })
    .select(
      "tenantId name logo storeAddress storeAddressParts storeLat storeLng contactEmail phoneNumber plan customerDomain adminDomain ownerName tagline heroBadge heroTitle heroSubtitle supportEmail supportPhone supportHours"
    )
    .lean();

  if (!tenant) {
    return res.status(404).json({ success: false, message: "Tenant not found" });
  }

  // Fetch the real active billing subscription plan
  let activePlan = tenant.plan || "FREE";
  try {
    const { plan } = await getOrCreateSubscription(tenantId);
    if (plan?.plan_code) activePlan = plan.plan_code;
    else if (plan?.name) activePlan = plan.name;
  } catch (_) { /* fall back to Tenant.plan */ }

  return res.json({
    success: true,
    tenantId:      tenant.tenantId,
    storeName:     tenant.name,
    ownerName:     tenant.ownerName || "",
    logo:          tenant.logo || "",
    storeAddress:  tenant.storeAddress || "",
    storeAddressParts: tenant.storeAddressParts || {},
    storeLat:      typeof tenant.storeLat === "number" ? tenant.storeLat : null,
    storeLng:      typeof tenant.storeLng === "number" ? tenant.storeLng : null,
    contactEmail:  tenant.contactEmail || "",
    phoneNumber:   tenant.phoneNumber || "",
    customerDomain: tenant.customerDomain || "",
    adminDomain:   tenant.adminDomain || "",
    tagline:       tenant.tagline || "",
    heroBadge:     tenant.heroBadge || "",
    heroTitle:     tenant.heroTitle || "",
    heroSubtitle:  tenant.heroSubtitle || "",
    plan:          activePlan,
    status:        tenant.status || "ACTIVE",
    supportEmail:  tenant.supportEmail || "",
    supportPhone:  tenant.supportPhone || "",
    supportHours:  tenant.supportHours || "",
  });
};

/* ─────────────────────────────────────────────
   PATCH /api/tenant/support-contact
   Admin only — customer-facing support details
───────────────────────────────────────────── */
exports.updateTenantSupportContact = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: "tenantId missing from session" });
    }

    const { supportEmail, supportPhone, supportHours } = req.body;
    const email = String(supportEmail || "")
      .trim()
      .toLowerCase();
    const phoneRaw = String(supportPhone || "").trim();
    const hours = String(supportHours || "").trim();

    if (!email) {
      return res.status(400).json({ success: false, message: "Support email is required" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid support email" });
    }

    const phoneDigits = phoneRaw.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      return res
        .status(400)
        .json({ success: false, message: "Support phone must include at least 10 digits" });
    }
    const phone = phoneDigits.slice(-10);

    if (!hours || hours.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Support hours are required (e.g. Mon–Sat 9:00 AM – 6:00 PM)",
      });
    }

    const updated = await Tenant.findOneAndUpdate(
      { tenantId },
      {
        $set: {
          supportEmail: email,
          supportPhone: phone,
          supportHours: hours.slice(0, 400),
        },
      },
      { new: true }
    )
      .select("tenantId supportEmail supportPhone supportHours")
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    return res.json({
      success: true,
      message: "Support details saved",
      supportEmail: updated.supportEmail,
      supportPhone: updated.supportPhone,
      supportHours: updated.supportHours,
    });
  } catch (err) {
    console.error("[updateTenantSupportContact]", err);
    return res.status(500).json({ success: false, message: "Failed to save support details" });
  }
};

/* ─────────────────────────────────────────────
   PATCH /api/tenant/store-location
   Admin only — hub coordinates for delivery distance (sent as MapService points[])
───────────────────────────────────────────── */
exports.updateTenantStoreLocation = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: "tenantId missing from session" });
    }

    const { storeLat, storeLng } = req.body;
    const lat = Number(storeLat);
    const lng = Number(storeLng);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ success: false, message: "storeLat must be a number between -90 and 90" });
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: "storeLng must be a number between -180 and 180" });
    }

    const updated = await Tenant.findOneAndUpdate(
      { tenantId },
      { $set: { storeLat: lat, storeLng: lng } },
      { new: true }
    )
      .select("tenantId storeLat storeLng")
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    return res.json({
      success: true,
      message: "Store location saved",
      storeLat: updated.storeLat,
      storeLng: updated.storeLng,
    });
  } catch (err) {
    console.error("[updateTenantStoreLocation]", err);
    return res.status(500).json({ success: false, message: "Failed to save store location" });
  }
};

/*____________________________________________
   GET /api/tenant/by-code/:storeCode
   Public — resolves a 4-char storeCode to tenantId + basic store info
───────────────────────────────────────────── */
exports.getTenantByCode = async (req, res) => {
  const { storeCode } = req.params;
  if (!storeCode) {
    return res.status(400).json({ success: false, message: "storeCode is required" });
  }

  const tenant = await Tenant.findOne({
    storeCode: storeCode.toUpperCase(),
    isActive:  true,
  })
    .select("tenantId name logo storeCode deepLink")
    .lean();

  if (!tenant) {
    return res.status(404).json({ success: false, message: "Invalid store code" });
  }

  return res.json({
    success:   true,
    tenantId:  tenant.tenantId,
    storeName: tenant.name,
    logo:      tenant.logo || "",
    storeCode: tenant.storeCode,
    deepLink:  tenant.deepLink || `enandi://${tenant.tenantId}`,
  });
};

/* ─────────────────────────────────────────────
   GET /api/tenant/account-status
   Auth required — returns suspension state for the logged-in admin's tenant
───────────────────────────────────────────── */
exports.getAccountStatus = async (req, res) => {
  const tenantId = req.user?.tenantId || req.headers["x-tenant-id"];
  if (!tenantId) {
    return res.status(400).json({ success: false, message: "tenantId not found" });
  }

  const tenant = await Tenant.findOne({ tenantId })
    .select("status isActive")
    .lean();

  if (!tenant) {
    return res.status(404).json({ success: false, message: "Tenant not found" });
  }

  const suspended = tenant.status === "SUSPENDED";
  return res.json({
    success: true,
    status:         tenant.status,
    suspended,
    superAdminEmail: suspended ? (process.env.SUPER_ADMIN_EMAIL || "") : undefined,
  });
};

/* ─────────────────────────────────────────────
   POST /api/tenant/create
───────────────────────────────────────────── */

exports.createTenant = async (req, res) => {
  let tenantId = null; // tracked so rollback can reference it on error

  try {
    const {
      storeName,
      ownerName,
      phoneNumber,
      tenantId: rawTenantId, // optional
      logo,
      storeAddress,
      storeLat: rawStoreLat,
      storeLng: rawStoreLng,
      storeAddressParts: rawStoreAddressParts,
      contactEmail,
      plan: requestedPlan,
      password,
      tagline,
      heroBadge,
      heroTitle,
      heroSubtitle,
      supportEmail: rawSupportEmail,
      supportPhone: rawSupportPhone,
      supportHours: rawSupportHours,
    } = req.body;

    const trimStr = (v, max = 500) => {
      const s = typeof v === "string" ? v.trim() : "";
      if (!s) return "";
      return s.length > max ? s.slice(0, max) : s;
    };

    // ── Input validation ────────────────────────────────────────────────
    if (!storeName || !storeName.trim()) {
      return res.status(400).json({ success: false, message: "storeName is required" });
    }

    if (!ownerName || ownerName.trim().length < 2) {
      return res
        .status(400)
        .json({ success: false, message: "ownerName must be at least 2 characters" });
    }

    const phoneError = validatePhone(phoneNumber);
    if (phoneError) {
      return res.status(400).json({ success: false, message: phoneError });
    }

    // ── Optional email validation ───────────────────────────────────────
    if (contactEmail && contactEmail.trim()) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(contactEmail.trim())) {
        return res.status(400).json({ success: false, message: "contactEmail format is invalid" });
      }
    }

    let initialSupportEmail = "";
    let initialSupportPhone = "";
    let initialSupportHours = "";
    if (rawSupportEmail && String(rawSupportEmail).trim()) {
      const se = String(rawSupportEmail).trim().toLowerCase();
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(se)) {
        return res.status(400).json({ success: false, message: "supportEmail format is invalid" });
      }
      initialSupportEmail = se;
    }
    if (rawSupportPhone && String(rawSupportPhone).trim()) {
      const sd = String(rawSupportPhone).replace(/\D/g, "");
      if (sd.length < 10) {
        return res.status(400).json({ success: false, message: "supportPhone must include at least 10 digits" });
      }
      initialSupportPhone = sd.slice(-10);
    }
    if (rawSupportHours && String(rawSupportHours).trim()) {
      initialSupportHours = trimStr(rawSupportHours, 400);
    }

    // ── Password validation ─────────────────────────────────────────────
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    // ── Resolve plan ────────────────────────────────────────────────────
    const VALID_PLANS = ["FREE", "BASIC", "PREMIUM", "ENTERPRISE"];
    const plan = VALID_PLANS.includes(requestedPlan) ? requestedPlan : "FREE";

    const hubLat = Number(rawStoreLat);
    const hubLng = Number(rawStoreLng);
    if (
      !Number.isFinite(hubLat) ||
      !Number.isFinite(hubLng) ||
      hubLat < -90 ||
      hubLat > 90 ||
      hubLng < -180 ||
      hubLng > 180
    ) {
      return res.status(400).json({
        success: false,
        message:
          "storeLat and storeLng are required — pick the store hub on the map during onboarding (or use PIN-based centre).",
      });
    }
    if (hubLat === 0 && hubLng === 0) {
      return res.status(400).json({
        success: false,
        message: "Store hub cannot be 0,0 — set a location on the map.",
      });
    }

    const parts =
      rawStoreAddressParts && typeof rawStoreAddressParts === "object" ? rawStoreAddressParts : {};
    const storeAddressPartsDoc = {
      line1: trimStr(parts.line1, 240),
      line2: trimStr(parts.line2, 240),
      landmark: trimStr(parts.landmark, 240),
      city: trimStr(parts.city, 120),
      state: trimStr(parts.state, 120),
      pincode: String(parts.pincode || "")
        .replace(/\D/g, "")
        .slice(0, 6),
    };

    // ── Hash password ───────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12);

    const phone = String(phoneNumber).trim();

    // ── Duplicate admin check ───────────────────────────────────────────
    const existingAdmin = await User.findOne({ phoneNumber: phone, role: "ADMIN" });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "This phone number is already registered as an admin on another store",
      });
    }

    // ── Resolve tenantId (manual or auto-generated) ─────────────────────
    const resolved = await resolveTenantId(
      rawTenantId ? String(rawTenantId).trim() : null,
      storeName.trim()
    );

    if (resolved.error) {
      return res.status(400).json({ success: false, message: resolved.error });
    }

    tenantId = resolved.tenantId;

    // ── Generate domains ────────────────────────────────────────────────
    const customerDomain = `${tenantId}.${BASE_DOMAIN}`;
    const adminDomain    = `admin.${tenantId}.${BASE_DOMAIN}`;

    // ── Generate storeCode, deepLink, QR ────────────────────────────────
    const storeCode = await generateStoreCode();
    const deepLink  = `enandi://${tenantId}`;
    const qrCode    = await QRCode.toDataURL(deepLink);

    // ── 1. Create Tenant record ─────────────────────────────────────────
    await Tenant.create({
      tenantId,
      name:           storeName.trim(),
      ownerName:      ownerName.trim(),
      phoneNumber:    phone,
      plan,
      status:         "ACTIVE",
      isActive:       true,
      customerDomain,
      adminDomain,
      logo:           logo ? logo.trim() : "",
      storeAddress:   storeAddress ? storeAddress.trim() : "",
      storeAddressParts: storeAddressPartsDoc,
      storeLat:       hubLat,
      storeLng:       hubLng,
      contactEmail:   contactEmail ? contactEmail.trim().toLowerCase() : "",
      adminPassword:  hashedPassword,
      tagline:        trimStr(tagline),
      heroBadge:      trimStr(heroBadge),
      heroTitle:      trimStr(heroTitle),
      heroSubtitle:   trimStr(heroSubtitle),
      supportEmail:   initialSupportEmail,
      supportPhone:   initialSupportPhone,
      supportHours:   initialSupportHours,
      storeCode,
      deepLink,
      qrCode,
    });

    // ── 2. Create Admin User ────────────────────────────────────────────
    const adminUser = await User.create({
      tenantId,
      phoneNumber: phone,
      name:        ownerName.trim(),
      email:       contactEmail ? contactEmail.trim().toLowerCase() : "",
      role:        "ADMIN",
      isActive:    true,
      password:    hashedPassword,
    });

    // ── 3. Create Store ─────────────────────────────────────────────────
    await Store.create({
      tenantId,
      name:           storeName.trim(),
      isOpen:         true,
      manualOverride: false,
    });

    // ── 4. Create default Settings ──────────────────────────────────────
    await Settings.create({ tenantId });

    // ── 5. Seed billing plans + assign FREE subscription ────────────────
    await seedPlans(tenantId);
    await getOrCreateSubscription(tenantId);

    return res.status(201).json({
      success:        true,
      tenantId,
      customerDomain,
      adminDomain,
      adminUserId:    adminUser._id,
      storeCode,
      deepLink,
      qrCode,
      message:        "Store created successfully",
    });
  } catch (err) {
    await rollback(tenantId);

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A tenant with this ID already exists. Please try again.",
      });
    }

    console.error("[createTenant] error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create store. Please try again.",
    });
  }
};
