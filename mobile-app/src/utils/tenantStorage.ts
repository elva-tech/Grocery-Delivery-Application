import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

import { getBundledTenantId, getBundledUrlScheme, isCustomerBuild } from './customer';

const TENANT_KEY = 'tenantId';

/** Optional dev-only default from .env (generic app only). */
function envFallbackTenant(): string {
  if (isCustomerBuild()) return '';
  const localDefault = process.env.EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID?.trim();
  if (localDefault) return localDefault;
  if (__DEV__) {
    return process.env.EXPO_PUBLIC_TENANT_ID?.trim() || '';
  }
  return '';
}

function normalizeTenantId(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function isValidTenantId(value: string): boolean {
  if (!value || value.length < 3) return false;
  if (/^\d+$/.test(value)) return false;
  return /^[a-z0-9-]+$/.test(value);
}

function primaryUrlScheme(): string {
  return getBundledUrlScheme();
}

function tenantIdFromSchemeUrl(url: string, scheme: string): string | null {
  const prefix = `${scheme}://`;
  if (!url.includes(prefix)) return null;
  const part = normalizeTenantId(url.split(prefix)[1]?.split('/')[0]?.split('?')[0]);
  return isValidTenantId(part) ? part : null;
}

function tenantIdFromHostname(hostname: string): string | null {
  const host = hostname.toLowerCase();
  const isIpLike = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (!host || host === 'localhost' || isIpLike) return null;

  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return null;

  const adminIndex = parts.indexOf('admin');
  if (adminIndex !== -1 && parts[adminIndex + 1]) {
    const tenant = normalizeTenantId(parts[adminIndex + 1]);
    return isValidTenantId(tenant) ? tenant : null;
  }

  const tenant = normalizeTenantId(parts[0]);
  if (tenant === 'www' || !isValidTenantId(tenant)) return null;
  return tenant;
}

/**
 * Extract tenantId from a deep-link or HTTPS URL (generic multi-tenant app).
 * White-label builds ignore deep-link tenant switching.
 */
export function extractTenantFromUrl(url: string): string | null {
  if (isCustomerBuild()) return null;

  try {
    const scheme = primaryUrlScheme();
    const fromPrimary = tenantIdFromSchemeUrl(url, scheme);
    if (fromPrimary) return fromPrimary;

    if (scheme !== 'enandi') {
      const fromLegacy = tenantIdFromSchemeUrl(url, 'enandi');
      if (fromLegacy) return fromLegacy;
    }

    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname.endsWith('.enandi.com') && !hostname.endsWith('.elvatech.in')) {
      return null;
    }

    return tenantIdFromHostname(hostname);
  } catch {
    return null;
  }
}

/** Persist tenantId to AsyncStorage (generic app: store code or QR / deep link). */
export async function saveTenantId(tenantId: string): Promise<void> {
  if (isCustomerBuild()) return;

  const normalized = normalizeTenantId(tenantId);
  if (!isValidTenantId(normalized)) return;
  await AsyncStorage.setItem(TENANT_KEY, normalized);
  console.log('[tenant] saved:', normalized);
  DeviceEventEmitter.emit('tenant-changed');
}

/** Whether the user has an active store context. */
export async function hasActiveTenant(): Promise<boolean> {
  return Boolean((await getActiveTenantId()).trim());
}

/**
 * Read the active tenantId.
 *
 * White-label: fixed EXPO_PUBLIC_TENANT_ID from EAS build.
 * Generic: AsyncStorage → dev env fallback → empty (store code required).
 */
export async function getActiveTenantId(): Promise<string> {
  const bundled = getBundledTenantId();
  if (bundled) return bundled;

  try {
    const stored = normalizeTenantId(await AsyncStorage.getItem(TENANT_KEY));
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return normalizeTenantId(envFallbackTenant());
}

export { getBundledTenantId, isCustomerBuild, isCustomerBuild as isWhitelabelBuild } from './customer';
