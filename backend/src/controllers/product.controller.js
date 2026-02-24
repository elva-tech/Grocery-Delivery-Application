const mongoose = require("mongoose");
const Product = require("../models/Product.model");
const Inventory = require("../models/Inventory.model");


const addProduct = async (req, res) => {
  try {
    const { name, category, price, unit, stocks } = req.body;
    const tenantId = req.user.tenantId;

    // Validation
    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!category) missingFields.push("category");
    if (price === undefined) missingFields.push("price");
    if (!unit) missingFields.push("unit");
    if (stocks === undefined) missingFields.push("stocks");

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required field(s): ${missingFields.join(", ")}`,
      });
    }

    // Price validation
    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({
        message: "Price must be a positive number",
      });
    }

    // Stocks validation
    if (typeof stocks !== "number" || stocks < 0) {
      return res.status(400).json({
        message: "Stocks must be a non-negative number",
      });
    }

    // Duplicate check
    const existingProduct = await Product.findOne({ tenantId, name });
    if (existingProduct) {
      return res.status(409).json({
        message: "Product with this name already exists",
      });
    }

    // Create product
    const product = new Product({
      tenantId,
      name,
      category,
      price,
      unit,
    });

    await product.save();

    // Create inventory using stocks
    await Inventory.create({
      tenantId,
      productId: product._id,
      availableQty: stocks,   // 🔥 using stocks here
      thresholdQty: 10,
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
    const tenantId = req.user.tenantId;

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

    const { stocks } = req.body;

    // Validate price
    if (updateData.price !== undefined) {
      if (typeof updateData.price !== "number" || updateData.price <= 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be a positive number"
        });
      }
    }

    // Validate stocks
    if (stocks !== undefined) {
      if (typeof stocks !== "number" || stocks < 0) {
        return res.status(400).json({
          success: false,
          message: "Stocks must be a non-negative number"
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

    // Update product fields
    Object.assign(product, updateData);
    await product.save();

    // 🔥 Update inventory if stocks provided
    if (stocks !== undefined) {
      const inventory = await Inventory.findOne({
        tenantId,
        productId: product._id
      });

      if (!inventory) {
        return res.status(404).json({
          success: false,
          message: "Inventory record not found"
        });
      }

      inventory.availableQty = stocks;
      await inventory.save();
    }

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
  // Escape regex special characters (prevents regex injection)
const escapeRegex = (str) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAvailableProducts = async (req, res) => {
  try {
    const category = req.query?.category?.trim();
    const tenantId = req.headers["x-tenant-id"]?.trim();

    // Tenant validation
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID missing"
      });
    }

    // Base filter
    const productFilter = {
      tenantId,
      isAvailable: true
    };

    // Category filter (case-insensitive + safe)
    if (category) {
      const safeCategory = escapeRegex(category);
      productFilter.category = {
        $regex: `^${safeCategory}$`,
        $options: "i"
      };
    }

    // Fetch products
    const products = await Product.find(productFilter)
      .select("_id name category price unit")
      .sort({ name: 1 });

    if (!products.length) {
      return res.status(200).json({
        success: true,
        products: []
      });
    }

    // Fetch inventory for those products
    const inventories = await Inventory.find({
      tenantId,
      productId: { $in: products.map(p => p._id) },
      availableQty: { $gt: 0 }
    });

    // Map inventory quantities
    const inventoryMap = {};
    inventories.forEach(inv => {
      inventoryMap[inv.productId.toString()] = inv.availableQty;
    });

    // Final response
    const response = products
      .filter(p => inventoryMap[p._id.toString()] > 0)
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
