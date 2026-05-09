import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

const TENANT_KEY = 'tenantId';
const FORCED_TENANT_ID = 'puma';
const FALLBACK =
  process.env.EXPO_PUBLIC_TENANT_ID?.trim() ||
  process.env.EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID?.trim() ||
  FORCED_TENANT_ID;

function normalizeTenantId(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function isValidTenantId(value: string): boolean {
  // Keep tenant ids human-readable and avoid accidental IP fragments like "192".
  if (!value || value.length < 3) return false;
  if (/^\d+$/.test(value)) return false;
  return /^[a-z0-9-]+$/.test(value);
}

/**
 * Extract tenantId from a deep-link or HTTPS URL.
 *
 * Examples:
 *   enandi://freshmart          → "freshmart"
 *   enandi://freshmart/home     → "freshmart"
 *   https://freshmart.enandi.com → "freshmart"
 */
export function extractTenantFromUrl(url: string): string | null {
  try {
    if (url.includes('enandi://')) {
      const part = normalizeTenantId(url.split('enandi://')[1]?.split('/')[0]?.split('?')[0]);
      return isValidTenantId(part) ? part : null;
    }
    const parsed = new URL(url);
    // Only trust HTTPS domain links for tenant extraction.
    if (parsed.protocol !== 'https:') return null;
    // HTTPS subdomain: freshmart.enandi.com → "freshmart"
    const hostname = parsed.hostname.toLowerCase();
    // Ignore localhost, IP addresses and non enandi domains.
    const isIpLike = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
    if (hostname === 'localhost' || isIpLike || !hostname.endsWith('.enandi.com')) {
      return null;
    }
    const parts = hostname.split('.');
    // Ignore plain "localhost" and bare domains
    if (parts.length >= 2 && parts[0] !== 'www') {
      const tenant = normalizeTenantId(parts[0]);
      return isValidTenantId(tenant) ? tenant : null;
    }
  } catch {}
  return null;
}

/** Persist tenantId to AsyncStorage. */
export async function saveTenantId(tenantId: string): Promise<void> {
  const normalized = normalizeTenantId(tenantId);
  if (!isValidTenantId(normalized)) return;
  await AsyncStorage.setItem(TENANT_KEY, normalized);
  console.log('[tenant] saved:', normalized);
  DeviceEventEmitter.emit('tenant-changed');
}

/**
 * Read the active tenantId.
 *
 * Resolution order:
 *   1. AsyncStorage (set via deep link / QR)
 *   2. EXPO_PUBLIC_TENANT_ID / EXPO_PUBLIC_LOCAL_DEFAULT_TENANT_ID (EAS / .env)
 *   3. 'puma'                         (local dev fallback)
 */
export async function getActiveTenantId(): Promise<string> {
  // Temporary lock as requested: keep all customer traffic on puma.
  if (FORCED_TENANT_ID) return FORCED_TENANT_ID;
  try {
    const stored = normalizeTenantId(await AsyncStorage.getItem(TENANT_KEY));
    if (stored) return stored;
  } catch {}
  return normalizeTenantId(FALLBACK) || FORCED_TENANT_ID;
}
