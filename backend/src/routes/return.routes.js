const express = require("express");

const router = express.Router();

const returnController = require("../controllers/return.controller");


/* CUSTOMER */

router.post(
"/create",
returnController.createReturnRequest
);


/* ADMIN */

router.get(
"/all",
returnController.getAllReturns
);


router.put(
"/approve/:id",
returnController.approveReturn
);


router.put(
"/reject/:id",
returnController.rejectReturn
);

module.exports = router;