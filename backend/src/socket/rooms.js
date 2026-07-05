/** Build the tenant-scoped Socket.IO room name. */
function tenantRoom(tenantId) {
  return `tenant_${String(tenantId || "").trim()}`;
}

module.exports = { tenantRoom };
