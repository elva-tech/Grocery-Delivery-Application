/**
 * Resolves the current tenantId for mobile (pre-auth API headers).
 *
 * Set EXPO_PUBLIC_TENANT_ID per store (see eas.json).
 * Optional: EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID when TENANT_ID is unset in dev.
 * Built-in default: puma (must match tenantStorage fallback).
 */
export function getTenantId(): string {
  const envTenant = process.env.EXPO_PUBLIC_TENANT_ID?.trim();
  if (envTenant) return envTenant;

  const localDefault = process.env.EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID?.trim();
  if (localDefault) return localDefault;

  return "puma";
}

/** @deprecated Import from `@/src/utils/tenantStorage` — async tenant for API headers */
export { getActiveTenantId } from './tenantStorage';
