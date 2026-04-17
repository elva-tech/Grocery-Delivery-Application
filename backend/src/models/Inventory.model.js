const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    availableQty: {
      type: Number,
      required: true,
      min: 0,
    },

    thresholdQty: {
      type: Number,
      default: 10,
    },
  },
  { timestamps: true }
);

// 🔍 Indexes
// Compound unique index for multi-tenant support (one inventory per product per tenant)
inventorySchema.index({ tenantId: 1, productId: 1 }, { unique: true });
// Find low-stock items for reordering
inventorySchema.index({ tenantId: 1, availableQty: 1 });
// Find items below threshold for alerts
inventorySchema.index({ tenantId: 1, availableQty: 1, thresholdQty: 1 });

module.exports = mongoose.model("Inventory", inventorySchema);
