import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

const TENANT_KEY = 'tenantId';

/** Optional dev-only default from .env (never set in EAS production builds). */
function envFallbackTenant(): string {
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
 * Extract tenantId from a deep-link or HTTPS URL.
 *
 * Examples:
 *   enandi://sales              → "sales"
 *   https://sales.elvatech.in   → "sales"
 *   https://sales.enandi.com    → "sales"
 */
export function extractTenantFromUrl(url: string): string | null {
  try {
    if (url.includes('enandi://')) {
      const part = normalizeTenantId(url.split('enandi://')[1]?.split('/')[0]?.split('?')[0]);
      return isValidTenantId(part) ? part : null;
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

/** Persist tenantId to AsyncStorage (store code entry or QR / deep link). */
export async function saveTenantId(tenantId: string): Promise<void> {
  const normalized = normalizeTenantId(tenantId);
  if (!isValidTenantId(normalized)) return;
  await AsyncStorage.setItem(TENANT_KEY, normalized);
  console.log('[tenant] saved:', normalized);
  DeviceEventEmitter.emit('tenant-changed');
}

/** Whether the user has chosen a store (code, QR, or dev env default). */
export async function hasActiveTenant(): Promise<boolean> {
  return Boolean((await getActiveTenantId()).trim());
}

/**
 * Read the active tenantId.
 *
 * Resolution order:
 *   1. AsyncStorage (store code or QR / deep link)
 *   2. EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID / EXPO_PUBLIC_TENANT_ID (dev only)
 *   3. empty string — user must enter store code
 */
export async function getActiveTenantId(): Promise<string> {
  try {
    const stored = normalizeTenantId(await AsyncStorage.getItem(TENANT_KEY));
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return normalizeTenantId(envFallbackTenant());
}
