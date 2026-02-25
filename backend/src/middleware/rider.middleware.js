const Rider = require("../models/Rider.model");

// RIDER ONLY MIDDLEWARE
const riderOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  if (req.user.role !== "RIDER") {
    return res.status(403).json({
      success: false,
      message: "Rider access only",
    });
  }

  next();
};

// CAN ACCESS RIDER - Admin OR the rider themselves
const canAccessRider = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;

    // Admin can access any rider
    if (req.user.role === "ADMIN") {
      return next();
    }

    // Rider can only access their own data
    if (req.user.role === "RIDER") {
      const rider = await Rider.findById(id);
      if (!rider) {
        return res.status(404).json({
          success: false,
          message: "Rider not found",
        });
      }

      if (rider.userId.toString() !== req.user.userId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Cannot access other rider's data",
        });
      }

      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Insufficient permissions",
    });
  } catch (error) {
    console.error("canAccessRider error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// CHECK IF RIDER CAN BE ASSIGNED - Online status and active orders below threshold
const canAssignRider = async (req, res, next) => {
  try {
    const { riderId } = req.body;

    if (!riderId) {
      return res.status(400).json({
        success: false,
        message: "Rider ID required",
      });
    }

    const rider = await Rider.findOne({
      _id: riderId,
      tenantId: req.user.tenantId,
    });

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found",
      });
    }

    const MAX_ACTIVE_ORDERS = 5; // Configurable

    if (rider.status !== "Online") {
      return res.status(400).json({
        success: false,
        message: `Rider is ${rider.status}, cannot assign orders`,
      });
    }

    if (rider.activeOrders >= MAX_ACTIVE_ORDERS) {
      return res.status(400).json({
        success: false,
        message: `Rider has reached maximum active orders (${MAX_ACTIVE_ORDERS})`,
      });
    }

    if (!rider.isActive) {
      return res.status(400).json({
        success: false,
        message: "Rider is inactive",
      });
    }

    // Attach rider to request for use in controller
    req.rider = rider;
    next();
  } catch (error) {
    console.error("canAssignRider error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

module.exports = {
  riderOnly,
  canAccessRider,
  canAssignRider,
};
