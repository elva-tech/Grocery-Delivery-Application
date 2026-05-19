const mongoose = require("mongoose");
const Product = require("../models/Product.model");
const Inventory = require("../models/Inventory.model");
const {
  uploadToCloudinary,
  destroyFromCloudinary,
  MAX_PRODUCT_IMAGE_SLOTS,
} = require("../services/cloudinary.service");
const tenantPolicy = require("../config/tenantPolicy");
const {
  parseVariantsFromBody,
  normalizeVariantDefaults,
  syncProductTopLevel,
  buildVariantsForWrite,
  formatProductForCustomer,
  ensureProductVariants,
} = require("../utils/productVariants.util");

function imageValidationStatus(message) {
  if (message === "Cross-tenant image access not allowed") return 403;
  return 400;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function parseBodyNumber(value, fallback = NaN) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalize optional images from JSON body (non-file): [{ url, public_id }].
 */
function parseImagesFromJsonBody(body) {
  let raw = body.images;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const url = typeof entry.url === "string" ? entry.url.trim() : "";
    if (!url) continue;
    const public_id =
      typeof entry.public_id === "string" ? entry.public_id.trim() : "";
    out.push({ url, public_id });
  }
  return out;
}

function collectPublicIds(images) {
  const out = new Set();
  for (const im of images || []) {
    const p = im && typeof im.public_id === "string" ? im.public_id.trim() : "";
    if (p) out.add(p);
  }
  return out;
}

async function destroyRemovedProductImages(previousImages, nextImages, tenantId) {
  const prev = collectPublicIds(previousImages);
  const next = collectPublicIds(nextImages);
  for (const pid of prev) {
    if (next.has(pid)) continue;
    const chk = tenantPolicy.assertPublicIdAllowedForTenantProductOps(pid, tenantId);
    if (!chk.ok) continue;
    try {
      await destroyFromCloudinary(pid);
    } catch (e) {
      console.warn("destroyRemovedProductImages:", pid, e.message);
    }
  }
}

/**
 * @param {import("express").Request["files"]} files
 * @param {string} tenantId
 * @param {string} productId - Mongo ObjectId string
 * @param {number} [startSlotIndex] - 1-based slot (img1, img2, …)
 */
async function uploadFilesToProductImages(files, tenantId, productId, startSlotIndex = 1) {
  const images = [];
  let slot = Math.max(1, Math.floor(Number(startSlotIndex)) || 1);
  for (const file of files || []) {
    if (!file?.path) continue;
    if (slot > MAX_PRODUCT_IMAGE_SLOTS) {
      throw new Error(`At most ${MAX_PRODUCT_IMAGE_SLOTS} product images allowed`);
    }
    const { url, public_id } = await uploadToCloudinary(file.path, tenantId, "products", {
      productId: String(productId),
      slotIndex: slot,
    });
    images.push({ url, public_id });
    slot += 1;
  }
  return images;
}

function mergeProductImages(fileImages, jsonImages, legacyImageUrl) {
  const merged = [...(fileImages || []), ...(jsonImages || [])];
  if (merged.length === 0 && isNonEmptyString(legacyImageUrl)) {
    merged.push({ url: legacyImageUrl.trim(), public_id: "" });
  }
  return merged;
}

async function syncInventoriesForVariants(tenantId, product, variantInputs) {
  const normalized = normalizeVariantDefaults(variantInputs);
  const variantDocs = buildVariantsForWrite(product, normalized);
  product.variants = variantDocs;
  syncProductTopLevel(product);

  const totalStock = normalized.reduce((sum, v) => sum + v.stock, 0);
  product.isAvailable = totalStock > 0;
  await product.save();

  const keepVariantIds = new Set(product.variants.map((v) => String(v._id)));

  for (let i = 0; i < product.variants.length; i++) {
    const variant = product.variants[i];
    const input = normalized[i];
    await Inventory.findOneAndUpdate(
      { tenantId, productId: product._id, variantId: variant._id },
      {
        $set: {
          availableQty: input.stock,
          thresholdQty: input.thresholdQty,
        },
        $setOnInsert: { tenantId, productId: product._id, variantId: variant._id },
      },
      { upsert: true, new: true }
    );
  }

  const keepIds = [...keepVariantIds].map((id) => new mongoose.Types.ObjectId(id));
  await Inventory.deleteMany({
    tenantId,
    productId: product._id,
    variantId: { $nin: keepIds, $ne: null },
  });

  await Inventory.deleteMany({
    tenantId,
    productId: product._id,
    variantId: null,
  });
}

