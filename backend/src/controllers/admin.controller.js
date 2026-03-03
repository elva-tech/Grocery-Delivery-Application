const { createOrderStatusNotification } = require("../services/notification.service");
const Order = require("../models/Order.model");
const Inventory = require("../models/Inventory.model");
const User = require("../models/User.model");
const Product = require("../models/Product.model");
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
// ✅ GET ALL ORDERS FOR ADMIN
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

// GET REVENUE (LAST N DAYS)
exports.getRevenue = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // ✅ STEP 1: Read query param
    const daysParam = parseInt(req.query.days);

    // ✅ STEP 2: Default to 7 if not provided
    const days = isNaN(daysParam) ? 7 : daysParam;

    // ✅ STEP 3: Validation (VERY IMPORTANT)
    if (days <= 0 || days > 365) {
      return res.status(400).json({
        success: false,
        message: "Days must be between 1 and 365"
      });
    }

    // ✅ STEP 4: Calculate fromDate
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    fromDate.setHours(0, 0, 0, 0);

    // ✅ STEP 5: Aggregate
    const revenueData = await Order.aggregate([
      {
        $match: {
        tenantId,
        paymentStatus: "PAID",
        createdAt: { $gte: fromDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt"
          }
        },
        totalRevenue: { $sum: "$totalAmount" }
      }
    },
    {
      $project: {
        _id: 0,
        date: "$_id",
        revenue: "$totalRevenue"
      }
    },
    { $sort: { date: 1 } 
  }]);

    return res.status(200).json({
      success: true,
      days,
      data: revenueData
    });

  } catch (error) {
    console.error("Revenue error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch revenue"
    });
  }
};


// GET ACTIVE ORDERS COUNT
exports.getActiveOrdersCount = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const count = await Order.countDocuments({
      tenantId,
      orderStatus: {
        $in: ["PLACED", "CONFIRMED", "OUT_FOR_DELIVERY"]
      }
    });

    return res.status(200).json({
      success: true,
      activeOrders: count
    });

  } catch (error) {
    console.error("Active orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active orders"
    });
  }
};


// GET PENDING ORDERS COUNT
exports.getPendingOrdersCount = async (req, res) => {
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
    console.error("Pending orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending orders"
    });
  }
};