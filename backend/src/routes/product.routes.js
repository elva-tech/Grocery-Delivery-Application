const express = require("express");
const router = express.Router();

const {
  addProduct,
  updateProductFromAdmin,
  getAvailableProducts
} = require("../controllers/product.controller");

const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

/**
 * ✅ Customer API (PUBLIC)
 * GET /api/products
 */
router.get("/", getAvailableProducts);

/**
 * 🔐 Admin APIs
 */
router.post(
  "/admin/products",
  authMiddleware,
  adminOnly,
  addProduct
);

router.put(
  "/admin/products/:id",
  authMiddleware,
  adminOnly,
  updateProductFromAdmin
);

module.exports = router;
