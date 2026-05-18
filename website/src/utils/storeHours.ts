export function formatStoreCloseTime(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return '';
  }
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
