const express = require("express");
const router = express.Router();

const { adminOnly } = require("../middleware/auth.middleware");
const {
  placeCustomerOrder,
  getCustomerOrderHistory,
  markOrderDelivered,
} = require("../controllers/order.controller");

router.post("/", placeCustomerOrder);
router.get("/my", getCustomerOrderHistory);

// 👇 NEW
router.patch("/:orderId/deliver", adminOnly, markOrderDelivered);

module.exports = router;
