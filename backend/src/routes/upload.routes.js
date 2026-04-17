const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadGeneric");
const { uploadLocalFileToCloudinary } = require("../services/storage.service");

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Use field name "file".',
    });
  }

  try {
    const url = await uploadLocalFileToCloudinary(req.file.path);
    return res.json({
      success: true,
      url,
    });
  } catch (err) {
    console.error("Cloudinary upload failed:", err.message || err);
    return res.status(502).json({
      success: false,
      message: "Failed to upload file to storage.",
    });
  }
});

module.exports = router;
