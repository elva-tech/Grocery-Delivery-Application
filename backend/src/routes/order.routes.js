const express = require("express");
const router = express.Router();
const { placeOrder, getProducts } = require("../controllers/order.controller");

router.post("/orders", placeOrder);
router.get("/products", getProducts);

module.exports = router;
