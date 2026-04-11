const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  toggleStoreStatus,
  scheduleStore,
  getStoreStatus,
} = require("../controllers/store.controller");

// ✅ GET /api/store/status - Get store status (PUBLIC)
router.get("/status", getStoreStatus);

// ✅ PATCH /api/store/status - Toggle store open/close (PROTECTED)
router.patch("/status", authMiddleware, toggleStoreStatus);

// ✅ PATCH /api/store/schedule - Set store schedule (PROTECTED)
router.patch("/schedule", authMiddleware, scheduleStore);

module.exports = router;
