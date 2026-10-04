const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const { resolveTenant } = require("../middleware/tenant.middleware");
const {
  initiatePayment,
  verifyPayment,
  abandonPayment,
} = require("../controllers/payment.controller");

router.use(resolveTenant);

router.post("/create", authMiddleware, initiatePayment);
router.post("/verify", authMiddleware, verifyPayment);
router.post("/abandon", authMiddleware, abandonPayment);

module.exports = router;
