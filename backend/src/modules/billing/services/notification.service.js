const Notification = require("../../../models/Notification.model");
const User = require("../../../models/User.model");

const BILLING_TYPES = {
  DUE_SOON_3: "BILLING_DUE_3_DAYS",
  DUE_SOON_1: "BILLING_DUE_1_DAY",
  OVERDUE: "BILLING_OVERDUE",
  SUSPENSION_WARNING: "BILLING_SUSPENSION_WARNING",
  SUSPENDED: "BILLING_SUSPENDED",
};

async function getTenantAdminUserIds(tenantId) {
  const admins = await User.find({ tenantId, role: "ADMIN", isActive: true })
    .select("_id")
    .lean();
  return admins.map((a) => a._id);
}

async function createBillingNotification(tenantId, message, type) {
  const userIds = await getTenantAdminUserIds(tenantId);
  if (!userIds.length) return [];

  const docs = userIds.map((userId) => ({
    tenantId,
    userId,
    orderId: null,
    message,
    type,
    isRead: false,
  }));

  return Notification.insertMany(docs);
}

async function notifyDueSoon(tenantId, invoice, daysLeft) {
  const type = daysLeft === 3 ? BILLING_TYPES.DUE_SOON_3 : BILLING_TYPES.DUE_SOON_1;
  const due = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString("en-IN")
    : "soon";
  const msg =
    daysLeft === 3
      ? `Your invoice ${invoice.invoice_number} is due in 3 days (${due}).`
      : `Your invoice ${invoice.invoice_number} is due tomorrow (${due}).`;
  return createBillingNotification(tenantId, msg, type);
}

async function notifyOverdue(tenantId, invoice) {
  return createBillingNotification(
    tenantId,
    `Payment overdue for invoice ${invoice.invoice_number}. Please pay to avoid account suspension.`,
    BILLING_TYPES.OVERDUE
  );
}

async function notifySuspensionWarning(tenantId) {
  return createBillingNotification(
    tenantId,
    "Your account will be suspended if payment is not received.",
    BILLING_TYPES.SUSPENSION_WARNING
  );
}

async function notifySuspended(tenantId) {
  return createBillingNotification(
    tenantId,
    "Your account has been suspended due to unpaid billing. Contact support to restore access.",
    BILLING_TYPES.SUSPENDED
  );
}

module.exports = {
  BILLING_TYPES,
  createBillingNotification,
  notifyDueSoon,
  notifyOverdue,
  notifySuspensionWarning,
  notifySuspended,
};