function formatAdminInventoryRow(product, inventories) {
  const variants = ensureProductVariants(product);
  const invList = inventories || [];
  const invByVariant = new Map();
  let legacyInv = null;
  for (const inv of invList) {
    if (inv.variantId) invByVariant.set(String(inv.variantId), inv);
    else legacyInv = inv;
  }

  const variantRows = variants.map((v, idx) => {
    const inv =
      invByVariant.get(String(v._id)) ||
      (variants.length === 1 && legacyInv ? legacyInv : null);
    const qty = inv?.availableQty ?? 0;
    return {
      variantId: String(v._id),
      label: v.label,
      price: v.price,
      isDefault: Boolean(v.isDefault),
      sortOrder: v.sortOrder ?? 0,
      availableQty: qty,
      thresholdQty: inv?.thresholdQty ?? 10,
    };
  });

  const totalStock = variantRows.reduce((s, r) => s + r.availableQty, 0);
  const def = variantRows.find((r) => r.isDefault) || variantRows[0];

  const imagesNorm = product.images?.length
    ? product.images
    : product.imageUrl
      ? [{ url: product.imageUrl, public_id: "" }]
      : [];

  return {
    productId: product._id,
    name: product.name,
    category: product.category,
    subcategory: product.subcategory,
    description: product.description,
    price: def?.price ?? product.price,
    unit: def?.label ?? product.unit,
    variants: variantRows,
    images: imagesNorm,
    imageUrl: imagesNorm[0]?.url || "",
    isAvailable: product.isAvailable,
    availableQty: totalStock,
    thresholdQty: def?.thresholdQty ?? 10,
  };
}

/* ================= ADD PRODUCT ================= */

