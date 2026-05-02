const cloudinary = require("cloudinary").v2;
const fs = require("fs").promises;
const path = require("path");

/** Allowed upload segments under {root}/{tenantId}/… */
const ALLOWED_UPLOAD_CATEGORIES = Object.freeze([
  "products",
  "banners",
  "returns",
  "bills",
  /** Storefront / admin branding: {root}/{tenantId}/logo/store-logo */
  "logo",
]);

const MAX_PRODUCT_IMAGE_SLOTS = 30;

function getAssetsRootFolder() {
  return process.env.CLOUDINARY_ASSETS_ROOT || "grocery_app";
}

function isAllowedUploadCategory(category) {
  return typeof category === "string" && ALLOWED_UPLOAD_CATEGORIES.includes(category);
}

/**
 * Safe basename for Cloudinary public_id suffix (no path separators).
 * @param {string} name
 */
function sanitizeForPublicIdFragment(name) {
  const base = path.basename(name || "file") || "file";
  return base.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120);
}

function isObjectIdString(s) {
  return typeof s === "string" && /^[a-f\d]{24}$/i.test(s.trim());
}

/**
 * Product image slot upload: { productId, slotIndex } → single folder …/products/,
 * public_id `{productId}_img{slotIndex}` (no per-product subfolder).
 * @param {object} opts
 * @returns {boolean}
 */
function isProductSlotOpts(opts) {
  return (
    opts &&
    typeof opts === "object" &&
    isObjectIdString(opts.productId) &&
    Number.isInteger(opts.slotIndex) &&
    opts.slotIndex >= 1 &&
    opts.slotIndex <= MAX_PRODUCT_IMAGE_SLOTS
  );
}

/**
 * Invoice/order-summary upload options: deterministic file key per tenant.
 * @param {object} opts
 * @returns {boolean}
 */
function isInvoiceDocOpts(opts) {
  return (
    opts &&
    typeof opts === "object" &&
    typeof opts.invoiceNumber === "string" &&
    opts.invoiceNumber.trim().length > 0
  );
}

function ensureCloudinaryConfigured() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary credentials missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in environment variables."
    );
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
}

/**
 * Upload a local file (e.g. from multer) to Cloudinary, then remove the local copy.
 *
 * @param {string} filePath - Absolute path to the file on disk
 * @param {string} tenantId - Tenant identifier
 * @param {string} category - One of ALLOWED_UPLOAD_CATEGORIES
 * @param {string|{ productId: string, slotIndex: number }|{ invoiceNumber: string }} [originalFileNameOrOpts]
 *        Legacy: original filename string → timestamp + basename **without extension** (avoids .webp.webp).
 *        Products: { productId, slotIndex } → …/products/{productId}_img{slotIndex} (overwrite same slot).
 *        Bills: { invoiceNumber } → …/bills/{invoiceNumber} (overwrite same invoice doc).
 * @returns {Promise<{ url: string, public_id: string }>}
 */
async function uploadToCloudinary(filePath, tenantId, category, originalFileNameOrOpts) {
  if (!isAllowedUploadCategory(category)) {
    throw new Error("Invalid upload category");
  }
  if (!tenantId || typeof tenantId !== "string") {
    throw new Error("tenantId is required");
  }

  ensureCloudinaryConfigured();

  const root = String(getAssetsRootFolder()).replace(/\/+$/, "");
  const t = String(tenantId).trim();

  let folderPath;
  let publicInner;

  const opts =
    originalFileNameOrOpts && typeof originalFileNameOrOpts === "object"
      ? originalFileNameOrOpts
      : null;

  if (category === "logo") {
    folderPath = `${root}/${t}/logo`;
    publicInner = "store-logo";
  } else if (category === "products" && isProductSlotOpts(opts)) {
    const pid = String(opts.productId).trim();
    folderPath = `${root}/${t}/products`;
    publicInner = `${pid}_img${opts.slotIndex}`;
  } else if (category === "bills" && isInvoiceDocOpts(opts)) {
    folderPath = `${root}/${t}/bills`;
    publicInner = sanitizeForPublicIdFragment(opts.invoiceNumber.trim().toLowerCase());
  } else {
    folderPath = `${root}/${t}/${category}`;
    const rawName =
      typeof originalFileNameOrOpts === "string" && originalFileNameOrOpts
        ? originalFileNameOrOpts
        : path.basename(filePath);
    const stem = path.parse(rawName).name || "file";
    publicInner = `${Date.now()}-${sanitizeForPublicIdFragment(stem)}`;
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folderPath,
      public_id: publicInner,
      resource_type: "auto",
      overwrite: true,
    });
    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  } finally {
    try {
      await fs.unlink(filePath);
    } catch (_) {
      /* ignore missing file */
    }
  }
}

/**
 * Remove asset from Cloudinary. No-op if publicId is empty (e.g. external URL only).
 * @param {string} publicId - Full Cloudinary public_id (includes folder path)
 * @returns {Promise<object>} Cloudinary API result or { result: "skipped" }
 */
async function destroyFromCloudinary(publicId) {
  if (!publicId || typeof publicId !== "string" || !publicId.trim()) {
    return { result: "skipped" };
  }
  ensureCloudinaryConfigured();
  return cloudinary.uploader.destroy(publicId.trim(), { invalidate: true });
}

/**
 * Best-effort public_id from a Cloudinary delivery URL (for assets without stored public_id).
 */
function publicIdFromCloudinaryDeliveryUrl(url) {
  if (!url || typeof url !== "string") return "";
  const u = url.trim();
  if (!u.toLowerCase().includes("res.cloudinary.com")) return "";
  const marker = "/upload/";
  const pos = u.indexOf(marker);
  if (pos === -1) return "";
  let tail = u.slice(pos + marker.length).split("?")[0];
  tail = tail.replace(/^v\d+\//, "");
  tail = decodeURIComponent(tail);
  if (!tail) return "";
  return tail.replace(/\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i, "") || tail;
}

module.exports = {
  uploadToCloudinary,
  destroyFromCloudinary,
  getAssetsRootFolder,
  publicIdFromCloudinaryDeliveryUrl,
  ALLOWED_UPLOAD_CATEGORIES,
  isAllowedUploadCategory,
  MAX_PRODUCT_IMAGE_SLOTS,
};
