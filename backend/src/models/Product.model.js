const mongoose = require("mongoose");

const productImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    public_id: { type: String, default: "" },
  },
  { _id: false }
);

const productVariantSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    isDefault: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

const productFeatureSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      index: true,
    },

    subcategory: {
      type: String,
      default: "",
      index: true,
    },

    /** Display price from default variant (backward compatible). */
    price: {
      type: Number,
      required: true,
    },

    /** Display unit label from default variant (backward compatible). */
    unit: {
      type: String,
      default: "",
    },

    variants: {
      type: [productVariantSchema],
      default: [],
    },

    images: {
      type: [productImageSchema],
      default: [],
    },

    description: {
      type: String,
      default: "",
    },

    /** Optional highlight badges shown on product detail (e.g. "100% Organic"). */
    productFeatures: {
      type: [productFeatureSchema],
      default: [],
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },

    /** When false, customers cannot request a return for this product after delivery. */
    returnAllowed: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

productSchema.index({ tenantId: 1, category: 1 });
productSchema.index({ tenantId: 1, isAvailable: 1 });
productSchema.index({ tenantId: 1, isAvailable: 1, createdAt: -1 });
productSchema.index({ tenantId: 1, name: "text" });

module.exports = mongoose.model("Product", productSchema);
