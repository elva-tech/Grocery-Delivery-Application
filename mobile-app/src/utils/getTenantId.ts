/**
 * Resolves the current tenantId for mobile.
 *
 * Resolution order:
 *   1. EXPO_PUBLIC_TENANT_ID   — set per build in eas.json or .env
 *   2. 'demo-tenant'           — local dev fallback
 *
 * For authenticated requests the backend extracts tenantId from the JWT;
 * this value is only needed for pre-auth requests (products, banners, settings).
 *
 * To configure per build, add to eas.json build profile:
 *   "env": { "EXPO_PUBLIC_TENANT_ID": "freshmart" }
 */
export function getTenantId(): string {
  const envTenant = process.env.EXPO_PUBLIC_TENANT_ID;
  if (envTenant) {
    return envTenant;
  }
  return 'demo-tenant';
}
