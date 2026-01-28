const express = require("express");
const router = express.Router();

const { addProduct } = require("../controllers/product.controller");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

router.post("/admin/products", authMiddleware, adminOnly, addProduct);

module.exports = router;
