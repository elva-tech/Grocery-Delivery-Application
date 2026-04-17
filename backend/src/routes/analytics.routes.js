const express = require("express");
const router = express.Router();
const { resolveTenant } = require("../middleware/tenant.middleware");
const analyticsController = require("../controllers/analytics.controller");

router.use(resolveTenant);

router.get("/top-products",    analyticsController.getTopProducts);
router.get("/daily-sales",     analyticsController.getDailySales);
router.get("/ratings-summary", analyticsController.getRatingsSummary);

module.exports = router;
