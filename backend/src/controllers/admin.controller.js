const { createOrderStatusNotification } = require("../services/notification.service");
const Order = require("../models/Order.model");
const Inventory = require("../models/Inventory.model");
const User = require("../models/User.model");
const Product = require("../models/Product.model");

const allowedStatuses = [
  "PLACED",
  "CONFIRMED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED"
];

const allowedTransitions = {
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["CANCELLED"],
  CANCELLED: []
};

//////////////////////////////////////////////////////////////
// ✅ GET ALL ORDERS FOR ADMIN
//////////////////////////////////////////////////////////////

exports.getAllOrdersForAdmin = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {
      tenantId: req.user.tenantId
    };

    if (status) {
      if (typeof status !== "string" || !allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status"
        });
      }
      query.orderStatus = status;
    }

    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("userId", "name email");

    const totalOrders = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      totalOrders,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalOrders / limit),
      orders,
    });

  } catch (error) {
    console.error("Error fetching admin orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

//////////////////////////////////////////////////////////////
// ✅ UPDATE ORDER STATUS
//////////////////////////////////////////////////////////////

exports.updateOrderStatus = async (req, res) => {
  try {

    const { id } = req.params;
    const { status } = req.body;

<<<<<<< HEAD
=======

>>>>>>> ddf6664 (Story 14: Create notification on order status change)
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value"
      });
    }

    const order = await Order.findOne({
      _id: id,
      tenantId: req.user.tenantId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const currentStatus = order.orderStatus;

    if (!allowedTransitions[currentStatus].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status transition"
      });
    }

    // Restore inventory if cancelled
    if (status === "CANCELLED" && currentStatus !== "CANCELLED") {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { quantity: item.qty } }
        );
      }
    }

    order.orderStatus = status;
    await order.save();

    try {
      await createOrderStatusNotification({
      tenantId: order.tenantId,
      userId: order.userId,
      orderId: order._id,
      status});
    }catch (err){
      console.log("Notification failed but order updated:", err.message);
    }



    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order
    });

  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update order status"
    });
  }
};

//////////////////////////////////////////////////////////////
// ✅ NEW STORY — LIST USERS FOR ADMIN
//////////////////////////////////////////////////////////////

exports.getUsers = async (req, res) => {
  try {

    const tenantId = req.user.tenantId;

    let { page = 1, limit = 10 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    if (page <= 0) page = 1;
    if (limit <= 0) limit = 10;
    if (limit > 100) limit = 100;

    const skip = (page - 1) * limit;

    const users = await User.find({ tenantId })
      .select("_id phoneNumber role isActive createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments({ tenantId });

    return res.status(200).json({
      success: true,
      page,
      limit,
      totalUsers,
      users,
    });

  } catch (error) {
    console.error("Admin getUsers error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};
