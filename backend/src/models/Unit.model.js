const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Unique per tenant (case-insensitive handled by storing uppercase)
unitSchema.index({ name: 1, tenantId: 1 }, { unique: true });

module.exports = mongoose.model('Unit', unitSchema);
