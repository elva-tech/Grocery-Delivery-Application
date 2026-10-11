const Order = require("../models/Order.model");
const Coupon = require("../models/Coupon.model");
const { recordOrderBilling } = require("../modules/billing");
const { restoreOrderInventory } = require("../utils/orderInventory.util");
const { emitNewOrder } = require("../socket/orderEvents");

/**
 * Promote a paid online order to PLACED exactly once.
 * Stock was already reserved at checkout. Coupon use, billing, and the admin
 * notification happen only on this transition.
 */
async function placePaidOnlineOrder(order) {
  if (!order?._id || order.paymentMode === "COD") return null;

  const placed = await Order.findOneAndUpdate(
    {
      _id: order._id,
      paymentMode: "ONLINE",
      orderStatus: "AWAITING_PAYMENT",
      paymentStatus: "PAID",
    },
    { $set: { orderStatus: "PLACED" } },
    { new: true }
  );
  if (!placed) return null;

  if (placed.couponCode) {
    await Coupon.findOneAndUpdate(
      { tenantId: placed.tenantId, code: placed.couponCode },
      { $inc: { usedCount: 1 } }
    );
  }

  try {
    await recordOrderBilling(placed.tenantId);
  } catch (err) {
    console.error("Billing tracking error (non-critical):", err.message);
  }

  void emitNewOrder(placed.tenantId, placed);
  return placed;
}

/**
 * Remove an online checkout that was never paid and put the reserved stock back.
 * A paid or already placed order is left unchanged.
 */
async function cancelUnpaidOnlineOrder(orderId) {
  const removed = await Order.findOneAndDelete({
    _id: orderId,
    paymentMode: "ONLINE",
    orderStatus: "AWAITING_PAYMENT",
    paymentStatus: { $nin: ["PAID", "REFUNDED"] },
  });
  if (!removed) return null;

  await restoreOrderInventory(removed, removed.tenantId);
  console.log({
    tenantId: removed.tenantId,
    orderId: removed._id.toString(),
    paymentStatus: "FAILED",
    result: "unpaid_online_order_removed",
  });
  return removed;
}

module.exports = {
  placePaidOnlineOrder,
  cancelUnpaidOnlineOrder,
};
