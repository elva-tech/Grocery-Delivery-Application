const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { authMiddleware } = require("../middleware/auth.middleware");
const { resolveTenant } = require("../middleware/tenant.middleware");

router.post("/send-otp", resolveTenant, authController.sendOtp);
router.post("/verify-otp", resolveTenant, authController.verifyOtp);
router.patch("/profile", authMiddleware, authController.updateProfile);

module.exports = router;
