const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const { resolveTenant } = require("../middleware/tenant.middleware");
const { getSettings, updateSettings } = require("../controllers/settings.controller");

router.use(resolveTenant);

// Public GET — customer checkout needs this without auth
router.get("/", getSettings);

// Admin only PUT
router.put("/", authMiddleware, updateSettings);

module.exports = router;
