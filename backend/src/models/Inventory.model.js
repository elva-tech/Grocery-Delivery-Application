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

    /** Subdocument _id from Product.variants; null only for legacy rows. */
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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

inventorySchema.index({ tenantId: 1, productId: 1, variantId: 1 }, { unique: true });
inventorySchema.index({ tenantId: 1, availableQty: 1 });
inventorySchema.index({ tenantId: 1, availableQty: 1, thresholdQty: 1 });

module.exports = mongoose.model("Inventory", inventorySchema);
