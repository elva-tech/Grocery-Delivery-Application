const mongoose = require("mongoose");

function parseBodyNumber(value, fallback = NaN) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parse variants from request body (JSON array or legacy single price/unit/stock).
 */
function parseVariantsFromBody(body) {
  let raw = body?.variants;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }

  if (Array.isArray(raw) && raw.length > 0) {
    const parsed = [];
    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      if (!row || typeof row !== "object") continue;
      const label = String(row.label ?? row.unit ?? "").trim();
      const price = parseBodyNumber(row.price);
      const stock = parseBodyNumber(row.stock ?? row.stocks ?? row.availableQty, 0);
      const threshold = parseBodyNumber(row.threshold ?? row.thresholdQty, 10);
      if (!label) continue;
      if (isNaN(price) || price <= 0) continue;
      parsed.push({
        label,
        price,
        stock: Math.max(0, Math.floor(isNaN(stock) ? 0 : stock)),
        thresholdQty: Math.max(0, Math.floor(isNaN(threshold) ? 10 : threshold)),
        isDefault: Boolean(row.isDefault),
        sortOrder: parseBodyNumber(row.sortOrder, i),
        variantId:
          row.variantId && mongoose.Types.ObjectId.isValid(String(row.variantId))
            ? String(row.variantId)
            : row._id && mongoose.Types.ObjectId.isValid(String(row._id))
              ? String(row._id)
              : null,
      });
    }
    return parsed.length > 0 ? parsed : null;
  }

  const unit = typeof body?.unit === "string" ? body.unit.trim() : "";
  const price = parseBodyNumber(body?.price);
  const stock = parseBodyNumber(body?.stocks ?? body?.stock, 0);
  const threshold = parseBodyNumber(body?.threshold, 10);
  if (!unit || isNaN(price) || price <= 0) return null;

  return [
    {
      label: unit,
      price,
      stock: Math.max(0, Math.floor(isNaN(stock) ? 0 : stock)),
      thresholdQty: Math.max(0, Math.floor(isNaN(threshold) ? 10 : threshold)),
      isDefault: true,
      sortOrder: 0,
      variantId: null,
    },
  ];
}

function normalizeVariantDefaults(variantInputs) {
  const sorted = [...variantInputs].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const labels = new Set();
  for (const v of sorted) {
    const key = v.label.toLowerCase();
    if (labels.has(key)) {
      throw new Error(`Duplicate variant label: ${v.label}`);
    }
    labels.add(key);
  }
  let defaultIdx = sorted.findIndex((v) => v.isDefault);
  if (defaultIdx < 0) defaultIdx = 0;
  return sorted.map((v, i) => ({
    ...v,
    isDefault: i === defaultIdx,
    sortOrder: i,
  }));
}

function getDefaultVariant(variants) {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  return variants.find((v) => v.isDefault) || variants[0];
}

function syncProductTopLevel(product) {
  const def = getDefaultVariant(product.variants);
  if (!def) return product;
  product.price = def.price;
  product.unit = def.label;
  return product;
}

function ensureProductVariants(product) {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants;
  }
  return [
    {
      _id: product._id,
      label: product.unit || "Standard",
      price: product.price,
      isDefault: true,
      sortOrder: 0,
    },
  ];
}

function findVariantOnProduct(product, variantId) {
  const variants = ensureProductVariants(product);
  if (!variantId) return getDefaultVariant(variants);
  const idStr = String(variantId);
  return (
    variants.find((v) => String(v._id) === idStr) ||
    getDefaultVariant(variants)
  );
}

function buildVariantsForWrite(product, variantInputs) {
  const normalized = normalizeVariantDefaults(variantInputs);
  const existing = Array.isArray(product?.variants) ? product.variants : [];
  const byId = new Map(existing.map((v) => [String(v._id), v]));
  const byLabel = new Map(existing.map((v) => [String(v.label).toLowerCase(), v]));

  return normalized.map((input) => {
    if (input.variantId && byId.has(input.variantId)) {
      const prev = byId.get(input.variantId);
      prev.label = input.label;
      prev.price = input.price;
      prev.isDefault = input.isDefault;
      prev.sortOrder = input.sortOrder;
      return prev;
    }
    const labelKey = input.label.toLowerCase();
    if (byLabel.has(labelKey)) {
      const prev = byLabel.get(labelKey);
      prev.label = input.label;
      prev.price = input.price;
      prev.isDefault = input.isDefault;
      prev.sortOrder = input.sortOrder;
      return prev;
    }
    return {
      label: input.label,
      price: input.price,
      isDefault: input.isDefault,
      sortOrder: input.sortOrder,
    };
  });
}

function formatVariantForClient(variant, inventoryRow) {
  const qty = inventoryRow?.availableQty ?? 0;
  return {
    variantId: String(variant._id),
    label: variant.label,
    price: variant.price,
    isDefault: Boolean(variant.isDefault),
    sortOrder: variant.sortOrder ?? 0,
    availableQty: qty,
    inStock: qty > 0,
  };
}

function formatProductForCustomer(product, inventoryRows) {
  const variants = ensureProductVariants(product);
  const invByVariant = new Map();
  for (const inv of inventoryRows || []) {
    if (inv.variantId) invByVariant.set(String(inv.variantId), inv);
  }

  let legacyInv = null;
  for (const inv of inventoryRows || []) {
    if (!inv.variantId) legacyInv = inv;
  }

  const clientVariants = variants.map((v, idx) => {
    let inv =
      invByVariant.get(String(v._id)) ||
      (variants.length === 1 && legacyInv ? legacyInv : null);
    if (!inv && idx === 0 && legacyInv) inv = legacyInv;
    return formatVariantForClient(v, inv);
  });

  const inStockVariants = clientVariants.filter((v) => v.inStock);
  if (inStockVariants.length === 0) return null;

  const def =
    inStockVariants.find((v) => v.isDefault) ||
    inStockVariants[0];

  const imagesNorm =
    Array.isArray(product.images) && product.images.length > 0
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
    price: def.price,
    unit: def.label,
    variants: clientVariants,
    variantCount: clientVariants.length,
    availableQty: def.availableQty,
    images: imagesNorm,
    imageUrl: imagesNorm[0]?.url || "",
  };
}

module.exports = {
  parseBodyNumber,
  parseVariantsFromBody,
  normalizeVariantDefaults,
  getDefaultVariant,
  syncProductTopLevel,
  ensureProductVariants,
  findVariantOnProduct,
  buildVariantsForWrite,
  formatProductForCustomer,
};
