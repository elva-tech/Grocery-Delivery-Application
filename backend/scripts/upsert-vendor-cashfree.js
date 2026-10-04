/**
 * Save Cashfree credentials for one tenant and set paymentGateway to CASHFREE.
 * Usage:
 *   node scripts/upsert-vendor-cashfree.js <tenantId> SANDBOX
 *   node scripts/upsert-vendor-cashfree.js <tenantId> PRODUCTION
 *
 * SANDBOX reads CASHFREE_SANDBOX_APP_ID, CASHFREE_SANDBOX_SECRET_KEY,
 * and CASHFREE_SANDBOX_WEBHOOK_SECRET.
 * PRODUCTION reads CASHFREE_PRODUCTION_APP_ID, CASHFREE_PRODUCTION_SECRET_KEY,
 * and CASHFREE_PRODUCTION_WEBHOOK_SECRET.
 *
 * Supply those values only for this command. Do not commit them.
 * Secrets are encrypted before they are stored. Nothing secret is printed.
 */
require("dotenv").config({
  path: require("path").join(__dirname, "../.env"),
  override: true,
});
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");
const Vendor = require("../src/models/Vendor.model");
const { encrypt } = require("../src/utils/encryption");

const tenantId = process.argv[2]?.trim();
const environment = String(process.argv[3] || "").trim().toUpperCase();
const prefix =
  environment === "PRODUCTION"
    ? "CASHFREE_PRODUCTION"
    : environment === "SANDBOX"
      ? "CASHFREE_SANDBOX"
      : "";
const appId = prefix ? process.env[`${prefix}_APP_ID`] : "";
const secretKey = prefix ? process.env[`${prefix}_SECRET_KEY`] : "";
const webhookSecret = prefix ? process.env[`${prefix}_WEBHOOK_SECRET`] : "";

async function main() {
  if (!tenantId || !prefix) {
    throw new Error(
      "Usage: node scripts/upsert-vendor-cashfree.js <tenantId> SANDBOX|PRODUCTION"
    );
  }
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set");
  }
  if (!process.env.MASTER_ENCRYPTION_KEY) {
    throw new Error("MASTER_ENCRYPTION_KEY is not set");
  }
  if (!appId || !secretKey || !webhookSecret) {
    throw new Error(
      `${prefix}_APP_ID, ${prefix}_SECRET_KEY, and ${prefix}_WEBHOOK_SECRET are required`
    );
  }

  await mongoose.connect(process.env.MONGO_URI);

  const vendor = await Vendor.findOneAndUpdate(
    { tenantId },
    {
      $set: {
        tenantId,
        paymentGateway: "CASHFREE",
        "cashfree.appId": appId,
        "cashfree.encryptedSecretKey": encrypt(secretKey),
        "cashfree.encryptedWebhookSecret": encrypt(webhookSecret),
        "cashfree.environment": environment,
        "cashfree.onboardingStatus": "ACTIVE",
        "cashfree.accountStatus": "ACTIVE",
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  console.log("Vendor Cashfree config saved:", {
    tenantId: vendor.tenantId,
    paymentGateway: vendor.paymentGateway,
    environment: vendor.cashfree.environment,
    onboardingStatus: vendor.cashfree.onboardingStatus,
    accountStatus: vendor.cashfree.accountStatus,
    appIdConfigured: Boolean(vendor.cashfree.appId),
    secretKeyConfigured: Boolean(vendor.cashfree.encryptedSecretKey),
    webhookSecretConfigured: Boolean(vendor.cashfree.encryptedWebhookSecret),
  });

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  try {
    await mongoose.disconnect();
  } catch {
    // already disconnected
  }
  process.exit(1);
});
