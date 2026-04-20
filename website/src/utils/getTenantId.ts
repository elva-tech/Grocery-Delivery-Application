/**
 * Resolves the current tenantId for API calls and auth.
 *
 * Priority:
 *   1. VITE_TENANT_ID (required for localhost multi-tenant dev)
 *   2. Hostname: admin.{tenant}.… or {tenant}.…
 *
 * On localhost, if VITE_TENANT_ID is unset, falls back to VITE_LOCAL_DEFAULT_TENANT_ID
 * then "demo-tenant" (with a console warning).
 */
export function getTenantId(): string {
  const fromEnv = (import.meta.env.VITE_TENANT_ID as string | undefined)?.trim();
  if (fromEnv) return fromEnv;

  const host = window.location.hostname.toLowerCase();

  if (host === "localhost" || host === "127.0.0.1") {
    const localFallback =
      (import.meta.env.VITE_LOCAL_DEFAULT_TENANT_ID as string | undefined)?.trim() ||
      "demo-tenant";
    if (!import.meta.env.VITE_LOCAL_DEFAULT_TENANT_ID && localFallback === "demo-tenant") {
      console.warn(
        "[tenant] Set VITE_TENANT_ID in website/.env.development so login and catalog use the same store (e.g. textile-point)."
      );
    }
    return localFallback;
  }

  const parts = host.split(".");

  const adminIndex = parts.indexOf("admin");
  if (adminIndex !== -1 && parts[adminIndex + 1]) {
    const tenantId = parts[adminIndex + 1];
    return tenantId;
  }

  return parts[0] || "demo-tenant";
}
