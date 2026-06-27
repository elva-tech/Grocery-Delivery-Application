const Store  = require("../models/Store.model");
const Tenant = require("../models/Tenant.model");
const {
  getClosingSoonInfo,
  resolveEffectiveScheduleWindow,
  shouldStoreBeOpenForSchedule,
} = require("../utils/storeClosingSoon");

/* ─────────────────────────────────────────────
   GET STORE STATUS
───────────────────────────────────────────── */
async function getStoreStatus(tenantId) {
  const store = await Store.findOne({ tenantId });
  if (!store) throw new Error("Store not found");

  const now = new Date();

  // If tenant account is suspended, show as closed regardless of schedule
  const tenant = await Tenant.findOne({ tenantId }).select("status").lean();
  if (tenant && tenant.status === "SUSPENDED") {
    return {
      isOpen:         false,
      reason:         "This store is currently unavailable. Please try again later.",
      nextChange:     null,
      schedule:       store.schedule,
      manualOverride: store.manualOverride,
      suspended:      true,
      closingSoon:    false,
      hasScheduledHours: false,
      minutesUntilClose: null,
      closesAt:       null,
    };
  }

  let isOpen = store.isOpen;
  let reason = "We are currently not accepting orders.";
  let nextChange = null;
  const hasSchedule = Boolean(store.schedule?.openTime && store.schedule?.closeTime);

  if (store.manualOverride) {
    isOpen = store.isOpen;
    reason = isOpen
      ? ""
      : "This store is temporarily closed.";
  } else if (hasSchedule) {
    const shouldBeOpen = shouldStoreBeOpenForSchedule(store.schedule, now);
    if (shouldBeOpen != null) {
      isOpen = shouldBeOpen;
      if (store.isOpen !== shouldBeOpen) {
        await Store.updateOne({ _id: store._id }, { isOpen: shouldBeOpen });
      }
    }
    const window = resolveEffectiveScheduleWindow(store.schedule, now);
    if (window) {
      nextChange = isOpen ? window.effectiveClose : window.effectiveOpen;
    }
    reason = isOpen
      ? ""
      : "We are currently closed based on our store hours.";
  } else {
    isOpen = store.isOpen;
  }

  const closing = getClosingSoonInfo({
    isOpen,
    manualOverride: store.manualOverride,
    schedule: store.schedule,
  }, now);

  return {
    isOpen,
    reason,
    nextChange:     nextChange ? nextChange.toISOString() : null,
    schedule:       store.schedule,
    manualOverride: store.manualOverride,
    closingSoon:    closing.closingSoon,
    hasScheduledHours: closing.hasScheduledHours,
    minutesUntilClose: closing.minutesUntilClose,
    closesAt:       closing.closesAt,
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
  const schedule = {
    openTime: new Date(openTime),
    closeTime: new Date(closeTime),
  };
  const shouldBeOpen = shouldStoreBeOpenForSchedule(schedule, new Date());

  const store = await Store.findOneAndUpdate(
    { tenantId },
    {
      schedule,
      manualOverride: false,
      ...(shouldBeOpen == null ? {} : { isOpen: shouldBeOpen }),
      updatedAt: new Date(),
    },
    { new: true },
  );
  if (!store) throw new Error("Store not found");
  return store;
}

module.exports = { getStoreStatus, toggleStoreStatus, setStoreSchedule };
