import { getAppExtra } from './appExtra';

type CustomerExtra = {
  customer?: string | null;
  whitelabel?: boolean;
  tenantId?: string | null;
  urlScheme?: string | null;
};

function normalizeTenantId(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function getExtra(): CustomerExtra {
  return getAppExtra() as CustomerExtra;
}

function bundledTenantFromEnv(): string {
  return normalizeTenantId(process.env.EXPO_PUBLIC_TENANT_ID);
}

/** True when built for one Play Store customer (CUSTOMER set in EAS / app.config). */
export function isCustomerBuild(): boolean {
  const { whitelabel, tenantId } = getExtra();
  if (whitelabel && normalizeTenantId(tenantId)) return true;
  return Boolean(bundledTenantFromEnv());
}

/** @deprecated Use isCustomerBuild — kept for existing imports */
export const isWhitelabelBuild = isCustomerBuild;

/** Fixed tenant for customer builds; empty for generic multi-tenant app. */
export function getBundledTenantId(): string {
  const fromExtra = normalizeTenantId(getExtra().tenantId);
  const fromEnv = bundledTenantFromEnv();
  if (isCustomerBuild()) return fromExtra || fromEnv;
  return '';
}

export function getBundledUrlScheme(): string {
  const fromExtra = getExtra().urlScheme;
  if (fromExtra) return normalizeTenantId(fromExtra);
  return (process.env.EXPO_PUBLIC_URL_SCHEME || 'enandi').trim().toLowerCase();
}
