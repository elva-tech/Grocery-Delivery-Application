const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    razorpay: {
      keyId: { type: String, default: null },
      encryptedKeySecret: { type: String, default: null },
      encryptedWebhookSecret: { type: String, default: null },
      onboardingStatus: {
        type: String,
        enum: ["PENDING", "ACTIVE"],
        default: "PENDING",
      },
      accountStatus: {
        type: String,
        enum: ["ACTIVE", "DISABLED"],
        default: "ACTIVE",
      },
    },
    paymentGateway: {
      type: String,
      enum: ["RAZORPAY", "CASHFREE"],
    },
    cashfree: {
      appId: { type: String, default: null },
      encryptedSecretKey: { type: String, default: null },
      encryptedWebhookSecret: { type: String, default: null },
      environment: {
        type: String,
        enum: ["SANDBOX", "PRODUCTION"],
      },
      onboardingStatus: {
        type: String,
        enum: ["PENDING", "ACTIVE"],
        default: "PENDING",
      },
      accountStatus: {
        type: String,
        enum: ["ACTIVE", "DISABLED"],
        default: "ACTIVE",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vendor", vendorSchema);
