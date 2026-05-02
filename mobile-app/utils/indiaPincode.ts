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

export async function lookupIndianPincode(pin: string): Promise<PinLookupResult> {
  const pincode = sanitizeIndianPincode(pin);
  if (!PIN_REGEX.test(pincode)) return { ok: false };
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    if (!res.ok) return { ok: false };
    const raw = await res.json();
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

export function buildDeliveryAddressPayload(address: {
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
    line1: String(address?.line1 || address?.full || '').trim(),
    line2: String(address?.line2 || '').trim(),
    landmark: String(address?.landmark || '').trim(),
    city: String(address?.city || '').trim(),
    state: String(address?.state || '').trim(),
    pincode,
    lat: typeof address?.lat === 'number' ? address.lat : 0,
    lng: typeof address?.lng === 'number' ? address.lng : 0,
  };
}

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
