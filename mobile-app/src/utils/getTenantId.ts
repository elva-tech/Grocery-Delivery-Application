import { getBundledTenantId, isCustomerBuild } from './customer';

/**
 * Sync tenant hint for bootstrapping UI only.
 * API calls must use async `getActiveTenantId()` from tenantStorage.
 */
export function getTenantId(): string {
  const bundled = getBundledTenantId();
  if (bundled) return bundled;

  const localDefault = process.env.EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID?.trim();
  if (localDefault) return localDefault;

  if (__DEV__ && !isCustomerBuild()) {
    const envTenant = process.env.EXPO_PUBLIC_TENANT_ID?.trim();
    if (envTenant) return envTenant;
  }

  return '';
}

export {
  getActiveTenantId,
  getBundledTenantId,
  hasActiveTenant,
  isCustomerBuild,
  isCustomerBuild as isWhitelabelBuild,
} from './tenantStorage';
