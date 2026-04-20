/**
 * Resolves the current tenantId for mobile (pre-auth API headers).
 *
 * Set EXPO_PUBLIC_TENANT_ID per store (see eas.json).
 * Optional: EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID when TENANT_ID is unset in dev.
 */
export function getTenantId(): string {
  const envTenant = process.env.EXPO_PUBLIC_TENANT_ID?.trim();
  if (envTenant) return envTenant;

  const localDefault = process.env.EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID?.trim();
  if (localDefault) return localDefault;

  console.warn(
    "[tenant] Set EXPO_PUBLIC_TENANT_ID (or EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID) so catalog and login target the same store."
  );
  return "demo-tenant";
}
