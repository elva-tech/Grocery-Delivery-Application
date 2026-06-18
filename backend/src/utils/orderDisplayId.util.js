/** Customer-facing order reference — matches UI (#last 8 chars of MongoDB _id). */
function formatOrderDisplayId(orderOrId) {
  const raw = String(orderOrId?._id ?? orderOrId ?? "").trim();
  if (!raw) return "";
  return raw.slice(-8).toUpperCase();
}

module.exports = { formatOrderDisplayId };
