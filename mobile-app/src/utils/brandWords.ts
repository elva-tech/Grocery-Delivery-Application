/** Split store name for two-tone header branding (matches customer website). */
export function splitBrandWords(storeName: string) {
  const words = storeName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { head: 'STORE', tail: '' };
  if (words.length === 1) {
    const w = words[0].toUpperCase();
    const mid = Math.max(1, Math.floor(w.length / 2));
    return { head: w.slice(0, mid), tail: w.slice(mid) };
  }
  return {
    head: words.slice(0, -1).join(' ').toUpperCase(),
    tail: ` ${words[words.length - 1].toUpperCase()}`,
  };
}

export function titleCaseTenantId(tenantId: string) {
  return String(tenantId || '')
    .split(/[-_]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function storeInitials(storeName: string): string {
  const words = storeName.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
  }
  const w = (words[0] || 'S').toUpperCase();
  return w.slice(0, 2);
}
