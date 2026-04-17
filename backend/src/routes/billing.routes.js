const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  getPlans,
  getSubscription,
  getUsage,
  getCurrentInvoice,
  triggerBillingGeneration,
  changePlan,
  createInvoicePayment,
  verifyInvoicePayment,
  initiatePlanPayment,
  activatePlanNow,
} = require("../controllers/billing.controller");

// All billing routes require authentication
router.use(authMiddleware);

router.get("/plans",                    getPlans);
router.get("/subscription",             getSubscription);
router.get("/usage",                    getUsage);
router.get("/invoice/current",          getCurrentInvoice);
router.post("/generate",                triggerBillingGeneration);
router.put("/subscription/plan",        changePlan);
router.post("/invoice/:id/pay",         createInvoicePayment);
router.post("/invoice/:id/verify",      verifyInvoicePayment);
router.post("/plan/initiate-payment",   initiatePlanPayment);
router.post("/plan/activate",           activatePlanNow);

module.exports = router;
