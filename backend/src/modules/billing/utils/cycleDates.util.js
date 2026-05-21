const BILLING_TZ = "Asia/Kolkata";

function calendarPartsInTz(date = new Date(), timeZone = BILLING_TZ) {
  const parts = { year: 0, month: 0, day: 0 };
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
    .formatToParts(date)
    .forEach((p) => {
      if (p.type === "year") parts.year = Number(p.value);
      if (p.type === "month") parts.month = Number(p.value);
      if (p.type === "day") parts.day = Number(p.value);
    });
  return parts;
}

function dateAtIST(y, month1to12, day, h = 0, min = 0, sec = 0, ms = 0) {
  const iso = `${y}-${String(month1to12).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(3, "0")}+05:30`;
  return new Date(iso);
}

function daysInCalendarMonth(year, month1to12) {
  return new Date(year, month1to12, 0).getDate();
}

/** @param {number} monthIndex 0-based month (Date#getMonth) */
function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function startOfMonth(date = new Date()) {
  const { year, month } = calendarPartsInTz(date);
  return dateAtIST(year, month, 1, 0, 0, 0, 0);
}

function endOfMonth(date = new Date()) {
  const { year, month } = calendarPartsInTz(date);
  const lastDay = daysInCalendarMonth(year, month);
  return dateAtIST(year, month, lastDay, 23, 59, 59, 999);
}

function lastDayOfMonth(date = new Date()) {
  return endOfMonth(date);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function billingPeriod(date = new Date()) {
  const { year, month } = calendarPartsInTz(date);
  const billing_start_date = dateAtIST(year, month, 1, 0, 0, 0, 0);
  const lastDay = daysInCalendarMonth(year, month);
  const billing_end_date = dateAtIST(year, month, lastDay, 23, 59, 59, 999);
  const next_billing_date = addDays(billing_end_date, 1);
  next_billing_date.setHours(0, 0, 0, 0);

  return {
    billing_month: month,
    billing_year: year,
    billing_start_date,
    billing_end_date,
    next_billing_date,
  };
}

function isLastDayOfMonth(date = new Date()) {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const today = calendarPartsInTz(date);
  const next = calendarPartsInTz(tomorrow);
  return today.month !== next.month || today.year !== next.year;
}

module.exports = {
  BILLING_TZ,
  calendarPartsInTz,
  daysInMonth,
  daysInCalendarMonth,
  startOfMonth,
  endOfMonth,
  lastDayOfMonth,
  addDays,
  billingPeriod,
  isLastDayOfMonth,
};
