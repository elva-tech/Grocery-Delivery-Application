const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../../../middleware/auth.middleware");
const { resolveTenant } = require("../../../middleware/tenant.middleware");
const tenantBilling = require("../controllers/tenantBilling.controller");

router.use(resolveTenant);
router.use(authMiddleware);

router.get("/plans", tenantBilling.getPlans);
router.get("/subscription", tenantBilling.getSubscription);
router.get("/usage", tenantBilling.getUsage);
router.get("/invoice/current", tenantBilling.getCurrentInvoice);
router.get("/invoices", tenantBilling.getInvoiceHistory);
router.get("/invoices/export", tenantBilling.exportInvoiceHistoryCsv);
router.get("/invoices/:id/download", tenantBilling.downloadInvoiceAudit);
router.get("/notifications", tenantBilling.getBillingNotifications);
router.patch("/notifications/:id/read", tenantBilling.markNotificationRead);
router.put("/subscription/plan", tenantBilling.changePlan);
router.post("/invoice/:id/pay", tenantBilling.createInvoicePayment);
router.post("/invoice/:id/verify", tenantBilling.verifyInvoicePayment);
router.post("/invoice/:id/pay-placeholder", tenantBilling.payInvoicePlaceholder);
router.post("/plan/initiate-payment", tenantBilling.initiatePlanPayment);
router.post("/plan/activate", tenantBilling.activatePlanNow);

module.exports = router;
