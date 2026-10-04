const express = require("express");
const router = express.Router();
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const {
  setRazorpayConfig,
  getRazorpayStatus,
  setCashfreeSandboxConfig,
  setCashfreeProductionConfig,
  getCashfreeStatus,
} = require("../controllers/vendor.controller");

router.post(
  "/razorpay-config",
  authMiddleware,
  adminOnly,
  setRazorpayConfig
);

router.post(
  "/cashfree-sandbox-config",
  authMiddleware,
  adminOnly,
  setCashfreeSandboxConfig
);

router.post(
  "/cashfree-production-config",
  authMiddleware,
  adminOnly,
  setCashfreeProductionConfig
);

router.get(
  "/:tenantId/razorpay-status",
  authMiddleware,
  adminOnly,
  getRazorpayStatus
);

router.get(
  "/:tenantId/cashfree-status",
  authMiddleware,
  adminOnly,
  getCashfreeStatus
);

module.exports = router;
