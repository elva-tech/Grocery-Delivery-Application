const Order = require("../models/Order.model");
const { getIO } = require("./index");
const { tenantRoom } = require("./rooms");

const USER_POPULATE = "name email phoneNumber";

/** Fetch a lean, populated order payload suitable for admin clients. */
async function fetchOrderPayload(orderOrId) {
  const id = orderOrId?._id || orderOrId;
  if (!id) return null;

  return Order.findById(id).populate("userId", USER_POPULATE).lean();
}

/**
 * Emit new-order to every admin socket in the tenant room.
 * Never broadcasts globally — always scoped to tenant_${tenantId}.
 */
async function emitNewOrder(tenantId, orderOrId) {
  const io = getIO();
  if (!io || !tenantId) return;

  const order =
    orderOrId?.items && orderOrId?.tenantId
      ? await fetchOrderPayload(orderOrId._id || orderOrId)
      : await fetchOrderPayload(orderOrId);

  if (!order) return;

  io.to(tenantRoom(tenantId)).emit("new-order", order);
}

/**
 * Emit order-updated when status or assignment changes.
 */
async function emitOrderUpdated(tenantId, orderOrId) {
  const io = getIO();
  if (!io || !tenantId) return;

  const order = await fetchOrderPayload(orderOrId?._id || orderOrId);
  if (!order) return;

  io.to(tenantRoom(tenantId)).emit("order-updated", order);
}

module.exports = {
  emitNewOrder,
  emitOrderUpdated,
};
