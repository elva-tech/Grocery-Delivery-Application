const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    customerName: {
      type: String,
      default: "",
    },
    customerPhone: {
      type: String,
      default: "",
    },

    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        qty: Number,
        price: Number,
        unit: { type: String, default: "pcs" },
        imageUrl: { type: String, default: "" },
      },
    ],

    totalAmount: {
      type: Number,
      required: true,
    },

    deliveryCharge: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    couponCode: {
      type: String,
      default: null,
    },

    couponDiscount: {
      type: Number,
      default: 0,
    },

    paymentMode: {
      type: String,
      enum: ["COD", "ONLINE"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUND_PENDING", "REFUNDED"],
      default: "PENDING",
    },

    razorpayOrderId: {
      type: String,
      default: null,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
    },

    refundStatus: {
      type: String,
      enum: ["NONE", "PENDING", "PARTIAL", "FULL", "FAILED"],
      default: "NONE",
    },

    razorpayRefundId: {
      type: String,
      default: null,
    },

    refundAmount: {
      type: Number,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    refundFailureReason: {
      type: String,
      default: "",
    },

    orderStatus: {
      type: String,
      enum: [
        "PLACED",
        "CONFIRMED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "PLACED",
      index: true,
    },

    deliveryAddress: {
      isMyAddress: { type: Boolean, default: true },
      recipientName: { type: String, default: "" },
      recipientPhone: { type: String, default: "" },
      line1: String,
      line2: { type: String, default: "" },
      landmark: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
      lat: Number,
      lng: Number,
      /** Map/open-in-maps URL from POST /api/map/process (`mapLink`), for admin / riders. */
      addressUrl: { type: String, default: "" },
    },
    billingAddress: {
      line1: String,
      line2: { type: String, default: "" },
      landmark: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
    },

    // Rider assignment fields
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    },

    riderName: {
      type: String,
      default: null,
    },

    riderAssignedAt: {
      type: Date,
      default: null,
    },

    riderPickupTime: {
      type: Date,
      default: null,
    },

    riderDeliveryTime: {
      type: Date,
      default: null,
    },

    riderRating: {
      type: Number,
      default: null,
      min: 0,
      max: 5,
    },

    riderNotes: {
      type: String,
      default: "",
    },

    rating: {
      value: { type: Number, min: 1, max: 5, default: null },
      comment: { type: String, default: "" },
      createdAt: { type: Date, default: null },
    },
    invoiceAsset: {
      imageUrl: { type: String, default: "" },
      imagePublicId: { type: String, default: "" },
      fileType: { type: String, default: "application/pdf" },
      generatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// 🔍 Indexes
// Rider's active orders - for delivery tracking
orderSchema.index({ tenantId: 1, riderId: 1, orderStatus: 1 });
// User's orders - fetch customer's order history
orderSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
// Filter orders by status with date sorting - admin dashboard
orderSchema.index({ tenantId: 1, orderStatus: 1, createdAt: -1 });
// Unpaid orders - for payment reminders
orderSchema.index({ tenantId: 1, paymentStatus: 1 });
// Pending confirmation orders - fulfillment queue
orderSchema.index({ tenantId: 1, orderStatus: 1, paymentStatus: 1 });
// Recent orders sorted by date - for listing
orderSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
