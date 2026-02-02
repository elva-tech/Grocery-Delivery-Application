const express = require("express");
const router = express.Router();

// ✅ middleware imports
const {
  authMiddleware,
  adminOnly,
} = require("../middleware/auth.middleware");

// ✅ controller imports
const {
  placeOrder,
  getProducts,
  updateOrderStatus,
} = require("../controllers/order.controller");

// ================= USER ROUTES =================

// Place order
router.post("/orders", authMiddleware, placeOrder);

// Get products
router.get("/products", authMiddleware, getProducts);

// ================= ADMIN ROUTES =================

// Update order status
router.put(
  "/admin/orders/:id/status",
  authMiddleware,
  adminOnly,
  updateOrderStatus
);

module.exports = router;
