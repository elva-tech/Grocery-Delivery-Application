const express = require("express");
const router = express.Router();

const {
  authMiddleware,
  adminOnly
} = require("../middleware/auth.middleware");

const {
  addProduct,
  updateProductFromAdmin,
  getAvailableProducts,
  deleteProductFromAdmin
 
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

router.delete(
  "/admin/products/:id",
  authMiddleware,
  adminOnly,
  deleteProductFromAdmin
);

module.exports = router;