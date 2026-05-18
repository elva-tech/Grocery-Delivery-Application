const Inventory = require("../models/Inventory.model");

/** Restore stock when an order is cancelled (matches place-order decrement). */
async function restoreOrderInventory(order, tenantId) {
  for (const item of order.items || []) {
    if (!item?.productId) continue;
    await Inventory.findOneAndUpdate(
      { productId: item.productId, tenantId },
      { $inc: { availableQty: item.qty } },
    );
  }
}

module.exports = { restoreOrderInventory };
