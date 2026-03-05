const mongoose = require("mongoose");
const Product = require("../models/Product.model");
const Inventory = require("../models/Inventory.model");


const addProduct = async (req, res) => {
  try {
    const { name, category, price, unit, stocks } = req.body;
    if (req.user.role !== "ADMIN") {
  return res.status(403).json({
    message: "Access denied. Admin only."
  });
}
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

    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({
        message: "Price must be a positive number",
      });
    }

    if (typeof stocks !== "number" || stocks < 0) {
      return res.status(400).json({
        message: "Stocks must be a non-negative number",
      });
    }

    const existingProduct = await Product.findOne({ tenantId, name });
    if (existingProduct) {
      return res.status(409).json({
        message: "Product with this name already exists",
      });
    }

    // ✅ 1. Create & Save Product FIRST
    const product = await Product.create({
      tenantId,
      name,
      category,
      price,
      unit,
      isAvailable: stocks > 0   // 🔥 auto derived
    });

    // ✅ 2. Create Inventory
    await Inventory.create({
      tenantId,
      productId: product._id,
      availableQty: stocks,
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
    if (req.user.role !== "ADMIN") {
  return res.status(403).json({
    message: "Access denied. Admin only."
  });
}
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

    // ❌ Removed "isAvailable" (admin cannot control availability manually)
    const allowedFields = [
      "name",
      "price",
      "category",
      "unit"
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

    // ✅ Tenant-safe product fetch
    const product = await Product.findOne({ _id: id, tenantId });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Update product basic fields
    Object.assign(product, updateData);
    await product.save();

    // 🔥 Update inventory & auto-sync availability
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

      // ✅ Auto-sync availability based on stock
      product.isAvailable = stocks > 0;
      await product.save();
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

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID missing"
      });
    }

    // ✅ Fixed match stage
    const matchStage = {
      tenantId,
      isAvailable: true,
      $or: [
        { isActive: true },
        { isActive: { $exists: false } }
      ]
    };

    if (category) {
      const safeCategory = escapeRegex(category);
      matchStage.category = {
        $regex: `^${safeCategory}$`,
        $options: "i"
      };
    }

    const products = await Product.aggregate([
      { $match: matchStage },

      {
        $lookup: {
          from: "inventories",
          localField: "_id",
          foreignField: "productId",
          as: "inventory"
        }
      },

      { $unwind: "$inventory" },

      {
        $match: {
          "inventory.availableQty": { $gt: 0 }
        }
      },

      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: 1,
          category: 1,
          price: 1,
          unit: 1,
          availableQty: "$inventory.availableQty" 
        }
      },

      { $sort: { name: 1 } }
    ]);

    return res.status(200).json({
      success: true,
      products
    });

  } catch (error) {
    console.error("Error in getAvailableProducts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
const deleteProductFromAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔐 Role Check
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only."
      });
    }

    const tenantId = req.user.tenantId;

    // ✅ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    // ✅ Tenant-safe product check
    const product = await Product.findOne({ _id: id, tenantId });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // ✅ Delete linked inventory FIRST
    await Inventory.deleteMany({
      tenantId,
      productId: id
    });

    // ✅ Delete product
    await Product.deleteOne({
      _id: id,
      tenantId
    });

    return res.status(200).json({
      success: true,
      message: "Product and linked inventory deleted successfully"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = {
  addProduct,
  updateProductFromAdmin,
  getAvailableProducts,
  deleteProductFromAdmin 
};
