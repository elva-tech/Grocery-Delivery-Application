/**
 * One-time migration: legacy products (single price/unit) → variants + per-variant inventory.
 * Run: node scripts/migrate-product-variants.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const Product = require("../src/models/Product.model");
const Inventory = require("../src/models/Inventory.model");

async function migrate() {
  await connectDB();
  const products = await Product.find({});
  let updated = 0;

  for (const product of products) {
    if (Array.isArray(product.variants) && product.variants.length > 0) continue;

    const inv = await Inventory.findOne({
      tenantId: product.tenantId,
      productId: product._id,
    });

    const label = product.unit || "Standard";
    const price = product.price;
    const stock = inv?.availableQty ?? 0;
    const threshold = inv?.thresholdQty ?? 10;

    product.variants = [
      {
        label,
        price,
        isDefault: true,
        sortOrder: 0,
      },
    ];
    product.price = price;
    product.unit = label;
    product.isAvailable = stock > 0;
    await product.save();

    const variantId = product.variants[0]._id;

    if (inv) {
      inv.variantId = variantId;
      inv.availableQty = stock;
      inv.thresholdQty = threshold;
      await inv.save();
    } else {
      await Inventory.create({
        tenantId: product.tenantId,
        productId: product._id,
        variantId,
        availableQty: stock,
        thresholdQty: threshold,
      });
    }

    updated += 1;
  }

  console.log(`Migrated ${updated} product(s) to variant model.`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
