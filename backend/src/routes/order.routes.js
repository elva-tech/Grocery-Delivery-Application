const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const {
  placeOrder,
  getMyOrders,
  markOrderDelivered,
} = require("../controllers/order.controller");

router.post("/orders", authMiddleware, placeOrder);
router.get("/orders/my", authMiddleware, getMyOrders);
router.patch("/orders/:orderId/deliver", authMiddleware, markOrderDelivered);

module.exports = router;
