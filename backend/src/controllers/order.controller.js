const Order = require("../models/Order.model");
const Inventory = require("../models/Inventory.model");
const mongoose = require("mongoose");
const User = require("../models/User.model");
const Settings = require("../models/Settings.model");
const Coupon = require("../models/Coupon.model");
const { recordOrderBilling, reverseOrderBilling } = require("../services/billing.service");

/** Resolve display URL from Product.imageUrl (string or legacy array). */
function resolveProductImageUrl(product) {
  if (!product) return "/placeholder.png";
  const raw = product.imageUrl;
  if (Array.isArray(raw)) {
    const first = raw.find((u) => typeof u === "string" && u.trim());
    return first ? first.trim() : "/placeholder.png";
  }
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "/placeholder.png";
}

/** Line item image for responses (prefers imageUrl; supports legacy `image`). */
function resolveOrderItemImageUrl(item) {
  if (!item) return "/placeholder.png";
  if (item.imageUrl) {
    if (Array.isArray(item.imageUrl)) {
      const first = item.imageUrl.find((u) => typeof u === "string" && u.trim());
      return first ? first.trim() : "/placeholder.png";
    }
    if (typeof item.imageUrl === "string" && item.imageUrl.trim()) {
      return item.imageUrl.trim();
    }
  }
  if (typeof item.image === "string" && item.image.trim()) return item.image.trim();
  return "/placeholder.png";
}

const PAYMENT_MODES = ["COD", "ONLINE"];

/**
 * PLACE ORDER
 */
