const Tenant = require("../models/Tenant.model");

const resolveTenant = async (req, res, next) => {
  try {
    const hostname = (req.hostname || "").toLowerCase();
    let tenantId = null;

    // ── HEADER (always highest priority) ────────────
    const headerTenant = (req.headers["x-tenant-id"] || "").trim().toLowerCase();
    if (headerTenant) {
      tenantId = headerTenant;
    }

    // ── LOCALHOST (DEV) ─────────────────────────────
    if (hostname.includes("localhost")) {
      if (!tenantId) tenantId = "demo-tenant";
      req.tenantId = tenantId;
      console.log("Resolved Tenant (local dev, no DB check):", tenantId);
      return next();
    }

    // ── SUBDOMAIN (ROBUST LOGIC) ────────────────────
    if (!tenantId) {
      const parts = hostname.split(".");

      // Remove common prefixes
      const ignored = ["www"];

      const cleanParts = parts.filter(p => !ignored.includes(p));

      // If "admin" exists → take next
      const adminIndex = cleanParts.indexOf("admin");

      if (adminIndex !== -1 && cleanParts[adminIndex + 1]) {
        tenantId = cleanParts[adminIndex + 1];
      } else {
        // Otherwise first part is tenant
        tenantId = cleanParts[0];
      }
    }

    console.log("Resolved Tenant:", tenantId, "Host:", hostname);

    // ── VALIDATION ──────────────────────────────────
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant identification failed",
      });
    }

    const tenant = await Tenant.findOne({ tenantId, isActive: true });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found or inactive",
      });
    }

    req.tenantId = tenant.tenantId;
    next();
  } catch (error) {
    console.error("resolveTenant error:", error);
    return res.status(500).json({
      success: false,
      message: "Tenant resolution failed",
      error: error.message,
    });
  }
};

module.exports = { resolveTenant };