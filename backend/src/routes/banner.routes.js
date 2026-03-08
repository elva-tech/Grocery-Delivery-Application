const express = require("express");
const router = express.Router();

const bannerController = require("../controllers/banner.controller");
const upload = require("../middleware/uploadBanner");

/**
 * ADMIN UPLOAD BANNER
 */
router.post(
  "/create-banner",
  upload.single("image"),
  bannerController.createBanner
);

/**
 * GET BANNERS FOR MOBILE APP
 */
router.get(
  "/get-banners",
  bannerController.getBanners
);

module.exports = router;