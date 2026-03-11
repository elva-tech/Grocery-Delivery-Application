const Rider = require("../models/Rider.model");
const User = require("../models/User.model");
const Order = require("../models/Order.model");
const mongoose = require("mongoose");
const riderService = require("../services/rider.service");

//////////////////////////////////////////////////////////////
// GET ALL RIDERS
//////////////////////////////////////////////////////////////
exports.getAllRiders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const tenantId = req.user.tenantId;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const query = { tenantId };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }

    const riders = await Rider.find(query)
      .select("-tenantId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // ✅ FIXED: Calculate activeOrders dynamically for each rider
    const Order = require("../models/Order.model");
    const ridersWithActiveOrders = await Promise.all(
      riders.map(async (rider) => {
        const activeCount = await Order.countDocuments({
          tenantId,
          riderId: rider._id,
          orderStatus: { $in: ["ASSIGNED", "OUT_FOR_DELIVERY", "PICKED_UP"] }
        });
        
        const riderObj = rider.toObject ? rider.toObject() : rider;
        riderObj.activeOrders = activeCount;
        return riderObj;
      })
    );

    const total = await Rider.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      data: {
        riders: ridersWithActiveOrders,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("getAllRiders error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch riders",
    });
  }
};

//////////////////////////////////////////////////////////////
// GET SINGLE RIDER
//////////////////////////////////////////////////////////////
exports.getRiderById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID",
      });
    }

    const rider = await Rider.findOne({ _id: id, tenantId }).populate(
      "userId",
      "phoneNumber name"
    );

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found",
      });
    }

    // Get stats
    const stats = await riderService.calculateRiderStats(id, tenantId);

    return res.status(200).json({
      success: true,
      data: {
        rider,
        stats,
      },
    });
  } catch (error) {
    console.error("getRiderById error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch rider",
    });
  }
};

//////////////////////////////////////////////////////////////
// CREATE NEW RIDER
//////////////////////////////////////////////////////////////
exports.createRider = async (req, res) => {
  try {
    const { name, phoneNumber, vehicle, licenseNumber } = req.body;
    const tenantId = req.user.tenantId;

    // Validation
    if (!name || !phoneNumber || !vehicle) {
      return res.status(400).json({
        success: false,
        message: "Name, phone number, and vehicle are required",
      });
    }

    if (!["Bike", "Scooter", "Electric Van"].includes(vehicle)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle type",
      });
    }

    // Check if rider with phone already exists
    const existingRider = await Rider.findOne({
      tenantId,
      phoneNumber,
    });

    if (existingRider) {
      return res.status(400).json({
        success: false,
        message: "Rider with this phone number already exists",
      });
    }

    // Check if user with phone exists, else create
    let user = await User.findOne({
      tenantId,
      phoneNumber,
    });

    if (!user) {
      user = await User.create({
        tenantId,
        phoneNumber,
        name,
        role: "RIDER",
        isActive: true,
      });
    } else if (user.role !== "RIDER") {
      // User exists but not a rider, update role
      user.role = "RIDER";
      await user.save();
    }

    // Create rider
    const rider = await Rider.create({
      tenantId,
      userId: user._id,
      name,
      phoneNumber,
      vehicle,
      licenseNumber: licenseNumber || "",
      status: "Offline",
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Rider created successfully",
      data: { rider },
    });
  } catch (error) {
    console.error("createRider error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create rider",
    });
  }
};

//////////////////////////////////////////////////////////////
// UPDATE RIDER
//////////////////////////////////////////////////////////////
exports.updateRider = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, vehicle, licenseNumber } = req.body;
    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID",
      });
    }

    const rider = await Rider.findOne({ _id: id, tenantId });

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found",
      });
    }

    // Update fields
    if (name) rider.name = name;
    if (vehicle && ["Bike", "Scooter", "Electric Van"].includes(vehicle)) {
      rider.vehicle = vehicle;
    }
    if (licenseNumber !== undefined) {
      rider.licenseNumber = licenseNumber;
    }

    // Handle phone number change (check uniqueness)
    if (phoneNumber && phoneNumber !== rider.phoneNumber) {
      const existing = await Rider.findOne({
        tenantId,
        phoneNumber,
        _id: { $ne: id },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Phone number already in use",
        });
      }

      rider.phoneNumber = phoneNumber;
    }

    await rider.save();

    return res.status(200).json({
      success: true,
      message: "Rider updated successfully",
      data: { rider },
    });
  } catch (error) {
    console.error("updateRider error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update rider",
    });
  }
};

//////////////////////////////////////////////////////////////
// UPDATE RIDER STATUS
//////////////////////////////////////////////////////////////
exports.updateRiderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID",
      });
    }

    const rider = await riderService.updateRiderStatus(id, tenantId, status);

    return res.status(200).json({
      success: true,
      message: `Rider status updated to ${status}`,
      data: { rider },
    });
  } catch (error) {
    console.error("updateRiderStatus error:", error);

    if (
      error.message.includes("Cannot go offline") ||
      error.message.includes("Invalid status")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update rider status",
    });
  }
};

