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

    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        qty: Number,
        price: Number,
      },
    ],

    totalAmount: {
      type: Number,
      required: true,
    },

    paymentMode: {
      type: String,
      enum: ["COD", "ONLINE"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
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
      line1: String,
      lat: Number,
      lng: Number,
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
