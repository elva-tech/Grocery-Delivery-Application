const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  initiatePayment,
  verifyPayment,
} = require("../controllers/payment.controller");

router.post("/create", authMiddleware, initiatePayment);
router.post("/verify", authMiddleware, verifyPayment);

module.exports = router;
