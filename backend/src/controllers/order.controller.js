const Order = require("../models/Order.model");
const Inventory = require("../models/Inventory.model");
const mongoose = require("mongoose");

/**
 * PLACE ORDER
 * POST /api/orders
 */
exports.placeOrder = async (req, res) => {
  try {
    const { items, paymentMode, deliveryAddress } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items are required" });
    }

    if (!["COD", "ONLINE"].includes(paymentMode)) {
      return res.status(400).json({ message: "Invalid paymentMode" });
    }

    if (
      !deliveryAddress?.line1 ||
      typeof deliveryAddress.lat !== "number" ||
      typeof deliveryAddress.lng !== "number"
    ) {
      return res.status(400).json({ message: "Valid deliveryAddress required" });
    }

    let orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId) || item.qty <= 0) {
        return res.status(400).json({ message: "Invalid item data" });
      }

      const inventory = await Inventory.findOne({
        productId: item.productId,
        tenantId,
      }).populate("productId");

      if (!inventory || inventory.availableQty < item.qty) {
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

    for (const item of items) {
      await Inventory.findOneAndUpdate(
        { productId: item.productId, tenantId },
        { $inc: { availableQty: -item.qty } }
      );
    }

    const order = await Order.create({
      tenantId,
      userId,
      items: orderItems,
      totalAmount,
      paymentMode,
      orderStatus: "PLACED",
      paymentStatus: "PENDING",
      deliveryAddress,
    });

    res.status(201).json({
      message: "Order placed successfully",
      orderId: order._id,
      totalAmount: order.totalAmount,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * MARK ORDER AS DELIVERED
 * PATCH /api/orders/:orderId/deliver
 */
exports.markOrderDelivered = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        orderStatus: "DELIVERED",
        paymentStatus: "PAID",
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      message: "Order delivered successfully",
      orderId: order._id,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET MY ORDERS (ORDER HISTORY)
 * GET /api/orders/my
 */
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .select("totalAmount orderStatus paymentStatus createdAt");

    res.status(200).json({
      message: "Orders fetched successfully",
      orders: orders.map(order => ({
        orderId: order._id,
        totalAmount: order.totalAmount,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
