process.env.MASTER_ENCRYPTION_KEY = "elva-vendor-secrets-change-in-production";
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Vendor = require("../src/models/Vendor.model");
const { encrypt } = require("../src/utils/encryption");

const OUT = path.join(__dirname, "../razorpay-update-result.json");
const MONGO_URI = "mongodb+srv://admin:s%24gh85r46@apnakart.pqdchef.mongodb.net/?appName=apnaKart";
const KEY_ID = "rzp_test_SaHmJpDs42QvIp";
const KEY_SECRET = "YHBaSBN6vHpzL13SN8zHXNdC";
const WEBHOOK_SECRET = "your_razorpay_webhook_secret";
const TENANTS = ["sales", "enandi"];

async function main() {
  const result = { ok: false, tenants: [], error: null };
  try {
    await mongoose.connect(MONGO_URI);
    for (const tenantId of TENANTS) {
      const vendor = await Vendor.findOneAndUpdate(
        { tenantId },
        {
          $set: {
            tenantId,
            "razorpay.keyId": KEY_ID,
            "razorpay.encryptedKeySecret": encrypt(KEY_SECRET),
            "razorpay.encryptedWebhookSecret": encrypt(WEBHOOK_SECRET),
            "razorpay.onboardingStatus": "ACTIVE",
            "razorpay.accountStatus": "ACTIVE",
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
      result.tenants.push({
        tenantId: vendor.tenantId,
        keyId: vendor.razorpay.keyId,
        onboardingStatus: vendor.razorpay.onboardingStatus,
        accountStatus: vendor.razorpay.accountStatus,
      });
    }
    result.ok = true;
  } catch (err) {
    result.error = err.message || String(err);
  } finally {
    try { await mongoose.disconnect(); } catch (_) {}
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  }
}

main();
