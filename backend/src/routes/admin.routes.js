const express = require("express");
const router = express.Router();

const { getAllOrdersForAdmin } = require("../controllers/admin.controller");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

// GET /api/admin/orders
router.get(
  "/orders",
  authMiddleware,   // ✅ FIRST: authenticate user
  adminOnly,        // ✅ SECOND: check ADMIN role
  getAllOrdersForAdmin
);

module.exports = router;
