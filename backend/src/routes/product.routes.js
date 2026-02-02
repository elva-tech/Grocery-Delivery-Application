const express = require("express");
const router = express.Router();

const { addProduct } = require("../controllers/product.controller");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const { updateProduct } = require("../controllers/update.controller");
router.post("/admin/products", authMiddleware, adminOnly, addProduct);
router.put("/admin/products/:id", authMiddleware, adminOnly, updateProduct);
module.exports = router;
