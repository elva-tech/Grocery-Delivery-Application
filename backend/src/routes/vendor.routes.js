const express = require("express");
const router = express.Router();
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const {
  setRazorpayConfig,
  getRazorpayStatus,
} = require("../controllers/vendor.controller");

router.post(
  "/razorpay-config",
  authMiddleware,
  adminOnly,
  setRazorpayConfig
);

router.get(
  "/:tenantId/razorpay-status",
  authMiddleware,
  adminOnly,
  getRazorpayStatus
);

module.exports = router;
