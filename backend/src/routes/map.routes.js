const express = require("express");
const {
  getMapConfig,
  searchPlaces,
  processLocation,
} = require("../controllers/map.controller");

const router = express.Router();

router.get("/config", getMapConfig);
router.get("/search", searchPlaces);
router.post("/process", processLocation);

module.exports = router;
