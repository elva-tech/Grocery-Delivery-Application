const mongoose = require("mongoose");

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

    price: {
      type: Number,
      required: true,
    },

    unit: {
      type: String,
      default: "",
    },
    
    imageUrl: {
      type: String,
      default: ""
    },

    description: {
      type: String,
      default: ""
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// 🔍 Indexes
// Compound index for tenant + category filtering
productSchema.index({ tenantId: 1, category: 1 });
// Query available products
productSchema.index({ tenantId: 1, isAvailable: 1 });
// List available products sorted by newest
productSchema.index({ tenantId: 1, isAvailable: 1, createdAt: -1 });
// Search by name (text search)
productSchema.index({ tenantId: 1, name: "text" });

module.exports = mongoose.model("Product", productSchema);
