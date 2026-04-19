// Production-ready seed: full grocery catalogue with categories, subcategories and images
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./src/config/db");
const Tenant = require("./src/models/Tenant.model");
const User = require("./src/models/User.model");
const Product = require("./src/models/Product.model");
const Inventory = require("./src/models/Inventory.model");

// ─── PRODUCT CATALOGUE ────────────────────────────────────────────────────────
// Each entry: { name, category, subcategory, price, unit, imageUrl, qty }
const CATALOGUE = [

  // ════════════════ DAIRY & EGGS ════════════════
  { name: "Farm Fresh Buffalo Milk",     category: "Dairy & Eggs",  subcategory: "Milk",           price: 85,  unit: "1 Litre",  qty: 200, imageUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80" },
  { name: "Pure Cow Milk",               category: "Dairy & Eggs",  subcategory: "Milk",           price: 68,  unit: "1 Litre",  qty: 180, imageUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80" },
  { name: "Low Fat Toned Milk",          category: "Dairy & Eggs",  subcategory: "Milk",           price: 60,  unit: "500 ml",   qty: 150, imageUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80" },
  { name: "Premium Set Curd",            category: "Dairy & Eggs",  subcategory: "Curd & Yogurt",  price: 45,  unit: "500 g",    qty: 120, imageUrl: "https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&q=80" },
  { name: "Greek Yogurt Plain",          category: "Dairy & Eggs",  subcategory: "Curd & Yogurt",  price: 120, unit: "200 g",    qty: 80,  imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80" },
  { name: "Amul Butter Salted",          category: "Dairy & Eggs",  subcategory: "Butter & Ghee",  price: 58,  unit: "100 g",    qty: 100, imageUrl: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80" },
  { name: "Pure Cow Ghee",               category: "Dairy & Eggs",  subcategory: "Butter & Ghee",  price: 580, unit: "500 ml",   qty: 60,  imageUrl: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400&q=80" },
  { name: "Fresh Paneer",                category: "Dairy & Eggs",  subcategory: "Paneer & Tofu",  price: 90,  unit: "200 g",    qty: 90,  imageUrl: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=80" },
  { name: "Tofu Firm",                   category: "Dairy & Eggs",  subcategory: "Paneer & Tofu",  price: 75,  unit: "200 g",    qty: 50,  imageUrl: "https://images.unsplash.com/photo-1546069901-5ec6a79120b0?w=400&q=80" },
  { name: "Processed Cheese Slices",     category: "Dairy & Eggs",  subcategory: "Cheese",         price: 110, unit: "200 g",    qty: 70,  imageUrl: "https://images.unsplash.com/photo-1589881133595-a3c085cb731d?w=400&q=80" },
  { name: "Fresh Cream",                 category: "Dairy & Eggs",  subcategory: "Cream",          price: 45,  unit: "200 ml",   qty: 80,  imageUrl: "https://images.unsplash.com/photo-1563636619-e9143da7529f?w=400&q=80" },
  { name: "Farm Fresh Eggs",             category: "Dairy & Eggs",  subcategory: "Eggs",           price: 96,  unit: "12 pcs",   qty: 200, imageUrl: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&q=80" },
  { name: "Brown Eggs Organic",          category: "Dairy & Eggs",  subcategory: "Eggs",           price: 120, unit: "12 pcs",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1518569656558-1f25e69d2049?w=400&q=80" },

  // ════════════════ FRUITS ════════════════
  { name: "Bananas",                     category: "Fruits",        subcategory: "Tropical Fruits",price: 45,  unit: "1 dozen",  qty: 300, imageUrl: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80" },
  { name: "Alphonso Mangoes",            category: "Fruits",        subcategory: "Tropical Fruits",price: 250, unit: "1 kg",     qty: 80,  imageUrl: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&q=80" },
  { name: "Papaya",                      category: "Fruits",        subcategory: "Tropical Fruits",price: 60,  unit: "1 kg",     qty: 90,  imageUrl: "https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?w=400&q=80" },
  { name: "Red Apples",                  category: "Fruits",        subcategory: "Apples & Pears", price: 180, unit: "1 kg",     qty: 120, imageUrl: "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&q=80" },
  { name: "Green Pears",                 category: "Fruits",        subcategory: "Apples & Pears", price: 160, unit: "1 kg",     qty: 80,  imageUrl: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&q=80" },
  { name: "Seedless Grapes Green",       category: "Fruits",        subcategory: "Grapes & Berries",price: 120, unit: "500 g",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=400&q=80" },
  { name: "Black Grapes",                category: "Fruits",        subcategory: "Grapes & Berries",price: 130, unit: "500 g",   qty: 80,  imageUrl: "https://images.unsplash.com/photo-1596363505729-4190a9506133?w=400&q=80" },
  { name: "Strawberries Fresh",          category: "Fruits",        subcategory: "Grapes & Berries",price: 150, unit: "200 g",   qty: 60,  imageUrl: "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=400&q=80" },
  { name: "Kinnow Oranges",              category: "Fruits",        subcategory: "Citrus",         price: 80,  unit: "1 kg",     qty: 120, imageUrl: "https://images.unsplash.com/photo-1547514701-42782101795e?w=400&q=80" },
  { name: "Sweet Limes",                 category: "Fruits",        subcategory: "Citrus",         price: 70,  unit: "1 kg",     qty: 100, imageUrl: "https://images.unsplash.com/photo-1590502593747-42a996133562?w=400&q=80" },
  { name: "Watermelon",                  category: "Fruits",        subcategory: "Melons",         price: 35,  unit: "1 kg",     qty: 150, imageUrl: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&q=80" },
  { name: "Muskmelon",                   category: "Fruits",        subcategory: "Melons",         price: 40,  unit: "1 kg",     qty: 100, imageUrl: "https://images.unsplash.com/photo-1571575173700-afb9492e6a50?w=400&q=80" },

  // ════════════════ VEGETABLES ════════════════
  { name: "Fresh Tomatoes",              category: "Vegetables",    subcategory: "Everyday Veggies",price: 40, unit: "500 g",   qty: 300, imageUrl: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400&q=80" },
  { name: "Onions",                      category: "Vegetables",    subcategory: "Everyday Veggies",price: 35, unit: "1 kg",    qty: 400, imageUrl: "https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=400&q=80" },
  { name: "Potatoes",                    category: "Vegetables",    subcategory: "Everyday Veggies",price: 30, unit: "1 kg",    qty: 500, imageUrl: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80" },
  { name: "Fresh Ginger",               category: "Vegetables",    subcategory: "Everyday Veggies",price: 20, unit: "100 g",   qty: 200, imageUrl: "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=400&q=80" },
  { name: "Garlic",                      category: "Vegetables",    subcategory: "Everyday Veggies",price: 25, unit: "100 g",   qty: 200, imageUrl: "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=400&q=80" },
  { name: "Broccoli",                    category: "Vegetables",    subcategory: "Green Veggies",   price: 80, unit: "500 g",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=400&q=80" },
  { name: "Spinach",                     category: "Vegetables",    subcategory: "Green Veggies",   price: 30, unit: "250 g",   qty: 120, imageUrl: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&q=80" },
  { name: "Green Beans",                 category: "Vegetables",    subcategory: "Green Veggies",   price: 50, unit: "500 g",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?w=400&q=80" },
  { name: "Cucumber",                    category: "Vegetables",    subcategory: "Green Veggies",   price: 30, unit: "500 g",   qty: 150, imageUrl: "https://images.unsplash.com/photo-1568584711271-6c929fb49b60?w=400&q=80" },
  { name: "Capsicum Red",                category: "Vegetables",    subcategory: "Peppers",         price: 60, unit: "250 g",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1518073997378-c81d9b86c2a3?w=400&q=80" },
  { name: "Capsicum Green",              category: "Vegetables",    subcategory: "Peppers",         price: 40, unit: "250 g",   qty: 120, imageUrl: "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&q=80" },
  { name: "Green Chillies",             category: "Vegetables",    subcategory: "Peppers",         price: 15, unit: "100 g",   qty: 200, imageUrl: "https://images.unsplash.com/photo-1588252166965-f1d4bd4ec251?w=400&q=80" },
  { name: "Cauliflower",                 category: "Vegetables",    subcategory: "Gourds & Roots",  price: 45, unit: "1 pcs",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1568584711271-6c929fb49b60?w=400&q=80" },
  { name: "Bottle Gourd",               category: "Vegetables",    subcategory: "Gourds & Roots",  price: 35, unit: "500 g",   qty: 120, imageUrl: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&q=80" },
  { name: "Carrot",                      category: "Vegetables",    subcategory: "Gourds & Roots",  price: 40, unit: "500 g",   qty: 150, imageUrl: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&q=80" },

  // ════════════════ BAKERY & BREAD ════════════════
  { name: "Whole Wheat Bread",           category: "Bakery",        subcategory: "Breads",          price: 45, unit: "400 g",   qty: 80,  imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80" },
  { name: "White Sandwich Bread",        category: "Bakery",        subcategory: "Breads",          price: 35, unit: "400 g",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400&q=80" },
  { name: "Multigrain Bread",            category: "Bakery",        subcategory: "Breads",          price: 55, unit: "400 g",   qty: 60,  imageUrl: "https://images.unsplash.com/photo-1589257927129-0d89a59aba7e?w=400&q=80" },
  { name: "Butter Croissant",            category: "Bakery",        subcategory: "Pastries & Cakes",price: 35, unit: "1 pcs",   qty: 60,  imageUrl: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80" },
  { name: "Chocolate Muffin",            category: "Bakery",        subcategory: "Pastries & Cakes",price: 45, unit: "1 pcs",   qty: 50,  imageUrl: "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&q=80" },
  { name: "Plain Biscuits",              category: "Bakery",        subcategory: "Biscuits",        price: 20, unit: "100 g",   qty: 150, imageUrl: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80" },
  { name: "Digestive Biscuits",          category: "Bakery",        subcategory: "Biscuits",        price: 55, unit: "250 g",   qty: 120, imageUrl: "https://images.unsplash.com/photo-1590080876351-b9f7c1e5b859?w=400&q=80" },

  // ════════════════ BEVERAGES ════════════════
  { name: "Mineral Water 1L",            category: "Beverages",     subcategory: "Water",           price: 20, unit: "1 Litre",  qty: 500, imageUrl: "https://images.unsplash.com/photo-1548126723-e3a9c96f0d3b?w=400&q=80" },
  { name: "Sparkling Water",             category: "Beverages",     subcategory: "Water",           price: 45, unit: "500 ml",   qty: 200, imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80" },
  { name: "Orange Juice Fresh",          category: "Beverages",     subcategory: "Juices",          price: 60, unit: "500 ml",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&q=80" },
  { name: "Mixed Fruit Juice",           category: "Beverages",     subcategory: "Juices",          price: 55, unit: "500 ml",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&q=80" },
  { name: "Coca Cola 750ml",             category: "Beverages",     subcategory: "Cold Drinks",     price: 45, unit: "750 ml",   qty: 200, imageUrl: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80" },
  { name: "Sprite 750ml",               category: "Beverages",     subcategory: "Cold Drinks",     price: 45, unit: "750 ml",   qty: 200, imageUrl: "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400&q=80" },
  { name: "Tata Tea Premium",            category: "Beverages",     subcategory: "Tea & Coffee",    price: 120, unit: "250 g",   qty: 150, imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80" },
  { name: "Nescafe Classic",             category: "Beverages",     subcategory: "Tea & Coffee",    price: 250, unit: "100 g",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&q=80" },
  { name: "Mango Lassi",                 category: "Beverages",     subcategory: "Lassi & Shakes",  price: 55, unit: "300 ml",   qty: 80,  imageUrl: "https://images.unsplash.com/photo-1601924582970-9238bcb495d9?w=400&q=80" },
  { name: "Butter Milk Masala",          category: "Beverages",     subcategory: "Lassi & Shakes",  price: 30, unit: "200 ml",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&q=80" },

  // ════════════════ SNACKS & NAMKEEN ════════════════
  { name: "Lay's Classic Salted",        category: "Snacks",        subcategory: "Chips & Crisps",  price: 20, unit: "50 g",    qty: 300, imageUrl: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&q=80" },
  { name: "Bingo Mad Angles",            category: "Snacks",        subcategory: "Chips & Crisps",  price: 20, unit: "45 g",    qty: 250, imageUrl: "https://images.unsplash.com/photo-1621447504864-d8686e12698c?w=400&q=80" },
  { name: "Haldiram's Bhujia",           category: "Snacks",        subcategory: "Namkeen",         price: 80, unit: "200 g",   qty: 150, imageUrl: "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&q=80" },
  { name: "Haldiram's Aloo Bhujia",      category: "Snacks",        subcategory: "Namkeen",         price: 60, unit: "150 g",   qty: 150, imageUrl: "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&q=80" },
  { name: "Dark Chocolate Bar",          category: "Snacks",        subcategory: "Chocolates",      price: 120, unit: "80 g",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80" },
  { name: "KitKat",                      category: "Snacks",        subcategory: "Chocolates",      price: 40, unit: "45 g",    qty: 200, imageUrl: "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&q=80" },
  { name: "Peanut Chikki",               category: "Snacks",        subcategory: "Traditional",     price: 30, unit: "100 g",   qty: 120, imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80" },

  // ════════════════ GRAINS, RICE & DALS ════════════════
  { name: "Basmati Rice Premium",        category: "Grains & Pulses", subcategory: "Rice",          price: 180, unit: "1 kg",   qty: 200, imageUrl: "https://images.unsplash.com/photo-1536304993881-ff86e0c9e385?w=400&q=80" },
  { name: "Sona Masoori Rice",           category: "Grains & Pulses", subcategory: "Rice",          price: 100, unit: "1 kg",   qty: 250, imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80" },
  { name: "Whole Wheat Flour (Atta)",    category: "Grains & Pulses", subcategory: "Flour & Atta",  price: 55,  unit: "1 kg",   qty: 200, imageUrl: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&q=80" },
  { name: "Besan (Chickpea Flour)",      category: "Grains & Pulses", subcategory: "Flour & Atta",  price: 65,  unit: "500 g",  qty: 150, imageUrl: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&q=80" },
  { name: "Toor Dal",                    category: "Grains & Pulses", subcategory: "Dals & Lentils",price: 120, unit: "500 g",  qty: 200, imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80" },
  { name: "Moong Dal Yellow",            category: "Grains & Pulses", subcategory: "Dals & Lentils",price: 110, unit: "500 g",  qty: 180, imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80" },
  { name: "Masoor Dal Red",              category: "Grains & Pulses", subcategory: "Dals & Lentils",price: 90,  unit: "500 g",  qty: 180, imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80" },
  { name: "Kabuli Chana",                category: "Grains & Pulses", subcategory: "Dals & Lentils",price: 130, unit: "500 g",  qty: 120, imageUrl: "https://images.unsplash.com/photo-1612257998531-a1f39d52b98c?w=400&q=80" },
  { name: "Quinoa Organic",              category: "Grains & Pulses", subcategory: "Supergrains",   price: 280, unit: "500 g",  qty: 60,  imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80" },
  { name: "Rolled Oats",                 category: "Grains & Pulses", subcategory: "Supergrains",   price: 120, unit: "400 g",  qty: 100, imageUrl: "https://images.unsplash.com/photo-1495214783159-3503fd1b572d?w=400&q=80" },

  // ════════════════ COOKING ESSENTIALS ════════════════
  { name: "Sunflower Oil",               category: "Cooking Essentials", subcategory: "Oils",      price: 160, unit: "1 Litre", qty: 150, imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80" },
  { name: "Extra Virgin Olive Oil",      category: "Cooking Essentials", subcategory: "Oils",      price: 550, unit: "500 ml",  qty: 60,  imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80" },
  { name: "Coconut Oil",                 category: "Cooking Essentials", subcategory: "Oils",      price: 220, unit: "500 ml",  qty: 80,  imageUrl: "https://images.unsplash.com/photo-1550948537-130a1ce4b3b9?w=400&q=80" },
  { name: "Iodised Salt",                category: "Cooking Essentials", subcategory: "Salt & Sugar",price: 20, unit: "1 kg",   qty: 300, imageUrl: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80" },
  { name: "Sugar Refined",               category: "Cooking Essentials", subcategory: "Salt & Sugar",price: 50, unit: "1 kg",   qty: 250, imageUrl: "https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=400&q=80" },
  { name: "Turmeric Powder",             category: "Cooking Essentials", subcategory: "Spices",    price: 35,  unit: "100 g",   qty: 200, imageUrl: "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=400&q=80" },
  { name: "Red Chilli Powder",           category: "Cooking Essentials", subcategory: "Spices",    price: 40,  unit: "100 g",   qty: 200, imageUrl: "https://images.unsplash.com/photo-1589927986089-35812388d1f4?w=400&q=80" },
  { name: "Cumin Seeds",                 category: "Cooking Essentials", subcategory: "Spices",    price: 30,  unit: "100 g",   qty: 200, imageUrl: "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=400&q=80" },
  { name: "Garam Masala",                category: "Cooking Essentials", subcategory: "Spices",    price: 60,  unit: "100 g",   qty: 150, imageUrl: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&q=80" },
  { name: "Tomato Ketchup",              category: "Cooking Essentials", subcategory: "Sauces",    price: 75,  unit: "500 g",   qty: 120, imageUrl: "https://images.unsplash.com/photo-1558818042-d668d3cebfa6?w=400&q=80" },
  { name: "Soy Sauce",                   category: "Cooking Essentials", subcategory: "Sauces",    price: 55,  unit: "200 ml",  qty: 100, imageUrl: "https://images.unsplash.com/photo-1563636619-e9143da7529f?w=400&q=80" },
  { name: "White Vinegar",               category: "Cooking Essentials", subcategory: "Sauces",    price: 30,  unit: "200 ml",  qty: 100, imageUrl: "https://images.unsplash.com/photo-1567306301408-9b74779a11af?w=400&q=80" },

  // ════════════════ DRY FRUITS & NUTS ════════════════
  { name: "Almonds Raw",                 category: "Dry Fruits & Nuts", subcategory: "Almonds",     price: 320, unit: "250 g",  qty: 80,  imageUrl: "https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=400&q=80" },
  { name: "Cashews W320",                category: "Dry Fruits & Nuts", subcategory: "Cashews",     price: 450, unit: "250 g",  qty: 70,  imageUrl: "https://images.unsplash.com/photo-1574184864703-3487b13f0edd?w=400&q=80" },
  { name: "Pistachios Roasted Salted",   category: "Dry Fruits & Nuts", subcategory: "Pistachios",  price: 520, unit: "250 g",  qty: 60,  imageUrl: "https://images.unsplash.com/photo-1616684000067-36952fde56ec?w=400&q=80" },
  { name: "Walnuts Kernels",             category: "Dry Fruits & Nuts", subcategory: "Walnuts",     price: 380, unit: "250 g",  qty: 60,  imageUrl: "https://images.unsplash.com/photo-1563636619-e9143da7529f?w=400&q=80" },
  { name: "Black Raisins",               category: "Dry Fruits & Nuts", subcategory: "Raisins & Dates", price: 90, unit: "200 g", qty: 100, imageUrl: "https://images.unsplash.com/photo-1575371803188-e3a83d95e38e?w=400&q=80" },
  { name: "Medjool Dates",               category: "Dry Fruits & Nuts", subcategory: "Raisins & Dates", price: 280, unit: "250 g", qty: 60, imageUrl: "https://images.unsplash.com/photo-1611482670044-65f7e3a1fe4a?w=400&q=80" },
  { name: "Mixed Dry Fruit Box",         category: "Dry Fruits & Nuts", subcategory: "Mixed",       price: 350, unit: "250 g",  qty: 80,  imageUrl: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80" },

  // ════════════════ PERSONAL CARE ════════════════
  { name: "Dove Body Wash",              category: "Personal Care",  subcategory: "Bath & Body",    price: 220, unit: "250 ml",  qty: 80,  imageUrl: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&q=80" },
  { name: "Neem Face Wash",              category: "Personal Care",  subcategory: "Skin Care",      price: 120, unit: "100 ml",  qty: 80,  imageUrl: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&q=80" },
  { name: "Sunscreen SPF 50",            category: "Personal Care",  subcategory: "Skin Care",      price: 280, unit: "50 g",    qty: 60,  imageUrl: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&q=80" },
  { name: "Herbal Shampoo",              category: "Personal Care",  subcategory: "Hair Care",      price: 180, unit: "200 ml",  qty: 80,  imageUrl: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&q=80" },
  { name: "Colgate Toothpaste",          category: "Personal Care",  subcategory: "Oral Care",      price: 80,  unit: "150 g",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&q=80" },

  // ════════════════ HOUSEHOLD ════════════════
  { name: "Vim Dishwash Bar",            category: "Household",     subcategory: "Kitchen",         price: 30,  unit: "200 g",   qty: 200, imageUrl: "https://images.unsplash.com/photo-1585909695284-32d2985ac9c0?w=400&q=80" },
  { name: "Harpic Toilet Cleaner",       category: "Household",     subcategory: "Bathroom",        price: 90,  unit: "500 ml",  qty: 100, imageUrl: "https://images.unsplash.com/photo-1585909695284-32d2985ac9c0?w=400&q=80" },
  { name: "Colin Glass Cleaner",         category: "Household",     subcategory: "Bathroom",        price: 75,  unit: "500 ml",  qty: 100, imageUrl: "https://images.unsplash.com/photo-1585909695284-32d2985ac9c0?w=400&q=80" },
  { name: "Surf Excel Detergent",        category: "Household",     subcategory: "Laundry",         price: 120, unit: "500 g",   qty: 150, imageUrl: "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400&q=80" },
  { name: "Comfort Fabric Softener",     category: "Household",     subcategory: "Laundry",         price: 85,  unit: "500 ml",  qty: 100, imageUrl: "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400&q=80" },
  { name: "Garbage Bags 30L",            category: "Household",     subcategory: "Kitchen",         price: 60,  unit: "30 pcs",  qty: 150, imageUrl: "https://images.unsplash.com/photo-1585909695284-32d2985ac9c0?w=400&q=80" },

  // ════════════════ FROZEN & READY TO EAT ════════════════
  { name: "Frozen Peas",                 category: "Frozen Foods",  subcategory: "Frozen Veggies",  price: 80,  unit: "500 g",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=400&q=80" },
  { name: "Frozen Sweet Corn",           category: "Frozen Foods",  subcategory: "Frozen Veggies",  price: 75,  unit: "500 g",   qty: 100, imageUrl: "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400&q=80" },
  { name: "Aloo Tikki Patties",          category: "Frozen Foods",  subcategory: "Ready to Cook",   price: 120, unit: "400 g",   qty: 80,  imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80" },
  { name: "Veg Momos Frozen",            category: "Frozen Foods",  subcategory: "Ready to Cook",   price: 130, unit: "300 g",   qty: 80,  imageUrl: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400&q=80" },
  { name: "Instant Noodles Maggi",       category: "Frozen Foods",  subcategory: "Instant Foods",   price: 14,  unit: "70 g",    qty: 400, imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80" },
  { name: "Cup Noodles",                 category: "Frozen Foods",  subcategory: "Instant Foods",   price: 35,  unit: "75 g",    qty: 200, imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80" },
];

async function seed() {
  await connectDB();
  const tenantId = "demo-tenant";

  // Ensure the demo tenant exists in the Tenant registry
  await Tenant.findOneAndUpdate(
    { tenantId },
    { tenantId, name: "Demo Store", isActive: true },
    { upsert: true, new: true }
  );

  // Clear existing data
  await User.deleteMany({ tenantId });
  await Product.deleteMany({ tenantId });
  await Inventory.deleteMany({ tenantId });

  // ── Users ──────────────────────────────────────────────────────────────────
  await User.insertMany([
    { tenantId, phoneNumber: "1111111111", name: "Alice",   role: "CUSTOMER", isActive: true },
    { tenantId, phoneNumber: "2222222222", name: "Bob",     role: "ADMIN",    isActive: true },
    { tenantId, phoneNumber: "3333333333", name: "Charlie", role: "OPS",      isActive: true },
    { tenantId, phoneNumber: "4444444444", name: "David",   role: "CUSTOMER", isActive: true },
  ]);

  // ── Products + Inventory ───────────────────────────────────────────────────
  const productDocs = await Product.insertMany(
    CATALOGUE.map(({ qty: _qty, ...rest }) => ({
      tenantId,
      ...rest,
      isAvailable: true,
    }))
  );

  await Inventory.insertMany(
    productDocs.map((product, i) => ({
      tenantId,
      productId: product._id,
      availableQty: CATALOGUE[i].qty,
      thresholdQty: 10,
    }))
  );

  console.log(`✅ Seeded ${productDocs.length} products across ${new Set(CATALOGUE.map(p => p.category)).size} categories.`);
  console.log("👉 ADMIN LOGIN PHONE: 2222222222  |  OTP: 123456");

  mongoose.connection.close();
}

seed().catch(err => {
  console.error("Seeding error:", err);
  mongoose.connection.close();
});