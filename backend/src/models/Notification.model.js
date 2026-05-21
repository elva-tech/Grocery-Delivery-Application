const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
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

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    status: {
      type: String,
    },

    message: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      default: "ORDER_STATUS",
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// 🔍 Indexes
// User's notifications sorted by date - fetch notification list
notificationSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
// Unread notifications for user - for badge count
notificationSchema.index({ tenantId: 1, userId: 1, isRead: 1 });
// Notifications by order - fetch order-related notifications
notificationSchema.index({ tenantId: 1, orderId: 1 });
// Filter by type with date sorting - notification categories
notificationSchema.index({ tenantId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
