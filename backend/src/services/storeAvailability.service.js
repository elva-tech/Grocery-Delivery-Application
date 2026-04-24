const Store  = require("../models/Store.model");
const Tenant = require("../models/Tenant.model");

/* ─────────────────────────────────────────────
   GET STORE STATUS
───────────────────────────────────────────── */
async function getStoreStatus(tenantId) {
  const store = await Store.findOne({ tenantId });
  if (!store) throw new Error("Store not found");

//     console.log("STORE STATUS RESPONSE:", {
//   isOpen: store.isOpen,
//   schedule: store.schedule,
//   startTime: store.schedule?.openTime,
//   endTime: store.schedule?.closeTime,
//   type: store.schedule?.type,
// });

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
    };
  }

  let reason = "";
  let nextChange = null;

  if (store.manualOverride) {
    reason = "Store is manually closed";
  }
  else if (store.schedule?.openTime && store.schedule?.closeTime) {
    reason = store.isOpen
      ? "Store is currently open"
      : "Store is closed.";

    if (store.schedule.type === "TIME") {
      const now = new Date();
      const openTime  = new Date(store.schedule.openTime);
      const closeTime = new Date(store.schedule.closeTime);

      const openToday = new Date(now);
      openToday.setUTCHours(openTime.getUTCHours(), openTime.getUTCMinutes(), 0, 0);

      const closeToday = new Date(now);
      closeToday.setUTCHours(closeTime.getUTCHours(), closeTime.getUTCMinutes(), 0, 0);

      nextChange = store.isOpen ? closeToday : openToday;
    } else {
      nextChange = store.isOpen
        ? store.schedule.closeTime
        : store.schedule.openTime;
    }
  }

  const scheduleType = store.schedule?.type ?? "TIME";

  const isTimeSchedule = scheduleType === "TIME" && !store.manualOverride;
  const isDateSchedule = scheduleType === "DATE" && !store.manualOverride;

  return {
    isOpen: store.isOpen,
    reason: store.manualOverride
      ? (store.isOpen ? "Store is manually open" : "Store is manually closed")
      : store.schedule?.reason || (store.isOpen ? "Store is currently open" : "Store is closed."),
    nextChange: nextChange ? nextChange.toISOString() : null,

    // Only expose TIME fields when it's an active TIME schedule
    startTime: isTimeSchedule ? (store.schedule?.openTime ?? null) : null,
    endTime:   isTimeSchedule ? (store.schedule?.closeTime ?? null) : null,

    // Only expose DATE fields when it's an active DATE schedule
    startDate: isDateSchedule ? (store.schedule?.startDate ?? null) : null,
    endDate:   isDateSchedule ? (store.schedule?.endDate ?? null) : null,

    type: scheduleType,
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
async function setStoreSchedule(tenantId, openTime, closeTime, type = "TIME", reason = "", startDate = null, endDate = null) {
  const schedulePayload = {
    openTime:  new Date(openTime),
    closeTime: new Date(closeTime),
    type,
    reason: reason || "",
  };

  if (type === "DATE" && startDate && endDate) {
    schedulePayload.startDate = new Date(startDate);
    schedulePayload.endDate   = new Date(endDate);
  }

  // Immediately calculate if store should be open right now
  const now = new Date();
  let immediateIsOpen = true;

  if (type === "DATE" && startDate && endDate) {
    const start = new Date(startDate);
    const end   = new Date(endDate);
    immediateIsOpen = !(now >= start && now <= end);
  } else {
    const open  = new Date(openTime);
    const close = new Date(closeTime);
    const openToday = new Date(now);
    openToday.setUTCHours(open.getUTCHours(), open.getUTCMinutes(), 0, 0);
    const closeToday = new Date(now);
    closeToday.setUTCHours(close.getUTCHours(), close.getUTCMinutes(), 0, 0);
    immediateIsOpen = now >= openToday && now < closeToday;
  }

  const store = await Store.findOneAndUpdate(
    { tenantId },
    {
      schedule:       schedulePayload,
      manualOverride: false,
      isOpen:         immediateIsOpen,
      updatedAt:      new Date(),
    },
    { new: true }
  );
  if (!store) throw new Error("Store not found");
  return store;
}

module.exports = { getStoreStatus, toggleStoreStatus, setStoreSchedule }