const express = require("express");
const router = express.Router();
const { adminOnly, authMiddleware, optionalAuth } = require("../middleware/auth.middleware");
const { resolveTenant } = require("../middleware/tenant.middleware");
const {
  createCoupon,
  getAllCoupons,
  updateCoupon,
  validateCoupon,
  listStorefrontCoupons,
} = require("../controllers/coupon.controller");

router.use(resolveTenant);

// Storefront: offers for tenant (x-tenant-id). Optional JWT improves first-order eligibility.
router.get("/public", optionalAuth, listStorefrontCoupons);

// Customer-facing (authenticated)
router.post("/validate", authMiddleware, validateCoupon);

// Admin-only
router.get("/", adminOnly, getAllCoupons);
router.post("/", adminOnly, createCoupon);
router.patch("/:id", adminOnly, updateCoupon);

module.exports = router;
