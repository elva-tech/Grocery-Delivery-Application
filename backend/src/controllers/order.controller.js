const Order = require("../models/Order.model");
const Inventory = require("../models/Inventory.model");
const mongoose = require("mongoose");

const PAYMENT_MODES = ["COD", "ONLINE"];

/**
 * PLACE ORDER
 */
exports.placeCustomerOrder = async (req, res) => {
  try {
    const { items, paymentMode, deliveryAddress } = req.body;

    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Please add items to place order" });
    }

    if (!PAYMENT_MODES.includes(paymentMode)) {
      return res.status(400).json({ message: "Invalid payment mode" });
    }

    if (
      !deliveryAddress?.line1 ||
      typeof deliveryAddress.lat !== "number" ||
      typeof deliveryAddress.lng !== "number"
    ) {
      return res.status(400).json({ message: "Valid delivery address required" });
    }

    let orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId) || item.qty <= 0) {
        return res.status(400).json({ message: "Invalid product details" });
      }

      const inventory = await Inventory.findOne({
        productId: item.productId,
        tenantId,
      }).populate("productId");

      if (!inventory) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (inventory.availableQty < item.qty) {
        return res.status(400).json({ message: "Insufficient stock" });
      }

      orderItems.push({
        productId: inventory.productId._id,
        name: inventory.productId.name,
        qty: item.qty,
        price: inventory.productId.price,
      });

      totalAmount += inventory.productId.price * item.qty;
    }

    // Deduct stock
    for (const item of items) {
      await Inventory.findOneAndUpdate(
        { productId: item.productId, tenantId },
        { $inc: { availableQty: -item.qty } }
      );
    }

    const paymentStatus =
      paymentMode === "COD" ? "PENDING" : "PAID";

    const order = await Order.create({
      tenantId,
      userId,
      items: orderItems,
      totalAmount,
      paymentMode,
      deliveryAddress,
      orderStatus: "PLACED",
      paymentStatus,
    });

    res.status(201).json({
      message: "Order placed successfully",
      orderId: order._id,
      totalAmount: order.totalAmount,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
    });
  } catch (error) {
    console.error("Place Order Error:", error);
    res.status(500).json({ message: "Unable to place order. Try again" });
  }
};

/**
 * CUSTOMER ORDER HISTORY (ONLY DELIVERED)
 */
exports.getCustomerOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    const orders = await Order.find({
      userId,
      tenantId,
      orderStatus: "DELIVERED",
    })
      .sort({ createdAt: -1 })
      .select("totalAmount orderStatus paymentStatus createdAt");

    res.status(200).json({
      message: "Delivered orders fetched successfully",
      orders: orders.map(order => ({
        orderId: order._id,
        totalAmount: order.totalAmount,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
      })),
    });
  } catch (error) {
    console.error("History Error:", error);
    res.status(500).json({ message: "Unable to fetch orders" });
  }
};

/**
 * MARK ORDER DELIVERED (same behavior as before — no admin block)
 */
exports.markOrderDelivered = async (req, res) => {
  try {
    const { orderId } = req.params;
    const tenantId = req.user.tenantId;

    const order = await Order.findOne({ _id: orderId, tenantId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Prevent duplicate delivery
    if (order.orderStatus === "DELIVERED") {
      return res.status(400).json({ message: "Order already delivered" });
    }

    order.orderStatus = "DELIVERED";
    order.paymentStatus = "PAID";

    await order.save();

    res.status(200).json({
      message: "Order delivered successfully",
      orderId: order._id,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    console.error("Deliver Error:", error);
    res.status(500).json({ message: "Unable to update order" });
  }
};
