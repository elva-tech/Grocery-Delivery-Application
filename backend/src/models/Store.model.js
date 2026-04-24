const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    tenantId:       { type: String, required: true, unique: true },
    name:           { type: String, required: true },
    isOpen:         { type: Boolean, default: true },
    manualOverride: { type: Boolean, default: false },
    schedule: {
      openTime:  { type: Date, default: null },
      closeTime: { type: Date, default: null },
      startDate: { type: Date, default: null },
      endDate:   { type: Date, default: null },
      type:      { type: String, default: "TIME" },
      reason:    { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Store", storeSchema);
