const express = require("express");
const router = express.Router();

const {
  authMiddleware,
  adminOnly
} = require("../middleware/auth.middleware");
const { resolveTenant } = require("../middleware/tenant.middleware");

router.use(resolveTenant);

const {
  addProduct,
  updateProductFromAdmin,
  getAvailableProducts
 
} = require("../controllers/product.controller");

/**
 * Customer API
 */
router.get("/", getAvailableProducts);

/**
 * Admin APIs
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