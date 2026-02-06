const express = require("express");
const router = express.Router();

const {
  addProduct,
  updateProductFromAdmin
} = require("../controllers/product.controller");

const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

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
