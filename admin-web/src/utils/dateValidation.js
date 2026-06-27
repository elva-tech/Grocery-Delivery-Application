export const INVALID_DATE_MESSAGE = 'Please enter a valid date.';

/**
 * Validates YYYY-MM-DD (HTML date input) or DD-MM-YYYY strings.
 * Rejects impossible dates such as 31-02-2026 / 2026-02-31.
 */
export function isValidCalendarDate(value) {
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

export function getDateInputValidationError(value, inputEl) {
  if (inputEl?.validity?.badInput) return INVALID_DATE_MESSAGE;
  if (!value) return '';
  return isValidCalendarDate(value) ? '' : INVALID_DATE_MESSAGE;
}
