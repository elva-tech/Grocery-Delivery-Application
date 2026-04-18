const Tenant   = require("../models/Tenant.model");
const User     = require("../models/User.model");
const Store    = require("../models/Store.model");
const Settings = require("../models/Settings.model");
const { seedPlans, getOrCreateSubscription } = require("../services/billing.service");

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */

const BASE_DOMAIN      = "enandi.com";
const TENANT_ID_REGEX  = /^[a-z0-9-]+$/;

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
    } = req.body;

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

    // ── 1. Create Tenant record ─────────────────────────────────────────
    await Tenant.create({
      tenantId,
      name:           storeName.trim(),
      ownerName:      ownerName.trim(),
      phoneNumber:    phone,
      plan:           "FREE",
      status:         "ACTIVE",
      isActive:       true,
      customerDomain,
      adminDomain,
    });

    // ── 2. Create Admin User ────────────────────────────────────────────
    const adminUser = await User.create({
      tenantId,
      phoneNumber: phone,
      name:        ownerName.trim(),
      role:        "ADMIN",
      isActive:    true,
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
