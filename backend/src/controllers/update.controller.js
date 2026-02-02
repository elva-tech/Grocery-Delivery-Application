const mongoose = require("mongoose");
const Product = require("../models/Product.model");

// UPDATE PRODUCT (ADMIN)
exports.updateProduct = async (req, res) => {
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

    if (
      updateData.price !== undefined &&
      typeof updateData.price !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message: "Price must be a number"
      });
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
