/**
 * Sync tenant hint for bootstrapping UI only.
 * API calls must use async `getActiveTenantId()` from tenantStorage.
 *
 * In production APK, tenant comes from store code / QR (AsyncStorage).
 * For local Expo dev, set EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID in .env.
 */
export function getTenantId(): string {
  const localDefault = process.env.EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID?.trim();
  if (localDefault) return localDefault;

  if (__DEV__) {
    const envTenant = process.env.EXPO_PUBLIC_TENANT_ID?.trim();
    if (envTenant) return envTenant;
  }

  return '';
}

export { getActiveTenantId, hasActiveTenant } from './tenantStorage';
