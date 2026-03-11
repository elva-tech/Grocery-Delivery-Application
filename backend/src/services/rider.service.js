const Rider = require("../models/Rider.model");
const Order = require("../models/Order.model");

/**
 * Validate if rider is available for order assignment
 */
exports.validateRiderAvailability = async (riderId, tenantId) => {
  try {
    const rider = await Rider.findOne({
      _id: riderId,
      tenantId,
    });

    if (!rider) {
      return { available: false, reason: "Rider not found" };
    }

    if (!rider.isActive) {
      return { available: false, reason: "Rider is inactive" };
    }

    if (rider.status !== "Online") {
      return { available: false, reason: `Rider is ${rider.status}` };
    }

    const MAX_ORDERS = 5;
    if (rider.activeOrders >= MAX_ORDERS) {
      return {
        available: false,
        reason: `Rider has max orders (${MAX_ORDERS})`,
      };
    }

    return { available: true, rider };
  } catch (error) {
    console.error("validateRiderAvailability error:", error);
    throw error;
  }
};

/**
 * Assign order to rider and update both documents
 */
exports.assignOrderToRider = async (orderId, riderId, tenantId) => {
  try {
    // Get order and rider
    const order = await Order.findOne({
      _id: orderId,
      tenantId,
    });

    if (!order) {
      throw new Error("Order not found");
    }

    const rider = await Rider.findOne({
      _id: riderId,
      tenantId,
    });

    if (!rider) {
      throw new Error("Rider not found");
    }

    // Update order
    order.riderId = riderId;
    order.riderName = rider.name;
    order.riderAssignedAt = new Date();
    order.orderStatus = "OUT_FOR_DELIVERY";
    await order.save();

    // Update rider
    rider.activeOrders = (rider.activeOrders || 0) + 1;
    rider.lastOnlineAt = new Date();
    await rider.save();

    return { order, rider };
  } catch (error) {
    console.error("assignOrderToRider error:", error);
    throw error;
  }
};

/**
 * Mark delivery as complete and update statistics
 */
exports.completeDelivery = async (riderId, orderId, tenantId, location = {}) => {
  try {
    const order = await Order.findOne({
      _id: orderId,
      tenantId,
      riderId,
    });

    if (!order) {
      throw new Error("Order or assignment not found");
    }

    if (order.orderStatus !== "OUT_FOR_DELIVERY") {
      throw new Error("Order must be OUT_FOR_DELIVERY to mark as delivered");
    }

    // Update order
    order.orderStatus = "DELIVERED";
    order.riderDeliveryTime = new Date();
    if (location.lat && location.lng) {
      order.deliveryAddress.lat = location.lat;
      order.deliveryAddress.lng = location.lng;
    }
    await order.save();

    // Update rider
    const rider = await Rider.findByIdAndUpdate(
      riderId,
      {
        $inc: {
          activeOrders: -1,
          totalDeliveries: 1,
          totalEarnings: order.totalAmount,
        },
      },
      { new: true }
    );

    return { order, rider };
  } catch (error) {
    console.error("completeDelivery error:", error);
    throw error;
  }
};

/**
 * Mark delivery as failed
 */
exports.failDelivery = async (riderId, orderId, tenantId, reason = "", notes = "") => {
  try {
    const order = await Order.findOne({
      _id: orderId,
      tenantId,
      riderId,
    });

    if (!order) {
      throw new Error("Order or assignment not found");
    }

    if (order.orderStatus !== "OUT_FOR_DELIVERY") {
      throw new Error("Order must be OUT_FOR_DELIVERY");
    }

    // Update order
    order.orderStatus = "OUT_FOR_DELIVERY"; // Keep status but add notes
    order.riderNotes = `Failed: ${reason}. ${notes}`;
    await order.save();

    // Keep active order count for retry

    return { order };
  } catch (error) {
    console.error("failDelivery error:", error);
    throw error;
  }
};

/**
 * Get rider statistics
 */
