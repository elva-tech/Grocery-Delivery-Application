const Store = require("../models/Store.model");

/**
 * Runs every 60 seconds.
 * For every store where manualOverride = false and a schedule exists,
 * checks if the store should currently be open or closed and updates if needed.
 */
function startStoreScheduler() {
  console.log("[StoreScheduler] Started – checking store availability every 60s");

  setInterval(async () => {
    try {
      const now    = new Date();
      const stores = await Store.find({ manualOverride: false });

      for (const store of stores) {
        if (!store.schedule?.openTime || !store.schedule?.closeTime) continue;

        const openTime  = new Date(store.schedule.openTime);
        const closeTime = new Date(store.schedule.closeTime);
        const shouldBeOpen = now >= openTime && now < closeTime;

        if (store.isOpen !== shouldBeOpen) {
          await Store.updateOne({ _id: store._id }, { isOpen: shouldBeOpen });
          console.log(
            `[StoreScheduler] ${store.tenantId} → isOpen: ${shouldBeOpen}`
          );
        }
      }
    } catch (err) {
      console.error("[StoreScheduler] Error:", err.message);
    }
  }, 60_000);
}

module.exports = { startStoreScheduler };
