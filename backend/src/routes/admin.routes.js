const express = require("express");
const router = express.Router();

const authorizeRoles = require("../middleware/role.middleware");
const adminController = require("../controllers/admin.controller");

// PUT /api/admin/users/:id/block
router.put(
  "/users/:id/block",
  authorizeRoles("ADMIN"),
  adminController.blockOrUnblockUser
);

module.exports = router;