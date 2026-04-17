const express = require("express");
const router = express.Router();
const { adminOnly } = require("../middleware/auth.middleware");
const { resolveTenant } = require("../middleware/tenant.middleware");
const {
  createCoupon,
  getAllCoupons,
  updateCoupon,
  validateCoupon,
} = require("../controllers/coupon.controller");

router.use(resolveTenant);

// Customer-facing (all authenticated users)
router.post("/validate", validateCoupon);

// Admin-only
router.get("/", adminOnly, getAllCoupons);
router.post("/", adminOnly, createCoupon);
router.patch("/:id", adminOnly, updateCoupon);

module.exports = router;
