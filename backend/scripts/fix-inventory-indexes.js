/**
 * Drop legacy unique indexes on inventories that only allowed one row per product.
 * Ensures compound unique index: { tenantId, productId, variantId }.
 *
 * Run: node scripts/fix-inventory-indexes.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const Inventory = require("../src/models/Inventory.model");

const LEGACY_INDEX_NAMES = [
  "productId_1",
  "tenantId_1_productId_1",
];

async function fixIndexes() {
  await connectDB();
  const coll = Inventory.collection;

  const existing = await coll.indexes();
  console.log("Current indexes on inventories:");
  for (const idx of existing) {
    console.log(" -", idx.name, JSON.stringify(idx.key), idx.unique ? "(unique)" : "");
  }

  for (const name of LEGACY_INDEX_NAMES) {
    const found = existing.some((i) => i.name === name);
    if (!found) {
      console.log(`Skip drop (not found): ${name}`);
      continue;
    }
    try {
      await coll.dropIndex(name);
      console.log(`Dropped legacy index: ${name}`);
    } catch (err) {
      console.warn(`Could not drop ${name}:`, err.message);
    }
  }

  await Inventory.syncIndexes();
  console.log("\nIndexes after sync:");
  const after = await coll.indexes();
  for (const idx of after) {
    console.log(" -", idx.name, JSON.stringify(idx.key), idx.unique ? "(unique)" : "");
  }

  await mongoose.disconnect();
  console.log("\nDone. Restart the API and save products with multiple variants again.");
}

fixIndexes().catch((err) => {
  console.error(err);
  process.exit(1);
});
