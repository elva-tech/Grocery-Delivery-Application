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
    const now = new Date();
    const stores = await Store.find({ manualOverride: false });

    for (const store of stores) {
      if (!store.schedule?.openTime || !store.schedule?.closeTime) continue;

      let shouldBeOpen;

      // ── OCCASIONAL: store CLOSES during [startDate → endDate] ──────────
      if (store.schedule.type === "DATE") {
        if (!store.schedule.startDate || !store.schedule.endDate) continue;

        const start = new Date(store.schedule.startDate);
        const end   = new Date(store.schedule.endDate);

        if (now > end) {
          // Period over — reopen and clear schedule
          if (!store.isOpen) {
            await Store.updateOne({ _id: store._id }, {
              isOpen: true,
              "schedule.type": "TIME",
              "schedule.startDate": null,
              "schedule.endDate": null,
            });
            console.log(`[StoreScheduler] ${store.tenantId} → occasional ended, reopened`);
          }
          continue;
        }

        shouldBeOpen = !(now >= start && now <= end);

        if (store.isOpen !== shouldBeOpen) {
          await Store.updateOne({ _id: store._id }, { isOpen: shouldBeOpen });
          console.log(`[StoreScheduler] ${store.tenantId} → isOpen: ${shouldBeOpen} (occasional)`);
        }
        continue;
      }

      // ── REGULAR: store OPENS during [openTime → closeTime] daily ───────
      if (store.schedule.type === "TIME") {
        const openTime  = new Date(store.schedule.openTime);
        const closeTime = new Date(store.schedule.closeTime);

        const openToday = new Date(now);
        openToday.setUTCHours(openTime.getUTCHours(), openTime.getUTCMinutes(), 0, 0);

        const closeToday = new Date(now);
        closeToday.setUTCHours(closeTime.getUTCHours(), closeTime.getUTCMinutes(), 0, 0);

        shouldBeOpen = now >= openToday && now < closeToday;

        if (store.isOpen !== shouldBeOpen) {
          await Store.updateOne({ _id: store._id }, { isOpen: shouldBeOpen });
          console.log(`[StoreScheduler] ${store.tenantId} → isOpen: ${shouldBeOpen} (regular)`);
        }
      }
    }
  } catch (err) {
    console.error("[StoreScheduler] Error:", err.message);
  }
}, 60_000);
}

module.exports = { startStoreScheduler };