const addProduct = async (req, res) => {
  try {
    const body = req.body || {};
    const { name, category, subcategory, description, imageUrl } = body;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Tenant context is required" });
    }

    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!category) missingFields.push("category");

    const variantInputs = parseVariantsFromBody(body);
    if (!variantInputs) missingFields.push("variants (at least one with label and price)");

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required field(s): ${missingFields.join(", ")}`,
      });
    }

    let normalized;
    try {
      normalized = normalizeVariantDefaults(variantInputs);
    } catch (err) {
      return res.status(400).json({ message: err.message || "Invalid variants" });
    }

    const existingProduct = await Product.findOne({ tenantId, name });
    if (existingProduct) {
      return res.status(409).json({ message: "Product with this name already exists" });
    }

    const jsonImages = parseImagesFromJsonBody(body);
    const legacyUrl = typeof imageUrl === "string" ? imageUrl.trim() : "";
    const initialImages = mergeProductImages([], jsonImages, legacyUrl);

    if (initialImages.length > 0) {
      const imgCheck0 = tenantPolicy.validateProductImagesForWrite(
        initialImages,
        tenantId
      );
      if (!imgCheck0.ok) {
        return res
          .status(imageValidationStatus(imgCheck0.message))
          .json({ message: imgCheck0.message });
      }
    }

    const def = normalized.find((v) => v.isDefault) || normalized[0];
    const product = await Product.create({
      tenantId,
      name,
      category,
      subcategory: subcategory || "",
      description: description || "",
      price: def.price,
      unit: def.label,
      variants: normalized.map((v) => ({
        label: v.label,
        price: v.price,
        isDefault: v.isDefault,
        sortOrder: v.sortOrder,
      })),
      images: initialImages,
      isAvailable: normalized.some((v) => v.stock > 0),
    });

    await syncInventoriesForVariants(tenantId, product, normalized);

    if (req.files && req.files.length > 0) {
      try {
        const startSlot = initialImages.length + 1;
        const fileImages = await uploadFilesToProductImages(
          req.files,
          tenantId,
          String(product._id),
          startSlot
        );
        const combined = [...initialImages, ...fileImages];
        const imgCheck1 = tenantPolicy.validateProductImagesForWrite(
          combined,
          tenantId
        );
        if (!imgCheck1.ok) {
          for (const fi of fileImages) {
            try {
              await destroyFromCloudinary(fi.public_id);
            } catch (_) {
              /* best effort */
            }
          }
          await Inventory.deleteMany({ tenantId, productId: product._id });
          await Product.deleteOne({ _id: product._id, tenantId });
          return res
            .status(imageValidationStatus(imgCheck1.message))
            .json({ message: imgCheck1.message });
        }
        product.images = combined;
        await product.save();
      } catch (uploadErr) {
        console.error("Add product upload error:", uploadErr);
        await Inventory.deleteMany({ tenantId, productId: product._id });
        await Product.deleteOne({ _id: product._id, tenantId });
        return res.status(502).json({
          message: uploadErr.message || "Failed to upload one or more images",
        });
      }
    }

    const saved = await Product.findById(product._id);
    return res.status(201).json({
      message: "Product added successfully",
      product: saved,
    });
  } catch (error) {
    console.error("Add Product Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ================= UPDATE PRODUCT ================= */

const updateProductFromAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const allowedFields = [
      "name",
      "price",
      "category",
      "subcategory",
      "description",
      "unit",
    ];
    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (req.body.images !== undefined) {
      let raw = req.body.images;
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          raw = [];
        }
      }
      if (Array.isArray(raw)) {
        const cleaned = raw
          .map((e) => {
            if (typeof e === "string") {
              const url = e.trim();
              return url ? { url, public_id: "" } : null;
            }
            if (e && typeof e === "object") {
              const url = typeof e.url === "string" ? e.url.trim() : "";
              if (!url) return null;
              const public_id =
                typeof e.public_id === "string" ? e.public_id.trim() : "";
              return { url, public_id };
            }
            return null;
          })
          .filter(Boolean);
        updateData.images = cleaned;
      }
    } else if (req.body.imageUrl !== undefined) {
      const u =
        typeof req.body.imageUrl === "string" ? req.body.imageUrl.trim() : "";
      updateData.images = u ? [{ url: u, public_id: "" }] : [];
    }

    if (updateData.images !== undefined) {
      const imgCheck = tenantPolicy.validateProductImagesForWrite(
        updateData.images,
        tenantId
      );
      if (!imgCheck.ok) {
        return res
          .status(imageValidationStatus(imgCheck.message))
          .json({ message: imgCheck.message });
      }
    }

    if (updateData.price !== undefined) {
      const priceNum = Number(updateData.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({ message: "Price must be a positive number" });
      }
      updateData.price = priceNum;
    }

    const product = await Product.findOne({ _id: id, tenantId });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const previousImages = [...(product.images || [])];

    Object.assign(product, updateData);

    const variantInputs = parseVariantsFromBody(req.body);
    if (variantInputs) {
      try {
        const normalized = normalizeVariantDefaults(variantInputs);
        await syncInventoriesForVariants(tenantId, product, normalized);
      } catch (err) {
        return res.status(400).json({ message: err.message || "Invalid variants" });
      }
    } else {
      await product.save();
    }

    if (updateData.images !== undefined) {
      await destroyRemovedProductImages(previousImages, product.images, tenantId);
    }

    const fresh = await Product.findById(id);
    res.status(200).json({
      message: "Product updated successfully",
      product: fresh,
    });
  } catch (error) {
    console.error("Update Product Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* ================= PRODUCT IMAGE — DELETE ================= */

const deleteProductImage = async (req, res) => {
  try {
    const { id } = req.params;
    const public_id =
      req.body && typeof req.body.public_id === "string"
        ? req.body.public_id.trim()
        : "";

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Tenant context is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    if (!public_id) {
      return res.status(400).json({ message: "public_id is required in request body" });
    }

    const product = await Product.findOne({ _id: id, tenantId }).select("images");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const exists = (product.images || []).some((img) => img.public_id === public_id);
    if (!exists) {
      return res.status(404).json({ message: "Image not found on this product" });
    }

    const pidCheck = tenantPolicy.assertPublicIdAllowedForTenantProductOps(
      public_id,
      tenantId
    );
    if (!pidCheck.ok) {
      return res.status(403).json({ message: pidCheck.message });
    }

    try {
      await destroyFromCloudinary(public_id);
    } catch (err) {
      console.error("Cloudinary destroy error:", err);
      return res.status(502).json({ message: "Failed to delete image from storage" });
    }

    await Product.updateOne(
      { _id: id, tenantId },
      { $pull: { images: { public_id } } }
    );

    const updated = await Product.findById(id);
    return res.status(200).json({
      message: "Image removed",
      product: updated,
    });
  } catch (error) {
    console.error("deleteProductImage:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ================= PRODUCT IMAGE — REPLACE ================= */

const replaceProductImage = async (req, res) => {
  try {
    const { id } = req.params;
    const oldPublicId =
      req.body && typeof req.body.public_id === "string"
        ? req.body.public_id.trim()
        : "";

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Tenant context is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    if (!req.file?.path) {
      return res.status(400).json({
        message: 'No file uploaded. Use field name "file".',
      });
    }

    if (!oldPublicId) {
      return res.status(400).json({
        message: "public_id is required (identifies the image to replace)",
      });
    }

    const product = await Product.findOne({ _id: id, tenantId }).select("images");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const imgs = product.images || [];
    const slotIndex = imgs.findIndex((img) => img.public_id === oldPublicId);
    if (slotIndex < 0) {
      return res.status(404).json({ message: "Image not found on this product" });
    }

    const oldPidCheck = tenantPolicy.assertPublicIdAllowedForTenantProductOps(
      oldPublicId,
      tenantId
    );
    if (!oldPidCheck.ok) {
      return res.status(403).json({ message: oldPidCheck.message });
    }

    let uploaded;
    try {
      uploaded = await uploadToCloudinary(req.file.path, tenantId, "products", {
        productId: String(id),
        slotIndex: slotIndex + 1,
      });
    } catch (uploadErr) {
      console.error("replaceProductImage upload:", uploadErr);
      return res.status(502).json({
        message: uploadErr.message || "Failed to upload new image",
      });
    }

    const newPidCheck = tenantPolicy.assertPublicIdAllowedForTenantProductOps(
      uploaded.public_id,
      tenantId
    );
    if (!newPidCheck.ok) {
      try {
        await destroyFromCloudinary(uploaded.public_id);
      } catch (_) {
        /* best effort */
      }
      return res.status(403).json({ message: newPidCheck.message });
    }

    const result = await Product.updateOne(
      {
        _id: id,
        tenantId,
        images: { $elemMatch: { public_id: oldPublicId } },
      },
      {
        $set: {
          "images.$": {
            url: uploaded.url,
            public_id: uploaded.public_id,
          },
        },
      }
    );

    if (result.matchedCount === 0) {
      try {
        await destroyFromCloudinary(uploaded.public_id);
      } catch (_) {
        /* best effort rollback */
      }
      return res.status(409).json({ message: "Could not update image; try again" });
    }

    if (oldPublicId && oldPublicId !== uploaded.public_id) {
      try {
        await destroyFromCloudinary(oldPublicId);
      } catch (err) {
        console.warn("replaceProductImage: old asset destroy failed", err.message);
      }
    }

    const updated = await Product.findById(id);
    return res.status(200).json({
      message: "Image replaced",
      product: updated,
    });
  } catch (error) {
    console.error("replaceProductImage:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ================= PRODUCT IMAGE — APPEND ================= */

const appendProductImages = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Tenant context is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findOne({ _id: id, tenantId });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({
        message: 'No files uploaded. Use field name "files" (multipart).',
      });
    }

    let newImages;
    try {
      const startSlot = (product.images || []).length + 1;
      newImages = await uploadFilesToProductImages(
        files,
        tenantId,
        String(product._id),
        startSlot
      );
    } catch (uploadErr) {
      console.error("appendProductImages upload:", uploadErr);
      return res.status(502).json({
        message: uploadErr.message || "Failed to upload one or more images",
      });
    }

    const combinedAppend = [...(product.images || []), ...newImages];
    const appendImgCheck = tenantPolicy.validateProductImagesForWrite(
      combinedAppend,
      tenantId
    );
    if (!appendImgCheck.ok) {
      for (const fi of newImages) {
        try {
          await destroyFromCloudinary(fi.public_id);
        } catch (_) {
          /* best effort */
        }
      }
      return res
        .status(imageValidationStatus(appendImgCheck.message))
        .json({ message: appendImgCheck.message });
    }

    await Product.updateOne(
      { _id: id, tenantId },
      { $push: { images: { $each: newImages } } }
    );

    const updated = await Product.findById(id);
    return res.status(200).json({
      message: "Images added",
      product: updated,
    });
  } catch (error) {
    console.error("appendProductImages:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ================= GET AVAILABLE PRODUCTS ================= */

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAvailableProducts = async (req, res) => {
  try {
    const category = req.query?.category?.trim();
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID missing" });
    }

    const visibility = tenantPolicy.buildProductTenantRoot(tenantId);
    const filter = {
      ...visibility,
      isAvailable: true,
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    };
    if (category) {
      const safeCategory = escapeRegex(category);
      filter.category = { $regex: `^${safeCategory}$`, $options: "i" };
    }

    const productDocs = await Product.find(filter).sort({ name: 1 }).lean();
    const productIds = productDocs.map((p) => p._id);
    const inventories = await Inventory.find({
      tenantId,
      productId: { $in: productIds },
    }).lean();

    const invByProduct = new Map();
    for (const inv of inventories) {
      const key = String(inv.productId);
      if (!invByProduct.has(key)) invByProduct.set(key, []);
      invByProduct.get(key).push(inv);
    }

    const products = [];
    for (const product of productDocs) {
      const formatted = formatProductForCustomer(
        product,
        invByProduct.get(String(product._id)) || []
      );
      if (formatted) products.push(formatted);
    }

    return res.status(200).json({ products });
  } catch (error) {
    console.error("Get Products Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ================= DELETE PRODUCT ================= */

const deleteProductFromAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findOne({ _id: id, tenantId });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    for (const img of product.images || []) {
      try {
        await destroyFromCloudinary(img.public_id);
      } catch (e) {
        console.warn("deleteProductFromAdmin: destroy failed", img.public_id, e.message);
      }
    }

    await Inventory.deleteMany({ tenantId, productId: id });
    await Product.deleteOne({ _id: id, tenantId });

    return res.status(200).json({
      message: "Product and inventory deleted successfully",
    });
  } catch (error) {
    console.error("Delete Product Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getInventory = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    const tenantId = req.user.tenantId;

    const visibility = tenantPolicy.buildProductTenantRoot(tenantId);
    const productDocs = await Product.find(visibility).sort({ name: 1 }).lean();
    const productIds = productDocs.map((p) => p._id);
    const inventories = await Inventory.find({
      tenantId,
      productId: { $in: productIds },
    }).lean();

    const invByProduct = new Map();
    for (const inv of inventories) {
      const key = String(inv.productId);
      if (!invByProduct.has(key)) invByProduct.set(key, []);
      invByProduct.get(key).push(inv);
    }

    const inventory = productDocs.map((product) =>
      formatAdminInventoryRow(product, invByProduct.get(String(product._id)) || [])
    );

    return res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    console.error("Error in getInventory:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ================= EXPORTS ================= */

module.exports = {
  addProduct,
  updateProductFromAdmin,
  getAvailableProducts,
  deleteProductFromAdmin,
  getInventory,
  deleteProductImage,
  replaceProductImage,
  appendProductImages,
};
