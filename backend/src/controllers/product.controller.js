const mongoose = require("mongoose");
const Product = require("../models/Product.model");
const Inventory = require("../models/Inventory.model");


const addProduct = async (req, res) => {
  try {
    const { name, category, price, unit } = req.body;
    const tenantId = req.user.tenantId; // 🔑 from JWT

    // Validation: Check each required field
    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!category) missingFields.push("category");
    if (price === undefined) missingFields.push("price");
    if (!unit) missingFields.push("unit");

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required field(s): ${missingFields.join(", ")}`,
      });
    } 
    // Price validation
if (typeof price !== "number") {
  return res.status(400).json({
    message: "Price must be a number",
  });
}

if (price <= 0) {
  return res.status(400).json({
    message: "Price must be greater than zero",
  });
}


    // Duplicate check: same name & tenant
    const existingProduct = await Product.findOne({ tenantId, name });
    if (existingProduct) {
      return res.status(409).json({ message: "Product with this name already exists" });
    }
    

    const product = new Product({
      tenantId,
      name,
      category,
      price,
      unit,
      // isAvailable → default true
    });

    await product.save();
    await Inventory.create({
  tenantId,
  productId: product._id,
  availableQty: 1,   // start with zero
  thresholdQty: 10
});

    return res.status(201).json({
      message: "Product added successfully",
      product,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};
 const updateProductFromAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request body cannot be empty"
      });
    }

    const allowedFields = [
      "name",
      "price",
      "category",
      "unit",
      "isAvailable"
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update"
      });
    }

    if (updateData.price !== undefined) {
  if (typeof updateData.price !== "number") {
    return res.status(400).json({
      success: false,
      message: "Price must be a number"
    });
  }

  if (updateData.price <= 0) {
    return res.status(400).json({
      success: false,
      message: "Price must be greater than zero"
    });
  }
}

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    Object.assign(product, updateData);
    await product.save();

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
const getAvailableProducts = async (req, res) => {
  try {
    const category = req.query?.category?.trim();
    const tenantId = req.headers["x-tenant-id"]?.trim();

    // ✅ Tenant validation
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID missing"
      });
    }

    const productFilter = {
      tenantId,
      isAvailable: true
    };

    // ✅ Safe category filtering (No regex injection)
    if (category) {
      productFilter.category = category.toLowerCase();
    }

    const products = await Product.find(productFilter)
      .select("_id name category price unit")
      .sort({ name: 1 });

    if (!products || products.length === 0) {
      return res.status(200).json({
        success: true,
        products: []
      });
    }

    const inventories = await Inventory.find({
      tenantId,
      productId: { $in: products.map(p => p._id) },
      availableQty: { $gt: 0 }
    });

    const inventoryMap = {};
    inventories.forEach(inv => {
      inventoryMap[inv.productId.toString()] = inv.availableQty;
    });

    const response = products
      .filter(p => inventoryMap[p._id.toString()])
      .map(p => ({
        productId: p._id,
        name: p.name,
        category: p.category,
        price: p.price,
        unit: p.unit,
        availableQty: inventoryMap[p._id.toString()]
      }));

    return res.status(200).json({
      success: true,
      products: response
    });

  } catch (err) {
    console.error("Error in getAvailableProducts:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = {
  addProduct,
  updateProductFromAdmin,
  getAvailableProducts
};
