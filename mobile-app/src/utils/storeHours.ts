const TIME_12H: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Customer-facing clock time always in 12-hour form (e.g. 9:00 PM, not 21:00). */
export function formatStoreCloseTime(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', TIME_12H).format(new Date(iso));
  } catch {
    return '';
  }
}

/** Time, or short date + time when the change is on a different calendar day. */
export function formatStoreNextChange(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const target = new Date(iso);
    const time = new Intl.DateTimeFormat('en-IN', TIME_12H).format(target);
    if (isSameLocalDay(target, new Date())) return time;
    const date = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(target);
    return `${date}, ${time}`;
  } catch {
    return '';
  }
}

export function storeNextChangeMessage(
  iso: string | null | undefined,
  storeIsClosed: boolean,
): string {
  const when = formatStoreNextChange(iso);
  if (!when) return '';
  return storeIsClosed ? `Opens at ${when}` : `Closes at ${when}`;
}

export function storeClosingSoonMessage(
  minutes: number,
  closesAt?: string | null,
  copy?: { closingInMinutes: (m: number) => string; closingAt: (time: string) => string },
): string {
  const time = formatStoreCloseTime(closesAt);
  if (copy) {
    return time ? copy.closingAt(time) : copy.closingInMinutes(minutes);
  }
  if (minutes <= 1) {
    return time ? `Store closes at ${time}. Order now!` : 'Store closes in 1 minute. Order now!';
  }
  return time
    ? `Store closes in ${minutes} minutes (by ${time}). Place your order soon.`
    : `Store closes in ${minutes} minutes. Place your order soon.`;
}
