const express = require("express");
const router = express.Router();

const {
  authMiddleware,
  adminOnly
} = require("../middleware/auth.middleware");
const { resolveTenant } = require("../middleware/tenant.middleware");
const upload = require("../middleware/uploadGeneric");

router.use(resolveTenant);

const {
  addProduct,
  updateProductFromAdmin,
  getAvailableProducts,
  deleteProductImage,
  replaceProductImage,
  appendProductImages,
} = require("../controllers/product.controller");

/**
 * Customer API
 */
router.get("/", getAvailableProducts);

/**
 * Admin APIs — register /admin/... before /:id/... so "admin" is not captured as :id
 */
router.post(
  "/admin/products",
  authMiddleware,
  adminOnly,
  upload.array("files", 20),
  addProduct
);

router.put(
  "/admin/products/:id",
  authMiddleware,
  adminOnly,
  updateProductFromAdmin
);

/** Single product image — delete (body: { public_id }) */
router.delete(
  "/:id/image",
  authMiddleware,
  adminOnly,
  deleteProductImage
);

/** Replace one image (multipart: file + public_id of existing image) */
router.put(
  "/:id/image",
  authMiddleware,
  adminOnly,
  upload.single("file"),
  replaceProductImage
);

/** Append images (multipart: files[]) */
router.post(
  "/:id/images",
  authMiddleware,
  adminOnly,
  upload.array("files", 20),
  appendProductImages
);

module.exports = router;