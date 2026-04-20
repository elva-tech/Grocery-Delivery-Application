const express      = require("express");
const router       = express.Router();
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const {
  createTenant,
  getTenantDetails,
  getAccountStatus,
  updateTenantSupportContact,
} = require("../controllers/tenant.controller");

// Public — no auth required (this IS how an admin account first gets created)
router.post("/create", createTenant);

// Public — returns public brand info for the tenant identified by x-tenant-id header
router.get("/details", getTenantDetails);

// Auth required — returns suspension/status for the logged-in admin
router.get("/account-status", authMiddleware, getAccountStatus);

// Admin only — customer-facing support email / phone / hours
router.patch("/support-contact", authMiddleware, adminOnly, updateTenantSupportContact);

module.exports = router;
