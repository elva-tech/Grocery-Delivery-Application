const Inventory = require("../models/Inventory.model");

/** Restore stock when an order is cancelled (matches place-order decrement). */
async function restoreOrderInventory(order, tenantId) {
  for (const item of order.items || []) {
    if (!item?.productId) continue;
    const filter = { productId: item.productId, tenantId };
    if (item.variantId) {
      filter.variantId = item.variantId;
    } else {
      filter.variantId = null;
    }
    await Inventory.findOneAndUpdate(filter, { $inc: { availableQty: item.qty } });
  }
}

module.exports = { restoreOrderInventory };
