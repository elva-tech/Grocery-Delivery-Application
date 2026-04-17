const Store = require("../models/Store.model");

/* ─────────────────────────────────────────────
   GET STORE STATUS
───────────────────────────────────────────── */
async function getStoreStatus(tenantId) {
  const store = await Store.findOne({ tenantId });
  if (!store) throw new Error("Store not found");

  let reason = "SCHEDULE";
  let nextChange = null;

  if (store.manualOverride) {
    reason = "MANUAL";
  } else if (store.schedule?.openTime && store.schedule?.closeTime) {
    nextChange = store.isOpen ? store.schedule.closeTime : store.schedule.openTime;
  }

  return {
    isOpen:         store.isOpen,
    reason,
    nextChange:     nextChange ? nextChange.toISOString() : null,
    schedule:       store.schedule,
    manualOverride: store.manualOverride,
  };
}

/* ─────────────────────────────────────────────
   TOGGLE STORE (MANUAL)
───────────────────────────────────────────── */
async function toggleStoreStatus(tenantId, isOpen) {
  const store = await Store.findOneAndUpdate(
    { tenantId },
    {
      isOpen,
      manualOverride: true,
      updatedAt:      new Date(),
    },
    { new: true }
  );
  if (!store) throw new Error("Store not found");
  return store;
}

/* ─────────────────────────────────────────────
   SET SCHEDULE
───────────────────────────────────────────── */
async function setStoreSchedule(tenantId, openTime, closeTime) {
  const store = await Store.findOneAndUpdate(
    { tenantId },
    {
      schedule: {
        openTime:  new Date(openTime),
        closeTime: new Date(closeTime),
      },
      manualOverride: false,
      updatedAt:      new Date(),
    },
    { new: true }
  );
  if (!store) throw new Error("Store not found");
  return store;
}

module.exports = { getStoreStatus, toggleStoreStatus, setStoreSchedule };
