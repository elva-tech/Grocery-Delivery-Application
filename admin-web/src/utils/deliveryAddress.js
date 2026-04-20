/**
 * @param {Record<string, unknown> | null | undefined} da - order.deliveryAddress
 * @returns {string}
 */
export function formatDeliveryAddressSummary(da) {
  if (!da || typeof da !== "object") return "No Address";
  const pin = da.pincode != null && da.pincode !== "" ? String(da.pincode) : "";
  const tail = [da.city, da.state, pin].filter(Boolean).join(", ");
  const parts = [da.line1, da.line2, da.landmark, tail].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return da.line1 || "No Address";
}
