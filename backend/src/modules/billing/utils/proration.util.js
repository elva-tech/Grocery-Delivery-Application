const { billingPeriod, calendarPartsInTz, daysInCalendarMonth } = require("./cycleDates.util");

/**
 * Prorate monthly subscription fee for partial month enrollment (IST calendar month).
 * @param {number} monthlyPrice
 * @param {Date} enrollmentDate - when the customer joins / pays prepaid (usually today)
 * @returns {number}
 */
function calculateProratedAmount(monthlyPrice, enrollmentDate = new Date()) {
  const price = Number(monthlyPrice) || 0;
  if (price <= 0) return 0;

  const enroll = calendarPartsInTz(enrollmentDate);
  const period = billingPeriod(enrollmentDate);
  const endParts = calendarPartsInTz(period.billing_end_date);
  const totalDays = daysInCalendarMonth(enroll.year, enroll.month);
  const remainingDays = Math.max(0, endParts.day - enroll.day + 1);

  if (remainingDays <= 0 || remainingDays >= totalDays) {
    return Math.round(price * 100) / 100;
  }

  const prorated = (price / totalDays) * remainingDays;
  return Math.round(prorated * 100) / 100;
}

module.exports = { calculateProratedAmount };
