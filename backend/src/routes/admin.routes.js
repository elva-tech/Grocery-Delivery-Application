const express = require("express");
const router = express.Router();

const {
  getAllOrdersForAdmin,
  updateOrderStatus,
  getUsers,
  getCustomerDetails,
  blockOrUnblockUser,
  getActiveOrders,
  getRevenue,
  getRevenueReport,
  getPendingOrders,
  markCODPaid,
  retryOrderRefund,
} = require("../controllers/admin.controller");

const {
  deleteProductFromAdmin,
  getInventory
} = require("../controllers/product.controller");

const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const { resolveTenant } = require("../middleware/tenant.middleware");

router.use(resolveTenant);

//////////////////////////////////////////////////////
// ACTIVE ORDERS
//////////////////////////////////////////////////////

router.get(
  "/active-orders",
  authMiddleware,
  adminOnly,
  getActiveOrders
);

//////////////////////////////////////////////////////
// ADMIN DASHBOARD - REVENUE
//////////////////////////////////////////////////////

router.get(
  "/revenue",
  authMiddleware,
  adminOnly,
  getRevenue
);

router.get(
  "/revenue/report",
  authMiddleware,
  adminOnly,
  getRevenueReport
);

//////////////////////////////////////////////////////
// ADMIN DASHBOARD - PENDING ORDERS
//////////////////////////////////////////////////////

router.get(
  "/pending-orders",
  authMiddleware,
  adminOnly,
  getPendingOrders
);

//////////////////////////////////////////////////////
// GET ALL ORDERS
//////////////////////////////////////////////////////

router.get(
  "/orders",
  authMiddleware,
  adminOnly,
  getAllOrdersForAdmin
);

//////////////////////////////////////////////////////
// UPDATE ORDER STATUS
//////////////////////////////////////////////////////

router.put(
  "/orders/:id/status",
  authMiddleware,
  adminOnly,
  updateOrderStatus
);

//////////////////////////////////////////////////////
// MARK COD ORDER AS PAID
//////////////////////////////////////////////////////

router.patch(
  "/orders/:id/mark-paid",
  authMiddleware,
  adminOnly,
  markCODPaid
);

router.post(
  "/orders/:id/refund",
  authMiddleware,
  adminOnly,
  retryOrderRefund
);

//////////////////////////////////////////////////////
// LIST USERS
//////////////////////////////////////////////////////

router.get(
  "/users",
  authMiddleware,
  adminOnly,
  getUsers
);

router.get(
  "/customers",
  authMiddleware,
  adminOnly,
  getCustomerDetails
);

//////////////////////////////////////////////////////
// BLOCK / UNBLOCK USER
//////////////////////////////////////////////////////

router.put(
  "/users/:id/block",
  authMiddleware,
  adminOnly,
  blockOrUnblockUser
);

//////////////////////////////////////////////////////
// DELETE PRODUCT (ADMIN)
//////////////////////////////////////////////////////

router.delete(
  "/products/:id",
  authMiddleware,
  adminOnly,
  deleteProductFromAdmin
);

router.get(
  "/inventory",
  authMiddleware,
  adminOnly,
  getInventory
);

module.exports = router;