const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middleware/auth.middleware");

const {
  placeCustomerOrder,
  getCustomerOrderHistory,
  markOrderDelivered,
  getCustomerOrderById,
  getAllOrders,
  cancelOrder,
  getRevenue
} = require("../controllers/order.controller");

router.post("/", authMiddleware, placeCustomerOrder);

router.get("/", authMiddleware, getAllOrders);
router.get("/revenue", authMiddleware, getRevenue);

router.get("/my", authMiddleware, getCustomerOrderHistory);

/* NEW API — Get single order details */
router.get("/:id", authMiddleware, getCustomerOrderById);

router.patch("/:orderId/deliver", authMiddleware, markOrderDelivered);
router.patch("/:orderId/cancel", authMiddleware, cancelOrder);
module.exports = router;