const express = require("express");
const router  = express.Router();
const { getStatus, patchStatus, patchSchedule } = require("../controllers/storeAvailability.controller");
const { authMiddleware } = require("../middleware/auth.middleware");
const { resolveTenant } = require("../middleware/tenant.middleware");

router.use(resolveTenant);

// PUBLIC – website & mobile app read the status without a token
router.get("/status", getStatus);

// PROTECTED – only admin can toggle or schedule
router.patch("/status",   authMiddleware, patchStatus);
router.patch("/schedule", authMiddleware, patchSchedule);

module.exports = router;
