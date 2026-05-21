const { randomBytes } = require("crypto");

function generateSubscriptionUniqueKey(tenantId, storeId) {
  const salt = randomBytes(16).toString("hex");
  return `${tenantId}:${storeId}:${salt}`;
}

module.exports = { generateSubscriptionUniqueKey };
