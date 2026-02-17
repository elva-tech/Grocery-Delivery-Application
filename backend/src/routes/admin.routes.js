const express = require("express");
const router = express.Router();

const { 
  getAllOrdersForAdmin,
  updateOrderStatus,
  getUsers //  NEW
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
//  UPDATE ORDER STATUS
//////////////////////////////////////////////////////

// PUT /api/admin/orders/:id/status
router.put(
  "/orders/:id/status",
  authMiddleware,
  adminOnly,
  updateOrderStatus
);

//////////////////////////////////////////////////////
//  NEW STORY — LIST USERS
//////////////////////////////////////////////////////

// GET /api/admin/users
router.get(
  "/users",
  authMiddleware,
  adminOnly,
  getUsers
);

module.exports = router;
