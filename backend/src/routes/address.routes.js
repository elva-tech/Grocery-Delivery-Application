const express = require("express");
const router = express.Router();
const addressController = require("../controllers/address.controller");

router.get("/my", addressController.listMyAddresses);
router.post("/", addressController.createAddress);
router.patch("/:addressId", addressController.updateAddress);
router.delete("/:addressId", addressController.deleteAddress);

module.exports = router;
