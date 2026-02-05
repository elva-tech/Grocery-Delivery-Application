const express = require("express");
const router = express.Router();

const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

const {
  placeCustomerOrder,
  getCustomerOrderHistory,
  markOrderDelivered,
} = require("../controllers/order.controller");

router.post("/", authMiddleware, placeCustomerOrder);
router.get("/my", authMiddleware, getCustomerOrderHistory);
router.patch("/:orderId/deliver", authMiddleware, markOrderDelivered);

module.exports = router;