exports.placeCustomerOrder = async (req, res) => {
  try {
    const { items, paymentMode, deliveryAddress, couponCode } = req.body;

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
        imageUrl: resolveProductImageUrl(inventory.productId),
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

    // Apply settings: delivery charge + discount
    const settings = await Settings.findOneAndUpdate(
      { tenantId },
      { $setOnInsert: { tenantId } },
      { upsert: true, new: true }
    );

    const subtotal = totalAmount;
    const isFreeDelivery = subtotal >= settings.freeDeliveryAbove;
    const deliveryCharge = isFreeDelivery ? 0 : settings.deliveryCharge;

    let discount = 0;
    if (settings.discountType === "PERCENTAGE" && settings.discountValue > 0) {
      discount = Math.round((subtotal * settings.discountValue) / 100);
    } else if (settings.discountType === "FLAT" && settings.discountValue > 0) {
      discount = settings.discountValue;
    }
    discount = Math.min(discount, subtotal);

    // Coupon validation (server-side — never trust client)
    let couponDiscount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({
        tenantId,
        code: couponCode.trim().toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validTo:   { $gte: new Date() },
      });

      if (coupon) {
        const usageLimitOk = coupon.usageLimit == null || coupon.usedCount < coupon.usageLimit;
        const minValueOk = subtotal >= coupon.minOrderValue;

        let firstTimeOk = true;
        if (coupon.firstTimeUserOnly) {
          const prev = await Order.findOne({ userId, orderStatus: { $nin: ["CANCELLED"] } });
          firstTimeOk = !prev;
        }

        if (usageLimitOk && minValueOk && firstTimeOk) {
          if (coupon.discountType === "PERCENTAGE") {
            couponDiscount = Math.round((subtotal * coupon.discountValue) / 100);
            if (coupon.maxDiscount != null) {
              couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
            }
          } else {
            couponDiscount = coupon.discountValue;
          }
          couponDiscount = Math.min(couponDiscount, subtotal);
          appliedCoupon = coupon;
        }
      }
    }

    const grandTotal = subtotal + deliveryCharge - discount - couponDiscount;

    const paymentStatus = "PENDING";

    const order = await Order.create({
      tenantId,
      userId,
      items: orderItems,
      totalAmount: grandTotal,
      deliveryCharge,
      discount,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      couponDiscount,
      paymentMode,
      deliveryAddress,
      orderStatus: "PLACED",
      paymentStatus,
    });

    // Atomically increment coupon usage after order is confirmed
    if (appliedCoupon) {
      await Coupon.findByIdAndUpdate(appliedCoupon._id, { $inc: { usedCount: 1 } });
    }

    // Track billing usage — best-effort, never blocks order creation
    try {
      await recordOrderBilling(tenantId);
    } catch (billingErr) {
      console.error("Billing tracking error (non-critical):", billingErr.message);
    }

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

/**
 * CUSTOMER ORDER HISTORY (ONLY DELIVERED)
 */
exports.getCustomerOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    const { status } = req.query;

    const filter = {
      userId,
      $or: [
        { tenantId: tenantId },
        { tenantId: { $exists: false } },
        { tenantId: null }
      ]
    };
    if (status) {
      filter.orderStatus = status;
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map(order => ({
      id: order._id,                          // ✅ IMPORTANT (frontend expects id)
      status: order.orderStatus,              // ✅ rename
      totalAmount: order.totalAmount,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,

      // ✅ ADD THESE (you already store them)
      address: order.deliveryAddress?.line1 || "No address",
      deliverySlot: order.deliverySlot || "Standard Delivery",

      // ✅ SEND ITEMS PROPERLY
      items: order.items.map((item) => {
        const imageUrl = resolveOrderItemImageUrl(item);
        return {
          productId: item.productId,
          id: item.productId,
          name: item.name,
          quantity: item.qty,
          price: item.price,
          unit: item.unit || "pcs",
          imageUrl,
          image: imageUrl,
        };
      }),
    }));

    res.status(200).json({
      message: "Orders fetched successfully",
      orders: formattedOrders
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong. Please try again later.",
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

    if (order.userId.toString() !== req.user.userId.toString())
 {
      return res.status(403).json({
        success: false,
        message: "You cannot access this order"
      });
    }

    const safeItems = Array.isArray(order.items)
      ? order.items.map((item) => {
          const imageUrl = resolveOrderItemImageUrl(item);
          return {
            productId: item.productId,
            name: item.name,
            qty: item.qty,
            price: item.price,
            unit: item.unit || "pcs",
            imageUrl,
            image: imageUrl,
          };
        })
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
// CANCEL ORDER
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { tenantId, userId } = req.user;

    const order = await Order.findOne({ _id: orderId, tenantId, userId });

    if (!order) {
      return res.status(404).json({ message: "Order not found or access denied" });
    }

    if (!["PLACED", "CONFIRMED"].includes(order.orderStatus)) {
      return res.status(400).json({ message: "Order cannot be cancelled at this stage" });
    }

    // Restore inventory stock
    for (const item of order.items) {
      await Inventory.findOneAndUpdate(
        { productId: item.productId, tenantId },
        { $inc: { availableQty: item.qty } }
      );
    }

    // Handle refund status for online payments
    let refundStatus = "NOT_APPLICABLE";
    if (order.paymentMode === "ONLINE" && order.paymentStatus === "PAID") {
      refundStatus = "INITIATED";
      order.paymentStatus = "REFUND_INITIATED";
    }

    order.orderStatus = "CANCELLED";
    await order.save();

    // Reverse billing usage — best-effort, never blocks cancellation
    try {
      await reverseOrderBilling(tenantId);
    } catch (billingErr) {
      console.error("Billing reversal error (non-critical):", billingErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      orderId: order._id,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      refundStatus,
    });

  } catch (error) {
    console.error("cancelOrder error:", error);
    return res.status(500).json({ message: "Something went wrong" });
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

// ─── POST /api/orders/:orderId/rate ──────────────────────────────────────────
exports.rateOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be an integer between 1 and 5" });
    }

    const order = await Order.findOne({ _id: orderId, tenantId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (String(order.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Not your order" });
    }

    if (order.orderStatus !== "DELIVERED") {
      return res.status(400).json({ success: false, message: "Can only rate delivered orders" });
    }

    if (order.rating?.value != null) {
      return res.status(409).json({ success: false, message: "Order already rated" });
    }

    order.rating = {
      value: rating,
      comment: (comment || "").trim(),
      createdAt: new Date(),
    };
    await order.save();

    res.json({ success: true, message: "Rating submitted successfully" });
  } catch (err) {
    console.error("rateOrder error:", err);
    res.status(500).json({ success: false, message: "Failed to submit rating" });
  }
};