/** Warn customers this many minutes before scheduled close (production default). */
const CLOSING_SOON_THRESHOLD_MS = 10 * 60 * 1000;

/** Campaign schedules longer than this use absolute end datetime, not daily hours. */
const MULTI_DAY_SCHEDULE_MS = 36 * 60 * 60 * 1000;

function storeTimeZone() {
  return process.env.STORE_TIMEZONE || process.env.TZ || "Asia/Kolkata";
}

function zonedParts(date, timeZone, includeDate = true) {
  const options = {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  if (includeDate) {
    options.year = "numeric";
    options.month = "2-digit";
    options.day = "2-digit";
  }
  const parts = new Intl.DateTimeFormat("en-GB", options).formatToParts(date);
  const pick = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: includeDate ? pick("year") : 0,
    month: includeDate ? pick("month") : 0,
    day: includeDate ? pick("day") : 0,
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

/** UTC instant for a wall-clock time on a calendar day in the store timezone. */
function zonedDateTimeToUtc(year, month, day, hour, minute, timeZone) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 5; i += 1) {
    const z = zonedParts(new Date(utc), timeZone, true);
    if (
      z.year === year &&
      z.month === month &&
      z.day === day &&
      z.hour === hour &&
      z.minute === minute
    ) {
      return new Date(utc);
    }
    const targetMin = hour * 60 + minute;
    const actualMin = z.hour * 60 + z.minute;
    const dayShift = day - z.day;
    utc += (dayShift * 24 * 60 + (targetMin - actualMin)) * 60 * 1000;
  }
  return new Date(utc);
}

function hasValidSchedule(schedule) {
  if (!schedule?.openTime || !schedule?.closeTime) return false;
  const open = new Date(schedule.openTime);
  const close = new Date(schedule.closeTime);
  return Number.isFinite(open.getTime()) && Number.isFinite(close.getTime());
}

/**
 * Daily hours: apply open/close clock times to "today" in the store timezone.
 * Handles overnight windows (e.g. 22:00 → 02:00 next day).
 */
function buildTodayServiceWindow(openTime, closeTime, referenceNow = new Date()) {
  const tz = storeTimeZone();
  const now = new Date(referenceNow);
  const today = zonedParts(now, tz, true);
  const openHm = zonedParts(new Date(openTime), tz, false);
  const closeHm = zonedParts(new Date(closeTime), tz, false);

  const todayOpen = zonedDateTimeToUtc(
    today.year,
    today.month,
    today.day,
    openHm.hour,
    openHm.minute,
    tz,
  );

  let closeDay = today.day;
  let closeMonth = today.month;
  let closeYear = today.year;
  if (
    closeHm.hour < openHm.hour ||
    (closeHm.hour === openHm.hour && closeHm.minute <= openHm.minute)
  ) {
    const next = new Date(todayOpen.getTime() + 24 * 60 * 60 * 1000);
    const nextParts = zonedParts(next, tz, true);
    closeYear = nextParts.year;
    closeMonth = nextParts.month;
    closeDay = nextParts.day;
  }

  const todayClose = zonedDateTimeToUtc(
    closeYear,
    closeMonth,
    closeDay,
    closeHm.hour,
    closeHm.minute,
    tz,
  );

  return { todayOpen, todayClose };
}

/**
 * @param {{ isOpen: boolean, manualOverride?: boolean, schedule?: { openTime?: Date|string, closeTime?: Date|string } }} input
 * @param {Date} [now]
 */
function resolveEffectiveScheduleWindow(schedule, now = new Date()) {
  if (!hasValidSchedule(schedule)) return null;

  const openRef = new Date(schedule.openTime);
  const closeRef = new Date(schedule.closeTime);
  const spanMs = closeRef.getTime() - openRef.getTime();
  const useAbsoluteWindow = spanMs > MULTI_DAY_SCHEDULE_MS;

  if (useAbsoluteWindow) {
    return {
      effectiveOpen: openRef,
      effectiveClose: closeRef,
      mode: "absolute",
    };
  }

  const window = buildTodayServiceWindow(schedule.openTime, schedule.closeTime, now);
  return {
    effectiveOpen: window.todayOpen,
    effectiveClose: window.todayClose,
    mode: "daily",
  };
}

/** Whether the store should be open right now for this schedule (ignores manualOverride). */
function shouldStoreBeOpenForSchedule(schedule, now = new Date()) {
  const window = resolveEffectiveScheduleWindow(schedule, now);
  if (!window) return null;

  const nowMs = now.getTime();
  return (
    nowMs >= window.effectiveOpen.getTime() && nowMs < window.effectiveClose.getTime()
  );
}

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

  const resolved = resolveEffectiveScheduleWindow(schedule, now);
  if (!resolved) {
    return {
      closingSoon: false,
      hasScheduledHours: false,
      minutesUntilClose: null,
      closesAt: null,
    };
  }

  const { effectiveOpen, effectiveClose } = resolved;

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
  buildTodayServiceWindow,
  getClosingSoonInfo,
  hasValidSchedule,
  resolveEffectiveScheduleWindow,
  shouldStoreBeOpenForSchedule,
  storeTimeZone,
};
