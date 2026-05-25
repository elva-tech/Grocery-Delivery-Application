/**
 * Indian PIN validation and lookup via India Post data (public API).
 */

const https = require("https");

const PIN_REGEX = /^[1-9]\d{5}$/;
const POSTAL_API_HOST = "api.postalpincode.in";

function sanitizePin(pin) {
  return String(pin ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

function isValidIndianPincodeFormat(pin) {
  return PIN_REGEX.test(sanitizePin(pin));
}

function extractPinFromAddressFields(address = {}) {
  const direct = sanitizePin(address.pincode);
  if (PIN_REGEX.test(direct)) return direct;

  const haystack = [address.line1, address.line2, address.landmark, address.full]
    .filter(Boolean)
    .join(" ");
  const match = haystack.match(/\b([1-9]\d{5})\b/);
  return match ? match[1] : "";
}

function fetchPostalPincodeJson(pincode) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        hostname: POSTAL_API_HOST,
        path: `/pincode/${pincode}`,
        headers: { Accept: "application/json" },
        // Third-party API currently serves an expired TLS certificate.
        rejectUnauthorized: false,
        timeout: 10000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`postal API HTTP ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error("postal API timeout"));
    });
    req.on("error", reject);
  });
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
    const raw = await fetchPostalPincodeJson(pincode);
    const json = Array.isArray(raw) && raw.length > 0 ? raw[0] : raw;
    if (
      !json ||
      json.Status !== "Success" ||
      !Array.isArray(json.PostOffice) ||
      json.PostOffice.length === 0
    ) {
      return { ok: false, error: "not_found" };
    }
    const po = json.PostOffice[0];
    const city = String(po.District || po.Block || "").trim();
    const state = String(po.State || "").trim();
    if (!city || !state) return { ok: false, error: "incomplete" };
    return { ok: true, pincode, city, state };
  } catch (err) {
    console.error("lookupIndianPincode failed", {
      pincode,
      message: err.message,
    });
    return { ok: false, error: "network" };
  }
}

/**
 * Resolve city/state for order placement: API lookup first, then saved address + map pin.
 */
async function resolveDeliveryPinLocation(pin, address = {}, coords = {}) {
  const pincode = sanitizePin(pin);
  if (!PIN_REGEX.test(pincode)) {
    return { ok: false, error: "invalid_format" };
  }

  const lookup = await lookupIndianPincode(pincode);
  if (lookup.ok) return lookup;

  const city = String(address.city || "").trim();
  const state = String(address.state || "").trim();
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);

  if (city && state && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { ok: true, pincode, city, state };
  }

  return lookup;
}

module.exports = {
  sanitizePin,
  isValidIndianPincodeFormat,
  extractPinFromAddressFields,
  lookupIndianPincode,
  resolveDeliveryPinLocation,
};
