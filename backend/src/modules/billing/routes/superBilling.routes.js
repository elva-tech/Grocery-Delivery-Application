const express = require("express");
const router = express.Router();
const { superAuthMiddleware } = require("../../../middleware/superAuth.middleware");
const superBilling = require("../controllers/superBilling.controller");

router.get("/plans", superAuthMiddleware, superBilling.listPlans);
router.post("/plans", superAuthMiddleware, superBilling.createPlan);
router.patch("/plans/:id", superAuthMiddleware, superBilling.updatePlan);
router.delete("/plans/:id", superAuthMiddleware, superBilling.disablePlan);
router.get("/tenant/:id/enterprise", superAuthMiddleware, superBilling.getEnterprisePlanForTenant);
router.patch("/tenant/:id/enterprise", superAuthMiddleware, superBilling.updateEnterprisePlanForTenant);

module.exports = router;
