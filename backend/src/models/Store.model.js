const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    manualOverride: {
      type: Boolean,
      default: false,
    },
    schedule: {
      openTime: {
        type: Date,
        default: null,
      },
      closeTime: {
        type: Date,
        default: null,
      },
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Store", storeSchema);
