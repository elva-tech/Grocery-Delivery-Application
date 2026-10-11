/**
 * Set paymentGateway to RAZORPAY only where it is still unset and Razorpay
 * credentials are already stored. Does not default any other tenant to Razorpay.
 *
 * Usage: node scripts/migrate-vendor-payment-gateway.js
 */
require("dotenv").config({
  path: require("path").join(__dirname, "../.env"),
  override: true,
});
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");
const Vendor = require("../src/models/Vendor.model");

const unsetGateway = {
  $or: [
    { paymentGateway: { $exists: false } },
    { paymentGateway: null },
    { paymentGateway: "" },
  ],
};

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const vendors = await Vendor.find({
    ...unsetGateway,
    "razorpay.keyId": { $type: "string", $nin: ["", null] },
    "razorpay.encryptedKeySecret": { $type: "string", $nin: ["", null] },
  }).select("tenantId");

  const updated = [];
  for (const vendor of vendors) {
    const result = await Vendor.updateOne(
      { _id: vendor._id, ...unsetGateway },
      { $set: { paymentGateway: "RAZORPAY" } }
    );
    if (result.modifiedCount === 1) {
      updated.push(vendor.tenantId);
      console.log({ tenantId: vendor.tenantId, paymentGateway: "RAZORPAY" });
    }
  }

  console.log({ updatedCount: updated.length });
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
