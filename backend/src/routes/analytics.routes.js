const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analytics.controller");

router.get("/top-products",    analyticsController.getTopProducts);
router.get("/daily-sales",     analyticsController.getDailySales);
router.get("/ratings-summary", analyticsController.getRatingsSummary);

module.exports = router;
