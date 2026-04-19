const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/auth.middleware");
const { resolveTenant } = require("../middleware/tenant.middleware");

router.use(resolveTenant);

const {
  placeCustomerOrder,
  getCustomerOrderHistory,
  markOrderDelivered,
  getCustomerOrderById,
  getAllOrders,
  cancelOrder,
  getRevenue,
  rateOrder,
} = require("../controllers/order.controller");

const returnController = require("../controllers/return.controller");

router.post("/", authMiddleware, placeCustomerOrder);

router.get("/", authMiddleware, getAllOrders);
router.get("/revenue", authMiddleware, getRevenue);

router.get("/my", authMiddleware, getCustomerOrderHistory);

/** Customer report issue / return — same handler as POST /api/returns/create */
router.post("/report-issue", authMiddleware, returnController.createReturnRequest);

/* NEW API — Get single order details */
router.get("/:id", authMiddleware, getCustomerOrderById);

router.patch("/:orderId/deliver", authMiddleware, markOrderDelivered);
router.patch("/:orderId/cancel", authMiddleware, cancelOrder);
router.post("/:orderId/rate", authMiddleware, rateOrder);
module.exports = router;