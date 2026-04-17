const mongoose = require("mongoose");
const Product = require("../models/Product.model");
const Inventory = require("../models/Inventory.model");
// TODO: 'image' field is deprecated. Use 'imageUrl' only.

/* ================= ADD PRODUCT ================= */

const addProduct = async (req, res) => {
  try {
    const { name, category, subcategory, description, price, unit, stocks, stock, imageUrl, threshold } = req.body;
    const resolvedImageUrl = typeof imageUrl === "string" ? imageUrl.trim() : imageUrl;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const tenantId = req.user.tenantId;

    const finalPrice = Number(price);
    let finalStocks = Number(stocks ?? stock);
    if (isNaN(finalStocks)) finalStocks = 0;

    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!category) missingFields.push("category");
    if (price === undefined) missingFields.push("price");
    if (!unit) missingFields.push("unit");

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required field(s): ${missingFields.join(", ")}`
      });
    }

    if (isNaN(finalPrice) || finalPrice <= 0) {
      return res.status(400).json({ message: "Price must be a positive number" });
    }

    const existingProduct = await Product.findOne({ tenantId, name });
    if (existingProduct) {
      return res.status(409).json({ message: "Product with this name already exists" });
    }

    const product = await Product.create({
      tenantId,
      name,
      category,
      subcategory: subcategory || '',
      description: description || '',
      price: finalPrice,
      unit,
      // Persist Cloudinary/public URL sent by frontend
      imageUrl: resolvedImageUrl,
      isAvailable: finalStocks > 0
    });

    await Inventory.create({
      tenantId,
      productId: product._id,
      availableQty: finalStocks,
      thresholdQty: threshold != null ? Number(threshold) : 10
    });

    return res.status(201).json({
      message: "Product added successfully",
      product
    });

  } catch (error) {
    console.error("Add Product Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ================= UPDATE PRODUCT ================= */

const updateProductFromAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const allowedFields = ["name", "price", "category", "subcategory", "description", "unit", "imageUrl"];
    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });
    if (req.body.imageUrl !== undefined) {
      // Keep incoming image URL instead of ignoring/overwriting it
      updateData.imageUrl = typeof req.body.imageUrl === "string"
        ? req.body.imageUrl.trim()
        : req.body.imageUrl;
    }

    if (updateData.price !== undefined) {
      const priceNum = Number(updateData.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({ message: "Price must be a positive number" });
      }
      updateData.price = priceNum;
    }

    const { stocks, stock } = req.body;
    const finalStocks = Number(stocks ?? stock);

    const product = await Product.findOne({ _id: id, tenantId });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    Object.assign(product, updateData);
    await product.save();

    if (!isNaN(finalStocks)) {
      const inventory = await Inventory.findOne({
        tenantId,
        productId: product._id
      });

      if (inventory) {
        inventory.availableQty = finalStocks;
        const { threshold } = req.body;
        if (threshold != null) inventory.thresholdQty = Number(threshold);
        await inventory.save();
      }

      product.isAvailable = finalStocks > 0;
      await product.save();
    }

    res.status(200).json({
      message: "Product updated successfully",
      product
    });

  } catch (error) {
    console.error("Update Product Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* ================= GET AVAILABLE PRODUCTS ================= */

const escapeRegex = (str) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAvailableProducts = async (req, res) => {
  try {
    const category = req.query?.category?.trim();
    const tenantId = req.headers["x-tenant-id"]?.trim();

    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID missing" });
    }

    const matchStage = {
      tenantId,
      isAvailable: true,
      $or: [{ isActive: true }, { isActive: { $exists: false } }]
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
      { $match: { "inventory.availableQty": { $gt: 0 } } },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: 1,
          category: 1,
          subcategory: 1,
          description: 1,
          price: 1,
          unit: 1,
          imageUrl: 1,
          availableQty: "$inventory.availableQty"
        }
      },
      { $sort: { name: 1 } }
    ]);

    return res.status(200).json({ products });

  } catch (error) {
    console.error("Get Products Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ================= DELETE PRODUCT ================= */

const deleteProductFromAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findOne({ _id: id, tenantId });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await Inventory.deleteMany({ tenantId, productId: id });
    await Product.deleteOne({ _id: id, tenantId });

    return res.status(200).json({
      message: "Product and inventory deleted successfully"
    });

  } catch (error) {
    console.error("Delete Product Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const getInventory = async (req, res) => {
  try {
    // 🔐 Admin check
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only."
      });
    }

    const tenantId = req.user.tenantId;

    // Fetch inventory with product details
    const inventory = await Inventory.aggregate([
      {
        $match: { tenantId }
      },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 0,
          productId: "$product._id",
          name: "$product.name",
          category: "$product.category",
          subcategory: "$product.subcategory",
          description: "$product.description",
          price: "$product.price",
          unit: "$product.unit",
          imageUrl: "$product.imageUrl",
          isAvailable: "$product.isAvailable",
          availableQty: 1,
          thresholdQty: 1
        }
      },
      { $sort: { name: 1 } }
    ]);

     return res.status(200).json({
  success: true,
  data: inventory
});

  } catch (error) {
    console.error("Error in getInventory:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* ================= EXPORTS ================= */

module.exports = {
  addProduct,
  updateProductFromAdmin,
  getAvailableProducts,
  deleteProductFromAdmin,
  getInventory
};

