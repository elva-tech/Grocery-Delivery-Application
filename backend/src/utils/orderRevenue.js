/**
 * Net revenue = delivered (or post-delivery) orders minus refunds.
 * Excludes PLACED / CONFIRMED / OUT_FOR_DELIVERY / CANCELLED.
 */

const DELIVERED_REVENUE_STATUSES = [
  "DELIVERED",
  "ISSUE_REPORTED",
  "REFUND_REJECTED",
  "REFUND_APPROVED",
];

function orderCountsAsDelivered(order) {
  return DELIVERED_REVENUE_STATUSES.includes(order?.orderStatus);
}

function getOrderNetRevenue(order) {
  if (!orderCountsAsDelivered(order)) return 0;

  const total = Number(order.totalAmount) || 0;
  const isRefunded =
    order.orderStatus === "REFUND_APPROVED" ||
    order.paymentStatus === "REFUNDED" ||
    order.refundStatus === "FULL" ||
    order.refundStatus === "PARTIAL";

  if (!isRefunded) return Math.round(total * 100) / 100;

  const refundAmt = Number(order.refundAmount);
  if (Number.isFinite(refundAmt) && refundAmt >= 0) {
    return Math.max(0, Math.round((total - refundAmt) * 100) / 100);
  }

  if (order.refundStatus === "FULL" || order.paymentStatus === "REFUNDED") {
    return 0;
  }

  return Math.round(total * 100) / 100;
}

function revenueMatchFilter(tenantId, extraMatch = {}) {
  return {
    tenantId,
    orderStatus: { $in: DELIVERED_REVENUE_STATUSES },
    ...extraMatch,
  };
}

/** MongoDB $addFields stage for aggregation pipelines */
const netRevenueAddFieldsStage = {
  $addFields: {
    netRevenue: {
      $max: [
        0,
        {
          $subtract: [
            { $ifNull: ["$totalAmount", 0] },
            {
              $cond: [
                {
                  $or: [
                    { $eq: ["$orderStatus", "REFUND_APPROVED"] },
                    { $eq: ["$paymentStatus", "REFUNDED"] },
                    { $in: ["$refundStatus", ["FULL", "PARTIAL"]] },
                  ],
                },
                { $ifNull: ["$refundAmount", "$totalAmount"] },
                0,
              ],
            },
          ],
        },
      ],
    },
  },
};

module.exports = {
  DELIVERED_REVENUE_STATUSES,
  orderCountsAsDelivered,
  getOrderNetRevenue,
  revenueMatchFilter,
  netRevenueAddFieldsStage,
};
