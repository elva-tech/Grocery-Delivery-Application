import { parseAddressLatLng } from './coordinates';

const PIN_REGEX = /^[1-9]\d{5}$/;

export function sanitizeIndianPincode(input: string): string {
  return (input || '').replace(/\D/g, '').slice(0, 6);
}

export function isValidIndianPincode(pin: string): boolean {
  return PIN_REGEX.test(sanitizeIndianPincode(pin));
}

export type PinLookupResult =
  | { ok: true; pincode: string; city: string; state: string }
  | { ok: false };

/** Fetches district and state for a PIN; overwrites any manually typed city/state when applied. */
/**
 * Approximate hub for delivery eligibility when only PIN is known (gift / manual flows).
 * Uses Nominatim — coarse accuracy vs a map pin; good enough for radius checks.
 */
export async function geocodeApproxFromIndianPincode(pin: string): Promise<{ lat: number; lng: number } | null> {
  const pincode = sanitizeIndianPincode(pin);
  if (!PIN_REGEX.test(pincode)) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&postalcode=${encodeURIComponent(pincode)}&limit=1`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'KMF-E-Grocery-Storefront/1.0 (delivery eligibility)',
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: string; lon?: string }[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export async function lookupIndianPincode(pin: string): Promise<PinLookupResult> {
  const pincode = sanitizeIndianPincode(pin);
  if (!PIN_REGEX.test(pincode)) return { ok: false };
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    if (!res.ok) return { ok: false };
    const raw = await res.json();
    // API returns either [{ Status, PostOffice }] or { Status, PostOffice } — normalize to one object.
    const json = Array.isArray(raw) && raw.length > 0 ? raw[0] : raw;
    if (!json || json.Status !== 'Success' || !Array.isArray(json.PostOffice) || json.PostOffice.length === 0) {
      return { ok: false };
    }
    const po = json.PostOffice[0];
    const city = String(po.District || po.Block || '').trim();
    const state = String(po.State || '').trim();
    if (!city || !state) return { ok: false };
    return { ok: true, pincode, city, state };
  } catch {
    return { ok: false };
  }
}

/** Same shape as POST /api/orders `deliveryAddress` (server normalizes city/state from PIN). */
export function buildDeliveryAddressPayload(address: {
  isMyAddress?: boolean;
  recipientName?: string;
  recipientPhone?: string;
  line1?: string;
  line2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  full?: string;
  lat?: number;
  lng?: number;
}) {
  const pincode = sanitizeIndianPincode(address?.pincode || '');
  return {
    isMyAddress: address?.isMyAddress !== undefined ? Boolean(address.isMyAddress) : true,
    recipientName: String(address?.recipientName || '').trim(),
    recipientPhone: String(address?.recipientPhone || '').replace(/\D/g, '').slice(-10),
    line1: String(address?.line1 || address?.full || '').trim(),
    line2: String(address?.line2 || '').trim(),
    landmark: String(address?.landmark || '').trim(),
    city: String(address?.city || '').trim(),
    state: String(address?.state || '').trim(),
    pincode,
    lat: parseAddressLatLng(address)?.lat ?? 0,
    lng: parseAddressLatLng(address)?.lng ?? 0,
  };
}

/** Single-line summary for cards and legacy `full` fallback. */
export function formatAddressSummary(a: {
  line1?: string;
  line2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  full?: string;
}): string {
  if (!a) return '';
  if (a.line1 || a.pincode) {
    const tail = [a.city, a.state, a.pincode].filter(Boolean).join(', ');
    const parts = [a.line1, a.line2, a.landmark, tail].filter(Boolean);
    if (parts.length) return parts.join(' · ');
  }
  return (a.full || a.line1 || '').trim();
}
