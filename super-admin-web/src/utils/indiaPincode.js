const PIN_REGEX = /^[1-9]\d{5}$/;

export function sanitizeIndianPincode(input) {
  return String(input || '')
    .replace(/\D/g, '')
    .slice(0, 6);
}

export function isValidIndianPincode(pin) {
  return PIN_REGEX.test(sanitizeIndianPincode(pin));
}

/** @returns {Promise<{ ok: true, pincode: string, city: string, state: string } | { ok: false }>} */
export async function lookupIndianPincode(pin) {
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

export function formatStoreAddressFromParts({
  line1,
  line2,
  landmark,
  city,
  state,
  pincode,
}) {
  const l1 = String(line1 || '').trim();
  const l2 = String(line2 || '').trim();
  const lm = String(landmark || '').trim();
  const c = String(city || '').trim();
  const s = String(state || '').trim();
  const p = sanitizeIndianPincode(pincode);
  const head = [l1, l2, lm].filter(Boolean).join(', ');
  const tail = [c, s, p].filter(Boolean).join(', ');
  if (head && tail) return `${head}\n${tail}`;
  return head || tail || '';
}
