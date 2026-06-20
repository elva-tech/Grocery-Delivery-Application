import { getTenantId } from './getTenantId';

/** Maps API tenantId → Notify brandId (must match backend NOTIFY_BRAND_ID_MAP). */
const TENANT_TO_NOTIFY_BRAND: Record<string, string> = {
  sales: 'elva-sales',
};

export function getNotifyBrandId(): string {
  const tenant = getTenantId().trim().toLowerCase();
  return TENANT_TO_NOTIFY_BRAND[tenant] || tenant;
}
