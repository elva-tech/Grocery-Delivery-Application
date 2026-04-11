const Store = require("../models/Store.model");

const getTenantIdFromRequest = (req) => {
  if (req.user && req.user.tenantId) return req.user.tenantId;
  return req.headers["x-tenant-id"] || "default";
};

const isScheduleOpen = (now, schedule) => {
  if (!schedule || !schedule.openTime || !schedule.closeTime) return false;

  const openTime = new Date(schedule.openTime);
  const closeTime = new Date(schedule.closeTime);

  if (isNaN(openTime.getTime()) || isNaN(closeTime.getTime())) return false;

  if (openTime <= closeTime) {
    return now >= openTime && now < closeTime;
  }

  // Cross-midnight schedule (e.g. 10pm -> 6am)
  return now >= openTime || now < closeTime;
};

const getNextScheduleChange = (now, schedule) => {
  if (!schedule || !schedule.openTime || !schedule.closeTime) return null;

  const openTime = new Date(schedule.openTime);
  const closeTime = new Date(schedule.closeTime);

  if (isNaN(openTime.getTime()) || isNaN(closeTime.getTime())) return null;

  if (openTime <= closeTime) {
    if (now < openTime) return openTime;
    if (now < closeTime) return closeTime;
    return null;
  }

  // Cross-midnight schedule
  if (now < closeTime) return closeTime;
  if (now < openTime) return openTime;
  return closeTime;
};

/* ================= TOGGLE STORE STATUS (MANUAL) ================= */
const toggleStoreStatus = async (req, res) => {
  try {
    const { isOpen } = req.body;
    const tenantId = req.user.tenantId;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    if (typeof isOpen !== "boolean") {
      return res.status(400).json({ message: "isOpen must be a boolean" });
    }

    // Find and update store
    const store = await Store.findOneAndUpdate(
      { tenantId },
      {
        isOpen,
        manualOverride: true,
        updatedAt: new Date(),
      },
      { new: true, upsert: false }
    );

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    return res.status(200).json({
      message: "Store status updated successfully",
      store,
    });
  } catch (error) {
    console.error("Toggle Store Status Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const parseLocalDateString = (value, offsetMinutes = 0) => {
  if (!value || typeof value !== 'string') return null;

  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return null;

  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second = '0'] = timePart.split(':');
  const [sec, ms = '0'] = second.split('.');
  const [secondNum, msNum] = [Number(sec), Number(ms) || 0];

  if ([year, month, day, hour, minute, secondNum].some((n) => Number.isNaN(n))) {
    return null;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day, Number(hour), Number(minute), secondNum, msNum));
  return new Date(utcDate.getTime() - offsetMinutes * 60000);
};

/* ================= SCHEDULE STORE ================= */
const scheduleStore = async (req, res) => {
  try {
    const { openTime, closeTime, timezone = 'IST' } = req.body;
    const tenantId = req.user.tenantId;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    // Validate required fields
    if (!openTime || !closeTime) {
      return res.status(400).json({ message: "openTime and closeTime are required" });
    }

    let offsetMinutes = 0;
    if (timezone === 'IST') offsetMinutes = 5 * 60 + 30;

    const openDate = parseLocalDateString(openTime, offsetMinutes);
    const closeDate = parseLocalDateString(closeTime, offsetMinutes);

    // Validate dates
    if (isNaN(openDate.getTime()) || isNaN(closeDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format for openTime or closeTime" });
    }

    const now = new Date();

    const openingNow = isScheduleOpen(now, { openTime: openDate, closeTime: closeDate });

    // Find and update store
    const store = await Store.findOneAndUpdate(
      { tenantId },
      {
        schedule: {
          openTime: openDate,
          closeTime: closeDate,
        },
        manualOverride: false,
        isOpen: openingNow,
        updatedAt: new Date(),
      },
      { new: true, upsert: false }
    );

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    return res.status(200).json({
      message: "Store schedule updated successfully",
      store,
    });
  } catch (error) {
    console.error("Schedule Store Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ================= GET STORE STATUS ================= */
const getStoreStatus = async (req, res) => {
  try {
    const tenantId = getTenantIdFromRequest(req);

    let store = await Store.findOne({ tenantId });

    if (!store) {
      store = await Store.create({
        tenantId,
        name: `Store ${tenantId || "default"}`,
        isOpen: true,
        manualOverride: false,
        schedule: {
          openTime: null,
          closeTime: null,
        },
      });
    }

    const now = new Date();
    let reason = "DEFAULT";
    let nextChange = null;
    let currentOpen = store.isOpen;

    if (store.manualOverride) {
      reason = "MANUAL";
      nextChange = null;
    } else if (store.schedule && store.schedule.openTime && store.schedule.closeTime) {
      reason = "SCHEDULED";
      currentOpen = isScheduleOpen(now, store.schedule);
      nextChange = getNextScheduleChange(now, store.schedule);

      if (store.isOpen !== currentOpen) {
        await Store.updateOne(
          { _id: store._id },
          { isOpen: currentOpen, updatedAt: new Date() }
        );
      }
    }

    if (!req.user) {
      return res.status(200).json({
        isOpen: currentOpen,
      });
    }

    return res.status(200).json({
      isOpen: currentOpen,
      reason,
      nextChange,
      store,
    });
  } catch (error) {
    console.error("Get Store Status Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  toggleStoreStatus,
  scheduleStore,
  getStoreStatus,
};
