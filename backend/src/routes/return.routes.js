const express = require("express");

const router = express.Router();

const returnController = require("../controllers/return.controller");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const { resolveTenant } = require("../middleware/tenant.middleware");

router.use(resolveTenant);


/* CUSTOMER */

router.post(
"/create",
authMiddleware,
returnController.createReturnRequest
);


/* ADMIN */

router.get(
"/all",
authMiddleware,
adminOnly,
returnController.getAllReturns
);


router.put(
"/approve/:id",
authMiddleware,
adminOnly,
returnController.approveReturn
);


router.put(
"/reject/:id",
authMiddleware,
adminOnly,
returnController.rejectReturn
);

module.exports = router;