//////////////////////////////////////////////////////////////
// GET RIDER'S ACTIVE ORDERS
//////////////////////////////////////////////////////////////
exports.getRiderOrders = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID",
      });
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const query = {
      tenantId,
      riderId: id,
    };

    if (status) {
      query.orderStatus = status;
    }

    const orders = await Order.find(query)
      .populate("userId", "name phoneNumber")
      .sort({ riderAssignedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Order.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    const activeCount = await Order.countDocuments({
      tenantId,
      riderId: id,
      orderStatus: "OUT_FOR_DELIVERY",
    });

    return res.status(200).json({
      success: true,
      data: {
        orders,
        activeCount,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("getRiderOrders error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch rider orders",
    });
  }
};

//////////////////////////////////////////////////////////////
// GET RIDER STATS
//////////////////////////////////////////////////////////////
exports.getRiderStats = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID",
      });
    }

    const stats = await riderService.calculateRiderStats(id, tenantId);

    return res.status(200).json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    console.error("getRiderStats error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch rider stats",
    });
  }
};

//////////////////////////////////////////////////////////////
// GET AVAILABLE RIDERS
//////////////////////////////////////////////////////////////
exports.getAvailableRiders = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const tenantId = req.user.tenantId;

    const riders = await riderService.getAvailableRiders(
      tenantId,
      Math.min(100, Math.max(1, parseInt(limit)))
    );

    return res.status(200).json({
      success: true,
      data: { riders },
    });
  } catch (error) {
    console.error("getAvailableRiders error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch available riders",
    });
  }
};

//////////////////////////////////////////////////////////////
// ASSIGN ORDER TO RIDER
//////////////////////////////////////////////////////////////
exports.assignOrderToRider = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderId } = req.body;
    const tenantId = req.user.tenantId;
    // Debug log removed

    if (!orderId) {
      console.log("[ASSIGN RIDER] Missing orderId");
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log("[ASSIGN RIDER] Invalid rider ID:", id);
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID",
      });
    }

    // Validate rider availability
    const availability = await riderService.validateRiderAvailability(
      id,
      tenantId
    );
    // Debug log removed
    if (!availability.available) {
      // Debug log removed
      return res.status(400).json({
        success: false,
        message: availability.reason,
      });
    }

    // Check order exists and is in CONFIRMED status
    const order = await Order.findOne({
      _id: orderId,
      tenantId,
    });
    // Debug log removed

    if (!order) {
      // Debug log removed
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.orderStatus !== "CONFIRMED") {
      // Debug log removed
      return res.status(400).json({
        success: false,
        message: "Only CONFIRMED orders can be assigned",
      });
    }

    // Assign order
    const { updatedOrder, updatedRider } =
      await riderService.assignOrderToRider(orderId, id, tenantId);

    // Debug log removed
    return res.status(200).json({
      success: true,
      message: "Order assigned to rider successfully",
      data: {
        order: updatedOrder,
        rider: updatedRider,
      },
    });
  } catch (error) {
    console.error("assignOrderToRider error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to assign order",
    });
  }
};

//////////////////////////////////////////////////////////////
// COMPLETE DELIVERY (Rider endpoint)
//////////////////////////////////////////////////////////////
exports.completeDelivery = async (req, res) => {
  try {
    const { id, orderId } = req.params;
    const { lat, lng, notes = "" } = req.body;
    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // Complete delivery
    const { updatedOrder, updatedRider } = await riderService.completeDelivery(
      id,
      orderId,
      tenantId,
      { lat, lng }
    );

    return res.status(200).json({
      success: true,
      message: "Delivery completed successfully",
      data: {
        order: updatedOrder,
        rider: updatedRider,
      },
    });
  } catch (error) {
    console.error("completeDelivery error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to complete delivery",
    });
  }
};

//////////////////////////////////////////////////////////////
// FAIL DELIVERY (Rider endpoint)
//////////////////////////////////////////////////////////////
exports.failDelivery = async (req, res) => {
  try {
    const { id, orderId } = req.params;
    const { reason = "", notes = "" } = req.body;
    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // Fail delivery
    const { updatedOrder } = await riderService.failDelivery(
      id,
      orderId,
      tenantId,
      reason,
      notes
    );

    return res.status(200).json({
      success: true,
      message: "Delivery marked as failed",
      data: { order: updatedOrder },
    });
  } catch (error) {
    console.error("failDelivery error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to mark delivery as failed",
    });
  }
};

//////////////////////////////////////////////////////////////
// DELETE/DEACTIVATE RIDER
//////////////////////////////////////////////////////////////
exports.deactivateRider = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID",
      });
    }

    const rider = await riderService.deactivateRider(id, tenantId);

    return res.status(200).json({
      success: true,
      message: "Rider deactivated successfully",
      data: { rider },
    });
  } catch (error) {
    console.error("deactivateRider error:", error);

    if (error.message.includes("Cannot deactivate")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to deactivate rider",
    });
  }
};
