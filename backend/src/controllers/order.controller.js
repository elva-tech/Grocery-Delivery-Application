const Order = require("../models/Order.model");
const Tenant = require("../models/Tenant.model");
const CustomerInvoice = require("../models/CustomerInvoice.model");
const Address = require("../models/Address.model");
const Inventory = require("../models/Inventory.model");
const Product = require("../models/Product.model");
const mongoose = require("mongoose");
const User = require("../models/User.model");
const Settings = require("../models/Settings.model");
const Coupon = require("../models/Coupon.model");
const { recordOrderBilling, reverseOrderBilling } = require("../services/billing.service");
const {
  isValidIndianPincodeFormat,
  lookupIndianPincode,
} = require("../services/pincodeLookup.service");
const {
  generateAndUploadInvoicePdf,
  streamInvoicePdfFromCloudinary,
  streamGeneratedInvoicePdf,
} = require("../services/invoice.service");

function isInvoiceAssetPdf(invoiceAsset) {
  if (!invoiceAsset || !invoiceAsset.imageUrl) return false;
  const declaredPdf = String(invoiceAsset.fileType || "").toLowerCase() === "application/pdf";
  const urlLooksPdf = /\.pdf(?:$|\?)/i.test(String(invoiceAsset.imageUrl));
  return declaredPdf || urlLooksPdf;
}

function invoiceNumberPattern(tenantId, sequenceNumber) {
  const tenantToken = String(tenantId || "tenant")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 6) || "TENANT";
  return `INV-${tenantToken}-${String(sequenceNumber).padStart(6, "0")}`;
}

