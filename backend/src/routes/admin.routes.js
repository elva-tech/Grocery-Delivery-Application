const express = require("express");
const router = express.Router();

const {
  getAllOrdersForAdmin,
  updateOrderStatus,
  getUsers,
  blockOrUnblockUser,
  getRevenue,
  getActiveOrdersCount,
  getPendingOrdersCount
} = require("../controllers/admin.controller");

const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

//////////////////////////////////////////////////////
// GET ALL ORDERS
//////////////////////////////////////////////////////

// GET /api/admin/orders
router.get(
  "/orders",
  authMiddleware,
  adminOnly,
  getAllOrdersForAdmin
);

//////////////////////////////////////////////////////
// UPDATE ORDER STATUS
//////////////////////////////////////////////////////

// PUT /api/admin/orders/:id/status
router.put(
  "/orders/:id/status",
  authMiddleware,
  adminOnly,
  updateOrderStatus
);

//////////////////////////////////////////////////////
// LIST USERS
//////////////////////////////////////////////////////

// GET /api/admin/users
router.get(
  "/users",
  authMiddleware,
  adminOnly,
  getUsers
);

//////////////////////////////////////////////////////
// BLOCK / UNBLOCK USER
//////////////////////////////////////////////////////

// PUT /api/admin/users/:id/block
router.put(
  "/users/:id/block",
  authMiddleware,
  adminOnly,
  blockOrUnblockUser
);

//////////////////////////////////////////////////////
// DASHBOARD APIs
//////////////////////////////////////////////////////

// GET /api/admin/revenue?days=n
router.get(
  "/revenue",
  authMiddleware,
  adminOnly,
  getRevenue
);

// GET /api/admin/active-orders
router.get(
  "/active-orders",
  authMiddleware,
  adminOnly,
  getActiveOrdersCount
);

// GET /api/admin/pending-orders
router.get(
  "/pending-orders",
  authMiddleware,
  adminOnly,
  getPendingOrdersCount
);

module.exports = router;