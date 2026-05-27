/**
 * Resolves tenantId for API calls.
 *
 * Priority:
 *   1. Hostname (production): admin.{tenant}.… or {tenant}.…
 *   2. localhost only: VITE_TENANT_ID from .env, then VITE_LOCAL_DEFAULT_TENANT_ID
 *   3. Fallback: "demo-tenant"
 */

function tenantIdFromHostname(host) {
  const parts = host.split(".");
  const ignored = ["www"];
  const cleanParts = parts.filter((p) => !ignored.includes(p));

  const adminIndex = cleanParts.indexOf("admin");
  if (adminIndex !== -1 && cleanParts[adminIndex + 1]) {
    return cleanParts[adminIndex + 1];
  }

  return cleanParts[0] || "";
}

export function getTenantId() {
  if (typeof window === "undefined") return "demo-tenant";

  const host = window.location.hostname.toLowerCase();

  if (host === "localhost" || host === "127.0.0.1") {
    const fromEnv = String(import.meta.env.VITE_TENANT_ID || "").trim().toLowerCase();
    if (fromEnv) return fromEnv;

    const localDefault = String(
      import.meta.env.VITE_LOCAL_DEFAULT_TENANT_ID || ""
    )
      .trim()
      .toLowerCase();
    if (localDefault) return localDefault;

    return "demo-tenant";
  }

  const fromHost = tenantIdFromHostname(host);
  if (fromHost) return fromHost;

  return "demo-tenant";
}
