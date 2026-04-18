const express = require("express");
const router  = express.Router();
const { superAuthMiddleware } = require("../middleware/superAuth.middleware");
const {
  login,
  getTenants,
  updatePlan,
  updateStatus,
} = require("../controllers/superAdmin.controller");

// Public
router.post("/login", login);

// Protected
router.get("/tenants",              superAuthMiddleware, getTenants);
router.patch("/tenant/:id/plan",    superAuthMiddleware, updatePlan);
router.patch("/tenant/:id/status",  superAuthMiddleware, updateStatus);

module.exports = router;