exports.calculateRiderStats = async (riderId, tenantId) => {
  try {
    const rider = await Rider.findOne({
      _id: riderId,
      tenantId,
    });

    if (!rider) {
      throw new Error("Rider not found");
    }

    // Get delivered orders count and earnings for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ✅ FIXED: Calculate activeOrders dynamically from database instead of stored field
    const activeOrdersCount = await Order.countDocuments({
      tenantId,
      riderId,
      orderStatus: { $in: ["ASSIGNED", "OUT_FOR_DELIVERY", "PICKED_UP"] }
    });

    const todayStats = await Order.aggregate([
      {
        $match: {
          tenantId,
          riderId,
          orderStatus: "DELIVERED",
          riderDeliveryTime: { $gte: today },
        },
      },
      {
        $group: {
          _id: null,
          todayDeliveries: { $sum: 1 },
          todayEarnings: { $sum: "$totalAmount" },
        },
      },
    ]);

    const stats = {
      totalDeliveries: rider.totalDeliveries,
      totalEarnings: rider.totalEarnings,
      averageRating: rider.averageRating,
      activeOrders: activeOrdersCount,  // ✅ Now calculated dynamically
      status: rider.status,
      todayDeliveries: todayStats[0]?.todayDeliveries || 0,
      todayEarnings: todayStats[0]?.todayEarnings || 0,
    };

    return stats;
  } catch (error) {
    console.error("calculateRiderStats error:", error);
    throw error;
  }
};

/**
 * Get available riders for order assignment
 */
exports.getAvailableRiders = async (tenantId, limit = 10) => {
  try {
    const MAX_ORDERS = 5;
    const riders = await Rider.find({
      tenantId,
      status: "Online",
      isActive: true,
      activeOrders: { $lt: MAX_ORDERS },
    })
      .select("_id name phoneNumber vehicle status activeOrders totalDeliveries averageRating")
      .sort({ activeOrders: 1 })
      .limit(limit);

    return riders;
  } catch (error) {
    console.error("getAvailableRiders error:", error);
    throw error;
  }
};

/**
 * Update rider status with validations
 */
exports.updateRiderStatus = async (riderId, tenantId, newStatus) => {
  try {
    const rider = await Rider.findOne({
      _id: riderId,
      tenantId,
    });

    if (!rider) {
      throw new Error("Rider not found");
    }

    const validStatuses = ["Online", "Offline", "On Rest", "Inactive"];
    if (!validStatuses.includes(newStatus)) {
      throw new Error("Invalid status value");
    }

    // ✅ FIXED: Calculate actual active orders dynamically instead of using stored field
    const Order = require("../models/Order.model");
    const actualActiveOrders = await Order.countDocuments({
      tenantId,
      riderId: rider._id,
      orderStatus: { $in: ["ASSIGNED", "OUT_FOR_DELIVERY", "PICKED_UP"] }
    });

    // Validation: Cannot go offline with active orders
    if (newStatus === "Offline" && actualActiveOrders > 0) {
      throw new Error(
        `Cannot go offline with ${actualActiveOrders} active order(s)`
      );
    }

    // Update status and timestamps
    rider.status = newStatus;
    if (newStatus === "Online") {
      rider.lastOnlineAt = new Date();
    } else if (newStatus === "Offline") {
      rider.lastOfflineAt = new Date();
    }

    await rider.save();
    return rider;
  } catch (error) {
    console.error("updateRiderStatus error:", error);
    throw error;
  }
};

/**
 * Get rider's active orders
 */
exports.getRiderActiveOrders = async (riderId, tenantId) => {
  try {
    const orders = await Order.find({
      tenantId,
      riderId,
      orderStatus: "OUT_FOR_DELIVERY",
    })
      .select("_id id totalAmount orderStatus riderAssignedAt")
      .populate("userId", "name phoneNumber")
      .sort({ riderAssignedAt: 1 });

    return orders;
  } catch (error) {
    console.error("getRiderActiveOrders error:", error);
    throw error;
  }
};

/**
 * Delete/deactivate rider
 */
exports.deactivateRider = async (riderId, tenantId) => {
  try {
    const rider = await Rider.findOne({
      _id: riderId,
      tenantId,
    });

    if (!rider) {
      throw new Error("Rider not found");
    }

    if (rider.activeOrders > 0) {
      throw new Error(
        `Cannot deactivate rider with ${rider.activeOrders} active order(s)`
      );
    }

    rider.isActive = false;
    rider.status = "Inactive";
    await rider.save();

    return rider;
  } catch (error) {
    console.error("deactivateRider error:", error);
    throw error;
  }
};
