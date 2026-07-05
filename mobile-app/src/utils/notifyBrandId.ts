import { getAppExtra } from './appExtra';
import { getActiveTenantId, getBundledTenantId } from './tenantStorage';

/** Maps API tenantId → Notify brandId (must match backend NOTIFY_BRAND_ID_MAP). */
const TENANT_TO_NOTIFY_BRAND: Record<string, string> = {
  sales: 'elva-sales',
  enandi: 'enandi',
  apnakart: 'apnakart',
};

function resolveFromTenant(tenant: string): string {
  const slug = tenant.trim().toLowerCase();
  if (!slug) return '';
  return TENANT_TO_NOTIFY_BRAND[slug] || slug;
}

/** Baked at EAS build time — reliable in release APKs (unlike manifest extra alone). */
function notifyBrandIdFromEnv(): string {
  return String(process.env.EXPO_PUBLIC_NOTIFY_BRAND_ID || '').trim();
}

function notifyBrandIdFromExtra(): string {
  const extra = getAppExtra() as { notifyBrandId?: string | null };
  return String(extra.notifyBrandId || '').trim();
}

export async function getNotifyBrandId(): Promise<string> {
  const fromEnv = notifyBrandIdFromEnv();
  if (fromEnv) return fromEnv;

  const fromExtra = notifyBrandIdFromExtra();
  if (fromExtra) return fromExtra;

  const bundledTenant = getBundledTenantId();
  const fromBundled = resolveFromTenant(bundledTenant);
  if (fromBundled) return fromBundled;

  const tenant = (await getActiveTenantId()).trim().toLowerCase();
  return resolveFromTenant(tenant);
}
