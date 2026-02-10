const express = require("express");
const router = express.Router();

const { 
  getAllOrdersForAdmin,
  updateOrderStatus
} = require("../controllers/admin.controller");

const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

// GET /api/admin/orders
router.get(
  "/orders",
  authMiddleware,   // ✅ FIRST: authenticate user
  adminOnly,        // ✅ SECOND: check ADMIN role
  getAllOrdersForAdmin
);

// PUT /api/admin/orders/:id/status
router.put(
  "/orders/:id/status",
  authMiddleware,
  adminOnly,
  updateOrderStatus
);


module.exports = router;
