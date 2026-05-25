/** Mirrors backend/src/utils/orderRevenue.js for client-side reports. */

const DELIVERED_REVENUE_STATUSES = [
  'DELIVERED',
  'ISSUE_REPORTED',
  'REFUND_REJECTED',
  'REFUND_APPROVED',
];

export function orderCountsAsDelivered(order) {
  const status = String(order?.status || order?.orderStatus || '').toUpperCase();
  return DELIVERED_REVENUE_STATUSES.includes(status);
}

export function getOrderNetRevenue(order) {
  if (!orderCountsAsDelivered(order)) return 0;

  const total = Number(order.totalAmount ?? order.total) || 0;
  const status = String(order?.status || order?.orderStatus || '').toUpperCase();
  const paymentStatus = String(order?.paymentStatus || '').toUpperCase();
  const refundStatus = String(order?.refundStatus || '').toUpperCase();

  const isRefunded =
    status === 'REFUND_APPROVED' ||
    paymentStatus === 'REFUNDED' ||
    refundStatus === 'FULL' ||
    refundStatus === 'PARTIAL';

  if (!isRefunded) return Math.round(total * 100) / 100;

  const refundAmt = Number(order.refundAmount);
  if (Number.isFinite(refundAmt) && refundAmt >= 0) {
    return Math.max(0, Math.round((total - refundAmt) * 100) / 100);
  }

  if (refundStatus === 'FULL' || paymentStatus === 'REFUNDED') return 0;
  return Math.round(total * 100) / 100;
}
