const Product = require("../models/Product.model");

const addProduct = async (req, res) => {
  try {
    const { name, category, price, unit } = req.body;
    const tenantId = req.user.tenantId; // 🔑 from JWT

    // Validation: Check each required field
    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!category) missingFields.push("category");
    if (!price) missingFields.push("price");
    if (!unit) missingFields.push("unit");

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required field(s): ${missingFields.join(", ")}`,
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
