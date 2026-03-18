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
    { tenantId, phoneNumber: "2222222222", name: "Bob", role: "ADMIN", isActive: true }, // ✅ ADMIN USER
    { tenantId, phoneNumber: "3333333333", name: "Charlie", role: "OPS", isActive: true },
    { tenantId, phoneNumber: "4444444444", name: "David", role: "CUSTOMER", isActive: true },
    { tenantId, phoneNumber: "5555555555", name: "Eve", role: "CUSTOMER", isActive: false },
  ]);

  // Products - MATCHING FRONTEND MOCKDATA
  const products = await Product.insertMany([
    // MILK
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439011'), tenantId, name: "Farm Fresh Buffalo Milk", category: "Dairy", price: 85, unit: "1 Litre", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439012'), tenantId, name: "Pure Cow Milk", category: "Dairy", price: 68, unit: "1 Litre", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439013'), tenantId, name: "Low Fat Skimmed Milk", category: "Dairy", price: 60, unit: "500ml", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439014'), tenantId, name: "Full Cream Milk", category: "Dairy", price: 72, unit: "1 Litre", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439015'), tenantId, name: "Organic Cow Milk", category: "Dairy", price: 95, unit: "1 Litre", isAvailable: true },
    
    // CURD & YOGURT
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439016'), tenantId, name: "Premium Set Curd", category: "Dairy", price: 45, unit: "500g", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439017'), tenantId, name: "Greek Yogurt (Plain)", category: "Dairy", price: 120, unit: "200g", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439018'), tenantId, name: "Probiotic Curd", category: "Dairy", price: 55, unit: "400g", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439019'), tenantId, name: "Strawberry Yogurt", category: "Dairy", price: 65, unit: "150g", isAvailable: true },
    
    // BUTTER & GHEE
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd79943901a'), tenantId, name: "Desi Cow Ghee", category: "Dairy", price: 550, unit: "500ml", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd79943901b'), tenantId, name: "Organic Butter", category: "Dairy", price: 180, unit: "200g", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd79943901c'), tenantId, name: "Salted Butter", category: "Dairy", price: 95, unit: "100g", isAvailable: true },
    
    // PANEER
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd79943901d'), tenantId, name: "Fresh Malai Paneer", category: "Dairy", price: 110, unit: "200g", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd79943901e'), tenantId, name: "Diced Paneer Cubes", category: "Dairy", price: 210, unit: "500g", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd79943901f'), tenantId, name: "Low Fat Paneer", category: "Dairy", price: 130, unit: "200g", isAvailable: true },
    
    // CHEESE
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439020'), tenantId, name: "Cheddar Cheese Block", category: "Dairy", price: 220, unit: "200g", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439021'), tenantId, name: "Mozzarella Cheese", category: "Dairy", price: 180, unit: "200g", isAvailable: true },
    
    // CREAM
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439022'), tenantId, name: "Fresh Dairy Cream", category: "Dairy", price: 90, unit: "200ml", isAvailable: true },
    
    // BUTTERMILK
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439023'), tenantId, name: "Spiced Buttermilk", category: "Dairy", price: 25, unit: "250ml", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439024'), tenantId, name: "Classic Buttermilk", category: "Dairy", price: 22, unit: "250ml", isAvailable: true },
    
    // AGARBATHIS
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439025'), tenantId, name: "Sandalwood Agarbathi", category: "Agarbathis", price: 150, unit: "1 Box", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439026'), tenantId, name: "Rose Fragrance Agarbathi", category: "Agarbathis", price: 120, unit: "1 Box", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439027'), tenantId, name: "Guggal Dhoop Cups", category: "Agarbathis", price: 130, unit: "12 Cups", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439028'), tenantId, name: "Sambrani Dhoop", category: "Agarbathis", price: 95, unit: "100g", isAvailable: true },
    
    // DRY FRUITS
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd799439029'), tenantId, name: "Premium California Almonds", category: "Dry Fruits", price: 450, unit: "500g", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd79943902a'), tenantId, name: "Organic Raw Almonds", category: "Dry Fruits", price: 520, unit: "500g", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd79943902b'), tenantId, name: "W240 Whole Cashews", category: "Dry Fruits", price: 320, unit: "250g", isAvailable: true },
    { _id: mongoose.Types.ObjectId.createFromHexString('507f1f77bcf86cd79943902c'), tenantId, name: "Premium Split Cashews", category: "Dry Fruits", price: 280, unit: "250g", isAvailable: true },
  ]);

  // Inventory (one per product) - ALL WITH STOCK
  await Inventory.insertMany(
    products.map((product) => ({
      tenantId,
      productId: product._id,
      availableQty: 100,
      thresholdQty: 10,
    }))
  );

  console.log("✅ Dummy data seeded successfully!");
  console.log("👉 ADMIN LOGIN PHONE: 2222222222");
  console.log("👉 OTP: 123456");

  mongoose.connection.close();
}

seed().catch(err => {
  console.error("Seeding error:", err);
  mongoose.connection.close();
});