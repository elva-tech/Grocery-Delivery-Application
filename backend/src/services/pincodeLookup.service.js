/**
 * Indian PIN validation and lookup via India Post data (public API).
 */

const PIN_REGEX = /^[1-9]\d{5}$/;

function sanitizePin(pin) {
  return String(pin ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

function isValidIndianPincodeFormat(pin) {
  return PIN_REGEX.test(sanitizePin(pin));
}

/**
 * @returns {Promise<{ ok: true, pincode: string, city: string, state: string } | { ok: false, error: string }>}
 */
async function lookupIndianPincode(pin) {
  const pincode = sanitizePin(pin);
  if (!PIN_REGEX.test(pincode)) {
    return { ok: false, error: "invalid_format" };
  }
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    if (!res.ok) return { ok: false, error: "network" };
    const raw = await res.json();
    const json = Array.isArray(raw) && raw.length > 0 ? raw[0] : raw;
    if (!json || json.Status !== "Success" || !Array.isArray(json.PostOffice) || json.PostOffice.length === 0) {
      return { ok: false, error: "not_found" };
    }
    const po = json.PostOffice[0];
    const city = String(po.District || po.Block || "").trim();
    const state = String(po.State || "").trim();
    if (!city || !state) return { ok: false, error: "incomplete" };
    return { ok: true, pincode, city, state };
  } catch {
    return { ok: false, error: "network" };
  }
}

module.exports = {
  sanitizePin,
  isValidIndianPincodeFormat,
  lookupIndianPincode,
};
