const INVALID_DATE_MESSAGE = 'Please enter a valid date.';

/**
 * Validates YYYY-MM-DD or DD-MM-YYYY calendar dates.
 */
function isValidCalendarDate(value) {
  if (!value || typeof value !== 'string') return false;

  const trimmed = value.trim();
  let year;
  let month;
  let day;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
    if (!dmy) return false;
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  }

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function parseCalendarDate(value) {
  if (!isValidCalendarDate(value)) return null;

  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    return new Date(year, month - 1, day);
  }

  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const year = Number(dmy[3]);
  return new Date(year, month - 1, day);
}

module.exports = {
  INVALID_DATE_MESSAGE,
  isValidCalendarDate,
  parseCalendarDate,
};
