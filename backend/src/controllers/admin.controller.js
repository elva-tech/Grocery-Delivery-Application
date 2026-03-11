const { createOrderStatusNotification } = require("../services/notification.service");
const Order = require("../models/Order.model");
const Inventory = require("../models/Inventory.model");
const Product = require("../models/Product.model");
const User = require("../models/User.model");
const Rider = require("../models/Rider.model");
const mongoose = require("mongoose");

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
// GET ALL ORDERS FOR ADMIN
//////////////////////////////////////////////////////////////

exports.getAllOrdersForAdmin = async (req, res) => {
  try {
    let page = parseInt(req.query.page);
    let limit = parseInt(req.query.limit);
    const { status } = req.query;

    if (isNaN(page) || page <= 0) page = 1;
    if (isNaN(limit) || limit <= 0) limit = 10;
    if (limit > 100) limit = 100;

    const query = { tenantId: req.user.tenantId };

    if (status) {
      if (!allowedStatuses.includes(status)) {
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
      .limit(limit)
      .populate("userId", "name email")
      .populate("riderId", "name phone");

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    return res.status(200).json({
      success: true,
      page,
      limit,
      totalOrders,
      totalPages,
      orders,
    });

  } catch (error) {
    console.error("Error fetching admin orders:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch orders",
    });
  }
};

//////////////////////////////////////////////////////////////
// UPDATE ORDER STATUS
//////////////////////////////////////////////////////////////

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

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

    // Handle cancellation - restore inventory
    if (status === "CANCELLED" && currentStatus !== "CANCELLED") {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { quantity: item.qty } }
        );
      }
    }

    // Handle rider logic when order is delivered
    if (status === "DELIVERED" && order.riderId) {
      const rider = await Rider.findById(order.riderId);
      if (rider) {
        rider.activeOrders = Math.max(0, (rider.activeOrders || 0) - 1);
        rider.totalDeliveries = (rider.totalDeliveries || 0) + 1;
        rider.totalEarnings = (rider.totalEarnings || 0) + order.totalAmount;
        order.riderDeliveryTime = new Date();
        await rider.save();
      }
    }

    // Handle rider logic when order is cancelled from OUT_FOR_DELIVERY
    if (status === "CANCELLED" && currentStatus === "OUT_FOR_DELIVERY" && order.riderId) {
      const rider = await Rider.findById(order.riderId);
      if (rider) {
        rider.activeOrders = Math.max(0, (rider.activeOrders || 0) - 1);
        await rider.save();
      }
    }

    order.orderStatus = status;
    await order.save();

    try {
      await createOrderStatusNotification({
        tenantId: order.tenantId,
        userId: order.userId,
        orderId: order._id,
        status
      });
    } catch (err) {
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
      message: error.message || "Failed to update order status"
    });
  }
};

//////////////////////////////////////////////////////////////
// LIST USERS FOR ADMIN
//////////////////////////////////////////////////////////////

exports.getUsers = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    let page = parseInt(req.query.page);
    let limit = parseInt(req.query.limit);

    if (isNaN(page) || page <= 0) page = 1;
    if (isNaN(limit) || limit <= 0) limit = 10;
    if (limit > 100) limit = 100;

    const skip = (page - 1) * limit;

    const users = await User.find({ tenantId })
      .select("_id phoneNumber role isActive createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments({ tenantId });
    const totalPages = Math.ceil(totalUsers / limit);

    return res.status(200).json({
      success: true,
      page,
      limit,
      totalUsers,
      totalPages,
      users,
    });

  } catch (error) {
    console.error("Admin getUsers error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch users",
    });
  }
};

//////////////////////////////////////////////////////////////
// BLOCK / UNBLOCK USER
//////////////////////////////////////////////////////////////

exports.blockOrUnblockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (req.user.userId.toString() === id.toString()) {
  return res.status(400).json({
    success: false,
    message: "Admin cannot block themselves",
  });
}

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

   // Force boolean comparison
const requestedState = Boolean(isActive);

if (user.isActive === requestedState) {
  return res.status(400).json({
    success: false,
    message: requestedState
      ? "User already active"
      : "User already blocked",
  });
}


    user.isActive = requestedState;
    await user.save();

    return res.status(200).json({
      success: true,
      message: isActive
        ? "User unblocked successfully"
        : "User blocked successfully",
    });
  } catch (error) {
    console.error("Block/Unblock Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


//////////////////////////////////////////////////////////////
// ADMIN DASHBOARD - ACTIVE ORDERS
//////////////////////////////////////////////////////////////

exports.getActiveOrders = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const count = await Order.countDocuments({
      tenantId,
      orderStatus: { $in: ["PLACED", "CONFIRMED", "OUT_FOR_DELIVERY"] }
    });

    return res.status(200).json({
      success: true,
      activeOrders: count
    });

  } catch (error) {
    console.error("Active Orders API error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active orders"
    });
  }
};

//////////////////////////////////////////////////////////////
// ADMIN DASHBOARD - REVENUE (LAST N DAYS)
//////////////////////////////////////////////////////////////

exports.getRevenue = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Read days from query (default = 7)
    let days = parseInt(req.query.days);


    // Default value
    if (isNaN(days)) {
      days = 7;
    }
    
    // Invalid values
    if (days <= 0) {
      return res.status(400).json({
        success: false,
        message: "Days must be greater than 0"
      });
    }

    // Max limit validation
    if (days > 365) {
      return res.status(400).json({
        success: false,
        message: "Maximum allowed range is 365 days"
      });
    }

    // Calculate date range
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const toDate = new Date();
    const today = new Date();
    const dateMap = {};
    
    // Step 1: Aggregate revenue
    const revenueData = await Order.aggregate([
      {
        $match: {
          tenantId,
          paymentStatus: "PAID",
          createdAt: {
            $gte: fromDate,
            $lte: toDate
          }
        }
      },
      {
        $group: {
           _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Kolkata"
            }
          },
          totalRevenue: { $sum: "$totalAmount" }
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          revenue: { $round: ["$totalRevenue", 2] }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Step 2: Convert to map
    revenueData.forEach(item => {
      dateMap[item.date] = item.revenue;
    });

    // Format revenue to 2 decimal places
    revenueData.forEach(item => {
      item.revenue = Number(item.revenue.toFixed(2));
    });

    // Step 3: Build full day list
    const dailyRevenue = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);

      const dateStr = d.toISOString().split("T")[0];

      dailyRevenue.push({
        date: dateStr,
        revenue: dateMap[dateStr] || 0
      });
    }

    // Step 4: Calculate total
    const totalRevenue = Number(
      revenueData.reduce((sum, item) => sum + item.revenue, 0).toFixed(2)
    );
    
    
    return res.status(200).json({
      success: true,
      days,
      totalRevenue,
      dailyRevenue
    });
  } catch (error) {
    console.error("Revenue API error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch revenue"
    });
  }
};

//////////////////////////////////////////////////////////////
// ADMIN DASHBOARD - PENDING ORDERS
//////////////////////////////////////////////////////////////

exports.getPendingOrders = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const count = await Order.countDocuments({
      tenantId,
      orderStatus: "PLACED"
    });

    return res.status(200).json({
      success: true,
      pendingOrders: count
    });

  } catch (error) {
    console.error("Pending Orders API error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending orders"
    });
  }
};