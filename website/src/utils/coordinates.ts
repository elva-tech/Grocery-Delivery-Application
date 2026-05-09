/**
 * Coerce saved-address lat/lng (API JSON may be number or numeric string after localStorage round-trip).
 * Returns null if missing, invalid, or 0,0 so callers can fall back to PIN / GPS only when intended.
 */
export function parseAddressLatLng(addr: { lat?: unknown; lng?: unknown } | null | undefined): {
  lat: number;
  lng: number;
} | null {
  if (!addr || typeof addr !== 'object') return null;
  const rawLat = (addr as { lat?: unknown }).lat;
  const rawLng = (addr as { lng?: unknown }).lng;
  const lat = typeof rawLat === 'number' ? rawLat : Number(String(rawLat ?? '').trim());
  const lng = typeof rawLng === 'number' ? rawLng : Number(String(rawLng ?? '').trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
