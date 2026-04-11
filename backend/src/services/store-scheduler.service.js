const Store = require("../models/Store.model");

/**
 * ⏰ Store Status Scheduler
 * Runs every minute and automatically updates store isOpen status based on schedule
 * Only applies to stores where manualOverride = false
 */
const isStoreOpen = (now, openTime, closeTime) => {
  if (!openTime || !closeTime) return false;

  if (openTime <= closeTime) {
    return now >= openTime && now < closeTime;
  }

  // Cross-midnight schedule
  return now >= openTime || now < closeTime;
};

const startStoreScheduler = () => {
  const scheduler = setInterval(async () => {
    try {
      const now = new Date();

      // Find all stores that are NOT on manual override
      const stores = await Store.find({ manualOverride: false });

      for (const store of stores) {
        // Skip stores without schedule
        if (!store.schedule || !store.schedule.openTime || !store.schedule.closeTime) {
          continue;
        }

        const { openTime, closeTime } = store.schedule;

        // Determine if store should be open
        const shouldBeOpen = isStoreOpen(now, openTime, closeTime);

        // Update only if status needs to change
        if (store.isOpen !== shouldBeOpen) {
          await Store.updateOne(
            { _id: store._id },
            { 
              isOpen: shouldBeOpen,
              updatedAt: new Date(),
            }
          );

          console.log(
            `✅ Store ${store._id} status updated to ${shouldBeOpen ? 'OPEN' : 'CLOSED'}`
          );
        }
      }
    } catch (error) {
      console.error("❌ Store Scheduler Error:", error);
    }
  }, 60000); // Run every 1 minute

  console.log("🕐 Store Status Scheduler started (runs every 1 minute)");

  return scheduler;
};

module.exports = { startStoreScheduler };
