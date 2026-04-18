const express      = require("express");
const router       = express.Router();
const { createTenant } = require("../controllers/tenant.controller");

// Public — no auth required (this IS how an admin account first gets created)
router.post("/create", createTenant);

module.exports = router;
