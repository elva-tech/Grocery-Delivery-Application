const Product = require("../models/Product.model");

const addProduct = async (req, res) => {
  try {
    const { name, category, price, unit } = req.body;
    const tenantId = req.user.tenantId; // 🔑 from JWT

    // Validation
    if (!name || !category || !price || !unit) {
      return res.status(400).json({
        message: "name, category, price and unit are required",
      });
    }

    const product = new Product({
      tenantId,
      name,
      category,
      price,
      unit,
      // isAvailable → default true (no need to pass)
    });

    await product.save();

    return res.status(201).json({
      message: "Product added successfully",
      product,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { addProduct };
