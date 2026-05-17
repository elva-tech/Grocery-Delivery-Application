/** Warn customers this many minutes before scheduled close (production default). */
const CLOSING_SOON_THRESHOLD_MS = 10 * 60 * 1000;

/** Campaign schedules longer than this use absolute end datetime, not daily hours. */
const MULTI_DAY_SCHEDULE_MS = 36 * 60 * 60 * 1000;

function hasValidSchedule(schedule) {
  if (!schedule?.openTime || !schedule?.closeTime) return false;
  const open = new Date(schedule.openTime);
  const close = new Date(schedule.closeTime);
  return Number.isFinite(open.getTime()) && Number.isFinite(close.getTime());
}

/**
 * Daily hours: apply open/close clock times to "today" (server local).
 * Handles overnight windows (e.g. 22:00 → 02:00 next day).
 */
function buildTodayServiceWindow(openTime, closeTime, referenceNow = new Date()) {
  const openRef = new Date(openTime);
  const closeRef = new Date(closeTime);
  const now = new Date(referenceNow);

  const todayOpen = new Date(now);
  todayOpen.setHours(openRef.getHours(), openRef.getMinutes(), openRef.getSeconds(), 0);

  const todayClose = new Date(now);
  todayClose.setHours(closeRef.getHours(), closeRef.getMinutes(), closeRef.getSeconds(), 0);

  if (todayClose.getTime() <= todayOpen.getTime()) {
    todayClose.setDate(todayClose.getDate() + 1);
  }

  return { todayOpen, todayClose };
}

/**
 * @param {{ isOpen: boolean, manualOverride?: boolean, schedule?: { openTime?: Date|string, closeTime?: Date|string } }} input
 * @param {Date} [now]
 */
function getClosingSoonInfo(input, now = new Date()) {
  const { isOpen, manualOverride, schedule } = input;
  const hasScheduledHours = hasValidSchedule(schedule);

  if (!hasScheduledHours || manualOverride || !isOpen) {
    return {
      closingSoon: false,
      hasScheduledHours,
      minutesUntilClose: null,
      closesAt: null,
    };
  }

  const openRef = new Date(schedule.openTime);
  const closeRef = new Date(schedule.closeTime);
  const spanMs = closeRef.getTime() - openRef.getTime();
  const useAbsoluteEnd = spanMs > MULTI_DAY_SCHEDULE_MS;

  let effectiveClose;
  let effectiveOpen;

  if (useAbsoluteEnd) {
    effectiveOpen = openRef;
    effectiveClose = closeRef;
  } else {
    const window = buildTodayServiceWindow(schedule.openTime, schedule.closeTime, now);
    effectiveOpen = window.todayOpen;
    effectiveClose = window.todayClose;
  }

  const nowMs = now.getTime();
  const msUntilClose = effectiveClose.getTime() - nowMs;

  if (nowMs < effectiveOpen.getTime() || msUntilClose <= 0) {
    return {
      closingSoon: false,
      hasScheduledHours: true,
      minutesUntilClose: 0,
      closesAt: effectiveClose.toISOString(),
    };
  }

  const minutesUntilClose = Math.max(1, Math.ceil(msUntilClose / 60000));

  if (msUntilClose > CLOSING_SOON_THRESHOLD_MS) {
    return {
      closingSoon: false,
      hasScheduledHours: true,
      minutesUntilClose,
      closesAt: effectiveClose.toISOString(),
    };
  }

  return {
    closingSoon: true,
    hasScheduledHours: true,
    minutesUntilClose,
    closesAt: effectiveClose.toISOString(),
  };
}

module.exports = {
  CLOSING_SOON_THRESHOLD_MS,
  getClosingSoonInfo,
  hasValidSchedule,
};
