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
      enum: ["CUSTOMER", "ADMIN", "OPS", "RIDER"],
      default: "CUSTOMER",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    password: {
      type: String,
      default: "",
      select: false, // never returned in queries by default
    },

    riderProfile: {
      licenseNumber: String,
      vehicle: String,
      averageRating: Number,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
  }
);

// 🔍 Indexes
// Unique phone per tenant
userSchema.index({ tenantId: 1, phoneNumber: 1 }, { unique: true });
// Query users by role (admin, customer, rider, ops)
userSchema.index({ tenantId: 1, role: 1 });
// Query active/inactive users
userSchema.index({ tenantId: 1, isActive: 1 });
// Sort users by creation date
userSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
