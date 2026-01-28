// Script to seed dummy data for users, products, and inventory
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./src/config/db");
const User = require("./src/models/User.model");
const Product = require("./src/models/Product.model");
const Inventory = require("./src/models/Inventory.model");

async function seed() {
  await connectDB();
  const tenantId = "demo-tenant";

  // Clear existing data
  await User.deleteMany({ tenantId });
  await Product.deleteMany({ tenantId });
  await Inventory.deleteMany({ tenantId });

  // Users
  await User.insertMany([
    { tenantId, phoneNumber: "1111111111", name: "Alice", role: "CUSTOMER", isActive: true },
    { tenantId, phoneNumber: "2222222222", name: "Bob", role: "ADMIN", isActive: true },
    { tenantId, phoneNumber: "3333333333", name: "Charlie", role: "OPS", isActive: true },
    { tenantId, phoneNumber: "4444444444", name: "David", role: "CUSTOMER", isActive: true },
    { tenantId, phoneNumber: "5555555555", name: "Eve", role: "CUSTOMER", isActive: false },
  ]);

  // Products
  const products = await Product.insertMany([
    { tenantId, name: "Apple", category: "Fruits", price: 2.5, unit: "kg", isAvailable: true },
    { tenantId, name: "Banana", category: "Fruits", price: 1.2, unit: "kg", isAvailable: true },
    { tenantId, name: "Carrot", category: "Vegetables", price: 0.8, unit: "kg", isAvailable: true },
    { tenantId, name: "Milk", category: "Dairy", price: 1.5, unit: "liter", isAvailable: true },
    { tenantId, name: "Bread", category: "Bakery", price: 2.0, unit: "loaf", isAvailable: false },
  ]);

  // Print product IDs (from other branch)
  products.forEach(p => console.log(p.name, "=>", p._id.toString()));

  // Inventory
  await Inventory.insertMany(
    products.map((product, i) => ({
      tenantId,
      productId: product._id,
      availableQty: 100 - i * 10,
      thresholdQty: 10 + i * 2,
    }))
  );

  // Ensure Bob is ADMIN
  await User.updateOne(
    { phoneNumber: "2222222222", tenantId },
    { $set: { role: "ADMIN" } }
  );

  console.log("Dummy data seeded successfully!");
  mongoose.connection.close();
}

seed().catch(err => {
  console.error("Seeding error:", err);
  mongoose.connection.close();
});