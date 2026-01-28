const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const Inventory = require("../models/Inventory.model");
const mongoose = require("mongoose");

exports.placeOrder = async (req, res) => {
  try {
    const { items, paymentMode, deliveryAddress } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    console.log("===== PLACE ORDER DEBUG =====");
    console.log("Full req.user:", req.user);
    console.log("userId:", userId);
    console.log("tenantId:", tenantId);
    console.log("items:", items);

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Items are required" });
    }

    let orderItems = [];
    let totalAmount = 0;

    // 1. Validate inventory & build order items
    for (let item of items) {
      console.log("Searching inventory for productId:", item.productId, "tenantId:", tenantId);
      
      // Convert productId string to ObjectId
      const productObjectId = new mongoose.Types.ObjectId(item.productId);
      
      const inventory = await Inventory.findOne({
        productId: productObjectId,
        tenantId: tenantId,
      }).populate("productId");

      if (!inventory) {
        console.log("Inventory not found. Checking what exists...");
        const allInventory = await Inventory.find({ tenantId }).populate("productId");
        console.log("Available inventory:", allInventory);
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
    console.error("Place order error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all products with inventory levels
exports.getProducts = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const inventory = await Inventory.find({ tenantId })
      .populate("productId")
      .select("productId availableQty thresholdQty");

    const products = inventory.map(inv => ({
      productId: inv.productId._id,
      name: inv.productId.name,
      category: inv.productId.category,
      price: inv.productId.price,
      unit: inv.productId.unit,
      availableQty: inv.availableQty,
      thresholdQty: inv.thresholdQty,
      isAvailable: inv.productId.isAvailable,
    }));

    res.json({
      message: "Products fetched successfully",
      products,
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

