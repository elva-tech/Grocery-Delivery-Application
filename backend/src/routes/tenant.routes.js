const express      = require("express");
const router       = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const { createTenant, getTenantDetails, getAccountStatus, getTenantByCode } = require("../controllers/tenant.controller");

// Public — no auth required (this IS how an admin account first gets created)
router.post("/create", createTenant);

// Public — returns public brand info for the tenant identified by x-tenant-id header
router.get("/details", getTenantDetails);

// Public — resolves a 4-char storeCode to tenantId + basic store info
router.get("/by-code/:storeCode", getTenantByCode);

// Auth required — returns suspension/status for the logged-in admin
router.get("/account-status", authMiddleware, getAccountStatus);

module.exports = router;
