const Order = require("../models/Order.model");
const Inventory = require("../models/Inventory.model");
const mongoose = require("mongoose");
const User = require("../models/User.model");


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

    // Delivery validation (restored)
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

      if (!inventory || inventory.availableQty < item.qty) {
        return res.status(400).json({ message: "No stock available" });
      }

      orderItems.push({
        productId: inventory.productId._id,
        name: inventory.productId.name,
        qty: item.qty,
        price: inventory.productId.price,
        unit: inventory.productId.unit || "pcs",
        image: inventory.productId.image || "/placeholder.png"
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
    console.error(error);
    res.status(500).json({
      message: "Something went wrong. Please try again later.",
    });
  }
};

exports.getCustomerOrderById = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format"
      });
    }

    const user = await User.findById(userId).select("isBlocked");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "User is blocked"
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      tenantId
    }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.userId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You cannot access this order"
      });
    }

    const safeItems = Array.isArray(order.items)
      ? order.items.map(item => ({
          productId: item.productId,
          name: item.name,
          qty: item.qty,
          price: item.price
        }))
      : [];

    return res.status(200).json({
      success: true,
      order: {
        id: order._id,
        items: safeItems,
        totalAmount: order.totalAmount,
        paymentMode: order.paymentMode,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        deliveryAddress: order.deliveryAddress,
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later."
    });
  }
};
/**
 * CANCEL ORDER
 */
exports.cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { tenantId, userId } = req.user;

    const order = await Order.findOne({
      _id: orderId,
      tenantId,
      userId
    }).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Order not found or access denied"
      });
    }

    if (!["PLACED", "CONFIRMED"].includes(order.orderStatus)) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Order cannot be cancelled at this stage"
      });
    }

    for (const item of order.items) {
      await Inventory.findOneAndUpdate(
        {
          productId: item.productId,
          tenantId
        },
        {
          $inc: { availableQty: item.qty }
        },
        { session }
      );
    }

    let refundStatus = "NOT_APPLICABLE";

    if (order.paymentMode === "ONLINE" && order.paymentStatus === "PAID") {
      refundStatus = "INITIATED";
      order.paymentStatus = "REFUND_INITIATED";
    }

    order.orderStatus = "CANCELLED";
    order.cancelledAt = new Date();

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Order cancelled successfully",
      orderId: order._id,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      refundStatus
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error(error);
    return res.status(500).json({
      message: "Something went wrong"
    });
  }
};
/**
 * MARK ORDER DELIVERED
 */
exports.markOrderDelivered = async (req, res) => {
  try {
    const { orderId } = req.params;
    const tenantId = req.user.tenantId;

    const order = await Order.findOne({ _id: orderId, tenantId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

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
    console.error(error);
    res.status(500).json({
      message: "Something went wrong. Please try again later.",
    });
  }
};

/**
 * CUSTOMER ORDER HISTORY (ONLY DELIVERED)
 */
exports.getCustomerOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    const { status } = req.query;

    const filter = { userId, tenantId };

    if (status) {
      filter.orderStatus = status;
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map(order => ({
      id: order._id,
      status: order.orderStatus,
      totalAmount: order.totalAmount,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      address: order.deliveryAddress?.line1 || "No address",
      deliverySlot: order.deliverySlot || "Standard Delivery",
      items: order.items.map(item => ({
        productId: item.productId,
        id: item.productId,
        name: item.name,
        quantity: item.qty,
        price: item.price,
        unit: item.unit || "pcs",
        image: item.image || "/placeholder.png"
      }))
    }));

    res.status(200).json({
      message: "Orders fetched successfully",
      orders: formattedOrders
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong. Please try again later."
    });
  }
};
/**
 * ADMIN - GET ALL ORDERS (FOR REVENUE + EXPORT)
 */
exports.getAllOrders = async (req, res) => {
  try {

    const tenantId = req.user.tenantId;

    const orders = await Order.find({ tenantId })
      .sort({ createdAt: -1 })
      .select("totalAmount orderStatus paymentStatus createdAt userId");

    res.status(200).json({
      message: "Orders fetched successfully",
      orders
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong"
    });
  }
};

/**
 * ADMIN - GET TOTAL REVENUE
 */
exports.getRevenue = async (req, res) => {
  try {

    const tenantId = req.user.tenantId;

    const orders = await Order.find({
      tenantId,
      orderStatus: { $ne: "CANCELLED" }
    });

    const totalRevenue = orders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );

    res.status(200).json({
      message: "Revenue calculated successfully",
      totalRevenue,
      totalOrders: orders.length
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong"
    });
  }
};