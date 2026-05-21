const express = require("express");
const router  = express.Router();
const upload = require("../middleware/uploadGeneric");
const { superAuthMiddleware } = require("../middleware/superAuth.middleware");
const {
  login,
  getTenants,
  updateStatus,
  updateTenantDetails,
  uploadTenantLogoBySuperAdmin,
} = require("../controllers/superAdmin.controller");
const superBillingRoutes = require("../modules/billing/routes/superBilling.routes");
const superBilling = require("../modules/billing/controllers/superBilling.controller");

// Public
router.post("/login", login);

// Protected
router.get("/tenants",                              superAuthMiddleware, getTenants);
router.patch("/tenant/:id/plan",                   superAuthMiddleware, superBilling.assignTenantPlan);
router.patch("/tenant/:id/status",                 superAuthMiddleware, updateStatus);
router.patch("/tenant/:id/details",                superAuthMiddleware, updateTenantDetails);
router.get("/billing",                             superAuthMiddleware, superBilling.getBillingOverview);
router.patch("/tenant/:id/invoice/mark-paid",      superAuthMiddleware, superBilling.markInvoicePaid);
router.use(superBillingRoutes);

router.post(
  "/tenant-logo",
  superAuthMiddleware,
  upload.single("file"),
  uploadTenantLogoBySuperAdmin
);

module.exports = router;
