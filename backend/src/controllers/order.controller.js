const Order = require("../models/Order.model");
const Inventory = require("../models/Inventory.model");
const mongoose = require("mongoose");

exports.placeCustomerOrder = async (req, res) => {
  try {
    const { items, paymentMode, deliveryAddress } = req.body;
    const { userId, tenantId } = req.user;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Order items are required" });
    }

    if (!["COD", "ONLINE"].includes(paymentMode)) {
      return res.status(400).json({ message: "Invalid payment mode" });
    }

    let orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      if (
        !mongoose.Types.ObjectId.isValid(item.productId) ||
        item.qty <= 0
      ) {
        return res.status(400).json({ message: "Invalid order item" });
      }

      const inventory = await Inventory.findOne({
        productId: item.productId,
        tenantId,
      }).populate("productId");

      if (!inventory) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (inventory.availableQty < item.qty) {
        return res.status(400).json({
          message: `Insufficient stock for ${inventory.productId.name}`,
        });
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
      deliveryAddress,
      orderStatus: "PLACED",
      paymentStatus: "PENDING",
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
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAvailableProducts = async (req, res) => {
  try {
    const { tenantId } = req.user;

    const inventoryList = await Inventory.find({
      tenantId,
      availableQty: { $gt: 0 },
    }).populate("productId");

    res.status(200).json({
      message: "Products fetched successfully",
      products: inventoryList.map(i => ({
        ...i.productId.toObject(),
        availableQty: i.availableQty,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getCustomerOrderHistory = async (req, res) => {
  try {
    const { userId } = req.user;

    const orders = await Order.find({
      userId,
      orderStatus: "DELIVERED",
      paymentStatus: "PAID",
    })
      .sort({ createdAt: -1 })
      .select("totalAmount orderStatus paymentStatus createdAt");

    res.status(200).json({
      message: "Orders fetched successfully",
      orders: orders.map(o => ({
        orderId: o._id,
        totalAmount: o.totalAmount,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.markOrderDelivered = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.orderStatus = "DELIVERED";
    order.paymentStatus = "PAID";
    await order.save();

    res.status(200).json({
      message: "Order marked as delivered",
      orderId: order._id,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