async function getOrCreateCustomerInvoice(order) {
  const existing = await CustomerInvoice.findOne({ orderId: order._id }).lean();
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await CustomerInvoice.findOne({ tenantId: order.tenantId })
      .sort({ sequenceNumber: -1 })
      .select("sequenceNumber")
      .lean();
    const sequenceNumber = Number(last?.sequenceNumber || 0) + 1;
    const invoiceNumber = invoiceNumberPattern(order.tenantId, sequenceNumber);
    try {
      return await CustomerInvoice.create({
        tenantId: order.tenantId,
        orderId: order._id,
        sequenceNumber,
        invoiceNumber,
        fileType: "application/pdf",
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }
  throw new Error("Unable to allocate invoice number");
}

/** Resolve display URL from Product.images or legacy imageUrl / array. */
function resolveProductImageUrl(product) {
  if (!product) return "/placeholder.png";
  const images = product.images;
  if (Array.isArray(images) && images.length > 0) {
    const first = images.find(
      (i) => i && typeof i.url === "string" && i.url.trim()
    );
    if (first) return first.url.trim();
  }
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

function formatDeliveryAddressForCustomer(da) {
  if (!da || typeof da !== "object") return "No address";
  const tail = [da.city, da.state, da.pincode].filter(Boolean).join(", ");
  const parts = [da.line1, da.line2, da.landmark, tail].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return da.line1 || "No address";
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

    const placingUser = await User.findById(userId).select("name phoneNumber").lean();
    const customerName = placingUser?.name || "";
    const customerPhone = String(placingUser?.phoneNumber || "").trim();

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Please add items to place order" });
    }

    if (!PAYMENT_MODES.includes(paymentMode)) {
      return res.status(400).json({ message: "Invalid payment mode" });
    }

    const line1 = String(deliveryAddress?.line1 || "").trim();
    const landmark = String(deliveryAddress?.landmark || "").trim();
    const lat = Number(deliveryAddress?.lat);
    const lng = Number(deliveryAddress?.lng);

    if (!line1 || !landmark) {
      return res.status(400).json({ message: "Address line 1 and landmark are required" });
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ message: "Valid delivery address required" });
    }

    const pinDigits = String(deliveryAddress?.pincode || "")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!isValidIndianPincodeFormat(pinDigits)) {
      return res.status(400).json({ message: "Enter a valid 6-digit Indian PIN code" });
    }

    const pinLookup = await lookupIndianPincode(pinDigits);
    if (!pinLookup.ok) {
      return res.status(400).json({
        message: "PIN code not found. Enter a valid Indian PIN code.",
      });
    }

    const normalizedDeliveryAddress = {
      isMyAddress:
        deliveryAddress?.isMyAddress !== undefined
          ? Boolean(deliveryAddress.isMyAddress)
          : true,
      recipientName: String(deliveryAddress?.recipientName || "").trim(),
      recipientPhone: String(deliveryAddress?.recipientPhone || "").trim(),
      line1,
      line2: String(deliveryAddress?.line2 || "").trim(),
      landmark,
      city: pinLookup.city,
      state: pinLookup.state,
      pincode: pinLookup.pincode,
      lat,
      lng,
    };

    let orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId) || item.qty <= 0) {
        return res.status(400).json({ message: "Invalid product details" });
      }

      const productRow = await Product.findOne({
        _id: item.productId,
        tenantId,
      })
        .select("name")
        .lean();

      if (!productRow) {
        return res.status(400).json({
          success: false,
          message:
            "This product is not available at your store. Clear your cart, confirm you are logged into the correct store, and try again.",
          error: "Product not found for tenant",
        });
      }

      const inventory = await Inventory.findOne({
        productId: item.productId,
        tenantId,
      }).populate("productId");

      if (!inventory) {
        return res.status(400).json({
          success: false,
          message: `No stock record for ${productRow.name}.`,
          error: "No inventory for product",
        });
      }

      if (inventory.availableQty < item.qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${productRow.name}.`,
          error: `Only ${inventory.availableQty} available`,
        });
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

    let billingAddress = {
      line1: normalizedDeliveryAddress.line1,
      line2: normalizedDeliveryAddress.line2,
      landmark: normalizedDeliveryAddress.landmark,
      city: normalizedDeliveryAddress.city,
      state: normalizedDeliveryAddress.state,
      pincode: normalizedDeliveryAddress.pincode,
    };

    if (!normalizedDeliveryAddress.isMyAddress) {
      const selfAddress = await Address.findOne({
        tenantId,
        userId,
        isMyAddress: true,
        isActive: true,
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean();

      if (selfAddress) {
        billingAddress = {
          line1: selfAddress.line1 || "",
          line2: selfAddress.line2 || "",
          landmark: selfAddress.landmark || "",
          city: selfAddress.city || "",
          state: selfAddress.state || "",
          pincode: selfAddress.pincode || "",
        };
      }
    }

    const order = await Order.create({
      tenantId,
      userId,
      customerName,
      customerPhone,
      items: orderItems,
      totalAmount: grandTotal,
      deliveryCharge,
      discount,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      couponDiscount,
      paymentMode,
      deliveryAddress: normalizedDeliveryAddress,
      billingAddress,
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
      tenantId,
    };
    if (status) {
      filter.orderStatus = status;
    }

 const orders = await Order.find(filter)
      .sort({ createdAt: -1 });

    // Fetch return requests for these orders in one query
    const ReturnRequest = require("../models/ReturnRequest.model");
    const orderIds = orders.map(o => o._id);
    const returnRequests = await ReturnRequest.find({
      orderId: { $in: orderIds }
    }).lean();
    const returnMap = {};
    for (const r of returnRequests) {
      returnMap[String(r.orderId)] = r;
    }

    const formattedOrders = orders.map(order => {
      const returnReq = returnMap[String(order._id)];
      return {
        id: order._id,
        status: order.orderStatus,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        address: formatDeliveryAddressForCustomer(order.deliveryAddress),
        deliverySlot: order.deliverySlot || "Standard Delivery",
        invoiceAvailable: Boolean(order.invoiceAsset?.imageUrl),
        adminNote: returnReq?.resolutionNote || order.adminNote || "",
        resolutionNote: returnReq?.resolutionNote || "",
        returnStatus: returnReq?.status || null,
        rating: order.rating || null,
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
      };
    });

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

    const tenant = await Tenant.findOne({ tenantId }).lean();
    const invoiceUser = await User.findById(order.userId).select("phoneNumber").lean();
    const customerInvoice = await getOrCreateCustomerInvoice(order);

    if (!isInvoiceAssetPdf(order.invoiceAsset)) {
      try {
        const uploadedInvoice = await generateAndUploadInvoicePdf({
          order: { ...order.toObject(), customerPhone: invoiceUser?.phoneNumber || "" },
          tenant,
          invoiceNumber: customerInvoice.invoiceNumber,
        });
        order.invoiceAsset = {
          imageUrl: uploadedInvoice.url,
          imagePublicId: uploadedInvoice.public_id,
          fileType: "application/pdf",
          generatedAt: new Date(),
        };
        await CustomerInvoice.findByIdAndUpdate(customerInvoice._id, {
          invoiceUrl: uploadedInvoice.url,
          invoicePublicId: uploadedInvoice.public_id,
          generatedAt: new Date(),
        });
      } catch (invoiceErr) {
        console.error("Invoice generation failed (non-blocking):", invoiceErr);
      }
    }

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

exports.downloadOrderSummaryPdf = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userId, tenantId, role } = req.user;

    const order = await Order.findOne({ _id: orderId, tenantId }).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (role === "CUSTOMER" && String(order.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Not allowed to access this order summary" });
    }
    if (order.orderStatus !== "DELIVERED") {
      return res.status(400).json({ success: false, message: "Order summary is available only after delivery" });
    }
    const tenant = await Tenant.findOne({ tenantId }).lean();
    const invoiceUser = await User.findById(order.userId).select("phoneNumber").lean();
    const customerInvoice = await getOrCreateCustomerInvoice(order);
    let invoiceImageUrl = order.invoiceAsset?.imageUrl || "";
    const invoicePayload = {
      order: { ...order, customerPhone: invoiceUser?.phoneNumber || "" },
      tenant,
      invoiceNumber: customerInvoice.invoiceNumber,
    };
    let uploadedInThisRequest = false;
    if (!isInvoiceAssetPdf(order.invoiceAsset)) {
      const freshOrder = await Order.findById(order._id);
      if (!freshOrder) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
      const uploadedInvoice = await generateAndUploadInvoicePdf({
        order: { ...freshOrder.toObject(), customerPhone: invoiceUser?.phoneNumber || "" },
        tenant,
        invoiceNumber: customerInvoice.invoiceNumber,
      });
      freshOrder.invoiceAsset = {
        imageUrl: uploadedInvoice.url,
        imagePublicId: uploadedInvoice.public_id,
        fileType: "application/pdf",
        generatedAt: new Date(),
      };
      await freshOrder.save();
      await CustomerInvoice.findByIdAndUpdate(customerInvoice._id, {
        invoiceUrl: uploadedInvoice.url,
        invoicePublicId: uploadedInvoice.public_id,
        generatedAt: new Date(),
      });
      invoiceImageUrl = uploadedInvoice.url;
      uploadedInThisRequest = true;
    }

    const invoiceFileName = `order-summary-${customerInvoice.invoiceNumber}.pdf`;
    // If we just uploaded, avoid a second Cloudinary fetch/upload in the same click.
    if (uploadedInThisRequest) {
      await streamGeneratedInvoicePdf(invoicePayload, res, invoiceFileName);
      return;
    }
    try {
      await streamInvoicePdfFromCloudinary(invoiceImageUrl, res, invoiceFileName);
    } catch (cloudinaryErr) {
      console.error("Cloudinary order summary fetch failed, serving generated PDF:", cloudinaryErr.message);
      const liveOrder = await Order.findById(order._id).lean();
      if (!liveOrder) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
      // Re-upload in fallback flow so Cloudinary folder and DB stay in sync.
      try {
        const uploadedInvoice = await generateAndUploadInvoicePdf({
          order: liveOrder,
          tenant,
          invoiceNumber: customerInvoice.invoiceNumber,
        });
        await Order.findByIdAndUpdate(order._id, {
          $set: {
            invoiceAsset: {
              imageUrl: uploadedInvoice.url,
              imagePublicId: uploadedInvoice.public_id,
              fileType: "application/pdf",
              generatedAt: new Date(),
            },
          },
        });
        await CustomerInvoice.findByIdAndUpdate(customerInvoice._id, {
          invoiceUrl: uploadedInvoice.url,
          invoicePublicId: uploadedInvoice.public_id,
          generatedAt: new Date(),
        });
      } catch (uploadErr) {
        console.error("Fallback upload failed (continuing with direct stream):", uploadErr.message);
      }
      await streamGeneratedInvoicePdf(
        { ...invoicePayload, order: { ...liveOrder, customerPhone: invoiceUser?.phoneNumber || "" } },
        res,
        invoiceFileName
      );
    }
  } catch (error) {
    console.error("downloadOrderSummaryPdf error:", error);
    return res.status(500).json({ success: false, message: "Failed to download order summary" });
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