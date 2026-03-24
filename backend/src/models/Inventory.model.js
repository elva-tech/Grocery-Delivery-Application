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

// Compound unique index for multi-tenant support
inventorySchema.index({ tenantId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model("Inventory", inventorySchema);
