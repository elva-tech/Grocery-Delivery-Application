const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true, // important for future multi-customer
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      trim: true,
      default: "",
    },

    role: {
      type: String,
      enum: ["CUSTOMER", "ADMIN", "OPS"],
      default: "CUSTOMER",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
  }
);

// 🔍 Indexes
userSchema.index({ tenantId: 1, phoneNumber: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
