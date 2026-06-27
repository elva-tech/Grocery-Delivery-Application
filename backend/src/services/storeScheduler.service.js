const Store = require("../models/Store.model");
const { shouldStoreBeOpenForSchedule } = require("../utils/storeClosingSoon");

/**
 * Runs every 60 seconds.
 * For every store where manualOverride = false and a schedule exists,
 * checks if the store should currently be open or closed and updates if needed.
 *
 * Daily schedules (Regular Based) repeat open/close clock times each day.
 * Occasion schedules (span > 36h) use absolute start/end datetimes once.
 */
function startStoreScheduler() {
  console.log("[StoreScheduler] Started – checking store availability every 60s");

  const tick = async () => {
    try {
      const now = new Date();
      const stores = await Store.find({ manualOverride: false });

      for (const store of stores) {
        if (!store.schedule?.openTime || !store.schedule?.closeTime) continue;

        const shouldBeOpen = shouldStoreBeOpenForSchedule(store.schedule, now);
        if (shouldBeOpen == null) continue;

        if (store.isOpen !== shouldBeOpen) {
          await Store.updateOne({ _id: store._id }, { isOpen: shouldBeOpen });
          console.log(
            `[StoreScheduler] ${store.tenantId} → isOpen: ${shouldBeOpen}`,
          );
        }
      }
    } catch (err) {
      console.error("[StoreScheduler] Error:", err.message);
    }
  };

  void tick();
  setInterval(tick, 60_000);
}

module.exports = { startStoreScheduler };
