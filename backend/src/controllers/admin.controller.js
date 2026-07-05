const { createOrderStatusNotification } = require("../services/notification.service");
const {
  notifyOutForDeliverySafe,
  notifyOrderDeliveredSafe,
} = require("../services/notify.service");
const {
  initiateOrderRefund,
  isRefundableOrder,
} = require("../services/orderRefund.service");
const { restoreOrderInventory } = require("../utils/orderInventory.util");
const Order = require("../models/Order.model");
const Inventory = require("../models/Inventory.model");
const Product = require("../models/Product.model");
const User = require("../models/User.model");
const Rider = require("../models/Rider.model");
const mongoose = require("mongoose");
const {
  revenueMatchFilter,
  netRevenueAddFieldsStage,
  getOrderNetRevenue,
} = require("../utils/orderRevenue");

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
    const { status, search, dateFrom, dateTo, ratingFilter } = req.query;

    if (isNaN(page) || page <= 0) page = 1;
    if (isNaN(limit) || limit <= 0) limit = 25;
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

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (!isNaN(from.getTime())) {
          from.setHours(0, 0, 0, 0);
          query.createdAt.$gte = from;
        }
      }
      if (dateTo) {
        const to = new Date(dateTo);
        if (!isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999);
          query.createdAt.$lte = to;
        }
      }
      if (!Object.keys(query.createdAt).length) delete query.createdAt;
    }

    const searchTerm = typeof search === "string" ? search.trim() : "";
    if (searchTerm) {
      const orConditions = [
        { customerName: { $regex: searchTerm, $options: "i" } },
        { customerPhone: { $regex: searchTerm, $options: "i" } },
      ];
      if (mongoose.Types.ObjectId.isValid(searchTerm)) {
        orConditions.push({ _id: searchTerm });
      } else {
        orConditions.push({
          $expr: {
            $regexMatch: {
              input: { $toString: "$_id" },
              regex: searchTerm,
              options: "i",
            },
          },
        });
      }
      query.$or = orConditions;
    }

    if (ratingFilter === "RATED") {
      query["rating.value"] = { $exists: true, $ne: null };
    } else if (ratingFilter === "LOW") {
      query["rating.value"] = { $exists: true, $lte: 2 };
    }

    const skip = (page - 1) * limit;

    const [orders, totalOrders] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email phoneNumber"),
      Order.countDocuments(query),
    ]);
    const totalPages = Math.max(1, Math.ceil(totalOrders / limit));

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

    if (currentStatus === status) {
      return res.status(200).json({
        success: true,
        message: "Order status unchanged",
        order: await Order.findById(id),
      });
    }

    if (!allowedTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status transition",
      });
    }

    let refundResult = null;

    // Handle cancellation - restore inventory + Razorpay refund for paid online orders
    if (status === "CANCELLED" && currentStatus !== "CANCELLED") {
      await restoreOrderInventory(order, req.user.tenantId);

      if (isRefundableOrder(order)) {
        try {
          refundResult = await initiateOrderRefund(order, {
            reason: "admin_cancelled",
          });
        } catch (refundErr) {
          console.error("Admin cancel: refund failed", {
            orderId: order._id,
            message: refundErr.message,
          });
          refundResult = {
            success: false,
            error: refundErr.message || "Refund initiation failed",
          };
        }
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

    // COD orders: mark as PAID when delivered (cash collected on delivery)
    if (status === "DELIVERED" && order.paymentMode === "COD") {
      order.paymentStatus = "PAID";
    }

    await order.save();

    const refreshedOrder = await Order.findById(order._id);

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

    if (status === "OUT_FOR_DELIVERY") {
      await notifyOutForDeliverySafe(refreshedOrder || order);
    } else if (status === "DELIVERED") {
      await notifyOrderDeliveredSafe(refreshedOrder || order);
    }

    const response = {
      success: true,
      message: "Order status updated successfully",
      order: refreshedOrder || order,
    };

    if (status === "CANCELLED" && refundResult) {
      response.refund = refundResult;
      if (refundResult.success === false) {
        response.message =
          "Order cancelled. Online refund could not be started — use Retry refund in admin.";
      } else if (refundResult.skipped === false && !refundResult.error) {
        response.message =
          refundResult.paymentStatus === "REFUNDED"
            ? "Order cancelled and refund completed."
            : "Order cancelled. Refund is processing (5–7 business days).";
      }
    }

    return res.status(200).json(response);

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
    
    // Delivered net revenue (minus refunds) per day
    const revenueData = await Order.aggregate([
      {
        $match: revenueMatchFilter(tenantId, {
          createdAt: {
            $gte: fromDate,
            $lte: toDate,
          },
        }),
      },
      netRevenueAddFieldsStage,
      {
        $group: {
           _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Kolkata"
            }
          },
          totalRevenue: { $sum: "$netRevenue" }
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
// ADMIN - REVENUE REPORT (ALL-TIME, DELIVERED − REFUNDS)
//////////////////////////////////////////////////////////////

exports.getRevenueReport = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    let page = parseInt(req.query.page);
    let limit = parseInt(req.query.limit);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    if (isNaN(page) || page <= 0) page = 1;
    if (isNaN(limit) || limit <= 0) limit = 25;
    if (limit > 100) limit = 100;

    const match = revenueMatchFilter(tenantId);
    if (search) {
      match.$or = [
        { customerName: { $regex: search, $options: "i" } },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: "$_id" },
              regex: search,
              options: "i",
            },
          },
        },
      ];
    }

    const skip = (page - 1) * limit;

    const [aggResult, totalOrders, orders] = await Promise.all([
      Order.aggregate([
        { $match: match },
        netRevenueAddFieldsStage,
        { $group: { _id: null, totalRevenue: { $sum: "$netRevenue" } } },
      ]),
      Order.countDocuments(match),
      Order.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "totalAmount orderStatus paymentStatus refundAmount refundStatus createdAt customerName"
        )
        .populate("userId", "name")
        .lean(),
    ]);

    const rows = orders.map((o) => {
      const net = getOrderNetRevenue(o);
      return {
        orderId: o._id,
        date: o.createdAt,
        customer: o.customerName || o.userId?.name || "Unknown",
        grossAmount: o.totalAmount,
        amount: net,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        refundStatus: o.refundStatus,
        refundAmount: o.refundAmount,
      };
    });

    const totalRevenue = Number((aggResult[0]?.totalRevenue ?? 0).toFixed(2));
    const totalPages = Math.max(1, Math.ceil(totalOrders / limit));

    return res.status(200).json({
      success: true,
      totalRevenue,
      orderCount: totalOrders,
      page,
      limit,
      totalPages,
      rows,
    });
  } catch (error) {
    console.error("Revenue report error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch revenue report",
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

//////////////////////////////////////////////////////////////
// MARK COD ORDER AS PAID
//////////////////////////////////////////////////////////////

exports.markCODPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findOne({ _id: id, tenantId });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.paymentMode !== "COD") {
      return res.status(400).json({ success: false, message: "Only COD orders can be marked as paid this way" });
    }

    if (order.paymentStatus === "PAID") {
      return res.status(200).json({
        success: true,
        message: "Order is already marked as paid",
        alreadyPaid: true,
        orderId: order._id,
        paymentStatus: order.paymentStatus,
      });
    }

    order.paymentStatus = "PAID";
    await order.save();

    return res.status(200).json({
      success: true,
      message: "COD order marked as paid",
      orderId: order._id,
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    console.error("markCODPaid error:", error);
    return res.status(500).json({ success: false, message: "Failed to mark order as paid" });
  }
};

//////////////////////////////////////////////////////////////
// RETRY RAZORPAY REFUND (admin)
//////////////////////////////////////////////////////////////

exports.retryOrderRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findOne({ _id: id, tenantId });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.orderStatus !== "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Refunds can only be retried for cancelled orders",
      });
    }

    if (!isRefundableOrder(order)) {
      return res.status(400).json({
        success: false,
        message:
          "This order is not eligible for refund (COD, unpaid, or already refunded)",
      });
    }

    const refundResult = await initiateOrderRefund(order, {
      reason: "admin_retry_refund",
    });

    const refreshedOrder = await Order.findById(order._id);

    return res.status(200).json({
      success: true,
      message:
        refreshedOrder?.paymentStatus === "REFUNDED"
          ? "Refund completed"
          : "Refund initiated — processing at Razorpay",
      refund: refundResult,
      order: refreshedOrder,
    });
  } catch (error) {
    console.error("retryOrderRefund error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to initiate refund",
    });
  }
};