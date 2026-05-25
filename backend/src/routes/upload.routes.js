const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const upload = require("../middleware/uploadGeneric");
const { authMiddleware } = require("../middleware/auth.middleware");
const Product = require("../models/Product.model");
const {
  uploadToCloudinary,
  isAllowedUploadCategory,
  MAX_PRODUCT_IMAGE_SLOTS,
} = require("../services/cloudinary.service");

function resolveCategory(req) {
  const fromParam = req.params && req.params.category;
  const fromQuery = req.query && req.query.category;
  let category = (fromParam || fromQuery || "").trim().toLowerCase();
  if (!category) {
    const match = String(req.originalUrl || "").match(/\/api\/upload\/([^/?]+)/i);
    if (match) category = match[1].toLowerCase();
  }
  if (!category && req.user?.role === "CUSTOMER") {
    category = "returns";
  }
  return category;
}

async function handleUpload(req, res) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Use field name "file".',
    });
  }

  if (!req.user || !req.user.tenantId) {
    return res.status(401).json({
      success: false,
      message: "Tenant context is required for uploads.",
    });
  }

  const category = resolveCategory(req);
  if (!category) {
    return res.status(400).json({
      success: false,
      message:
        "Missing category. Use path /api/upload/:category or query ?category= (products, banners, returns, logo).",
    });
  }
  if (!isAllowedUploadCategory(category)) {
    return res.status(400).json({
      success: false,
      message: "Invalid category. Allowed values: products, banners, returns, logo.",
    });
  }

  try {
    let uploadOpts = req.file.originalname;
    if (category === "products") {
      const productId = String(req.query.productId || "").trim();
      const slotRaw = req.query.slotIndex ?? req.query.slot;
      const slotIndex =
        slotRaw !== undefined && slotRaw !== "" ? parseInt(String(slotRaw), 10) : NaN;
      if (productId && mongoose.Types.ObjectId.isValid(productId)) {
        if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > MAX_PRODUCT_IMAGE_SLOTS) {
          return res.status(400).json({
            success: false,
            message: `slotIndex query is required with productId (1–${MAX_PRODUCT_IMAGE_SLOTS}).`,
          });
        }
        const owns = await Product.exists({
          _id: productId,
          tenantId: req.user.tenantId,
        });
        if (!owns) {
          return res.status(404).json({
            success: false,
            message: "Product not found for this tenant.",
          });
        }
        uploadOpts = { productId, slotIndex };
      }
    }

    const { url, public_id } = await uploadToCloudinary(
      req.file.path,
      req.user.tenantId,
      category,
      uploadOpts
    );
    return res.json({
      success: true,
      url,
      public_id,
    });
  } catch (err) {
    console.error("Cloudinary upload failed:", err.message || err);
    return res.status(502).json({
      success: false,
      message: "Failed to upload file to storage.",
    });
  }
}

// Register exact "/" before "/:category" so POST /api/upload is not captured as a category name.
router.post("/", authMiddleware, upload.single("file"), handleUpload);
router.post(
  "/:category",
  authMiddleware,
  upload.single("file"),
  handleUpload
);

module.exports = router;
