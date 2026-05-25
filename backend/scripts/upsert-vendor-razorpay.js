/**
 * Upsert vendor Razorpay config for a tenant (encrypts secrets at rest).
 * Usage: node scripts/upsert-vendor-razorpay.js <tenantId>
 * Credentials: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET from .env
 */
require("dotenv").config({
  path: require("path").join(__dirname, "../.env"),
  override: true,
});
const mongoose = require("mongoose");
const Vendor = require("../src/models/Vendor.model");
const { encrypt } = require("../src/utils/encryption");

const tenantId = process.argv[2]?.trim();
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

async function main() {
  if (!tenantId) {
    throw new Error(
      "tenantId is required. Usage: node scripts/upsert-vendor-razorpay.js <tenantId>"
    );
  }
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set");
  }
  if (!keyId || !keySecret || !webhookSecret) {
    throw new Error(
      "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET are required"
    );
  }

  await mongoose.connect(process.env.MONGO_URI);

  const vendor = await Vendor.findOneAndUpdate(
    { tenantId },
    {
      $set: {
        tenantId,
        "razorpay.keyId": keyId,
        "razorpay.encryptedKeySecret": encrypt(keySecret),
        "razorpay.encryptedWebhookSecret": encrypt(webhookSecret),
        "razorpay.onboardingStatus": "ACTIVE",
        "razorpay.accountStatus": "ACTIVE",
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  console.log("Vendor Razorpay config saved:", {
    tenantId: vendor.tenantId,
    keyId: vendor.razorpay.keyId,
    onboardingStatus: vendor.razorpay.onboardingStatus,
    accountStatus: vendor.razorpay.accountStatus,
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
