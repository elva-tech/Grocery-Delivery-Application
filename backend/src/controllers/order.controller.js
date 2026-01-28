const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const Inventory = require("../models/Inventory.model");
const mongoose = require("mongoose");

exports.placeOrder = async (req, res) => {
  try {
    const { items, paymentMode, deliveryAddress } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    // ✅ Items validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items are required" });
    }

    // ✅ Payment mode validation
    if (!["COD", "ONLINE"].includes(paymentMode)) {
      return res.status(400).json({
        message: "Invalid paymentMode. Only COD or ONLINE allowed",
      });
    }

    // ✅ Delivery address validation
    if (
      !deliveryAddress ||
      !deliveryAddress.line1 ||
      typeof deliveryAddress.lat !== "number" ||
      typeof deliveryAddress.lng !== "number"
    ) {
      return res.status(400).json({
        message: "Valid deliveryAddress (line1, lat, lng) is required",
      });
    }

    let orderItems = [];
    let totalAmount = 0;

    // 1. Validate inventory & build order items
    for (let item of items) {
      if (!item.productId || !item.qty || item.qty <= 0) {
        return res.status(400).json({ message: "Invalid item format" });
      }

      const productObjectId = new mongoose.Types.ObjectId(item.productId);

      const inventory = await Inventory.findOne({
        productId: productObjectId,
        tenantId,
      }).populate("productId");

      if (!inventory) {
        return res.status(404).json({ message: "Product not found in inventory" });
      }

      if (inventory.availableQty < item.qty) {
        return res.status(400).json({
          message: `Insufficient stock for ${inventory.productId.name}`,
        });
      }

      const product = inventory.productId;

      orderItems.push({
        productId: product._id,
        name: product.name,
        qty: item.qty,
        price: product.price,
      });

      totalAmount += product.price * item.qty;
    }

    // 2. Deduct stock
    for (let item of items) {
      const productObjectId = new mongoose.Types.ObjectId(item.productId);
      await Inventory.findOneAndUpdate(
        { productId: productObjectId, tenantId },
        { $inc: { availableQty: -item.qty } }
      );
    }

    // 3. Create order
    const order = await Order.create({
      tenantId,
      userId,
      items: orderItems,
      totalAmount,
      paymentMode,
      deliveryAddress,
      paymentStatus: "PENDING",
      orderStatus: "PLACED",
    });

    res.status(201).json({
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const inventories = await Inventory.find({ tenantId }).populate("productId");

    const products = inventories
      .filter((inv) => inv.productId && inv.availableQty > 0)
      .map((inv) => ({
        ...inv.productId.toObject(),
        availableQty: inv.availableQty,
      }));

    res.status(200).json({
      message: "Products fetched successfully",
      products,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
