const express = require("express");
const router = express.Router();

const {
  getAllOrdersForAdmin,
  updateOrderStatus,
  getUsers,
  blockOrUnblockUser
} = require("../controllers/admin.controller");
const {
  deleteProductFromAdmin
} = require("../controllers/product.controller");

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

//product.controller route

router.delete(
  "/products/:id",
  authMiddleware,
  adminOnly,
  deleteProductFromAdmin
);


module.exports = router;


// PUT /api/admin/users/:id/block
router.put(
  "/users/:id/block",
  authMiddleware,
  adminOnly,
  blockOrUnblockUser
);

module.exports = router;

