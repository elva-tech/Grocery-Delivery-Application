import AsyncStorage from '@react-native-async-storage/async-storage';

const TENANT_KEY = 'tenantId';
const FALLBACK   = process.env.EXPO_PUBLIC_TENANT_ID || 'demo-tenant';

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
      const part = url.split('enandi://')[1]?.split('/')[0]?.split('?')[0];
      return part && part.length > 0 ? part : null;
    }
    // HTTPS subdomain: freshmart.enandi.com → "freshmart"
    const hostname = new URL(url).hostname.toLowerCase();
    const parts = hostname.split('.');
    // Ignore plain "localhost" and bare domains
    if (parts.length >= 2 && parts[0] !== 'www') {
      return parts[0];
    }
  } catch {}
  return null;
}

/** Persist tenantId to AsyncStorage. */
export async function saveTenantId(tenantId: string): Promise<void> {
  await AsyncStorage.setItem(TENANT_KEY, tenantId);
  console.log('[tenant] saved:', tenantId);
}

/**
 * Read the active tenantId.
 *
 * Resolution order:
 *   1. AsyncStorage (set via deep link / QR)
 *   2. EXPO_PUBLIC_TENANT_ID env var  (set per EAS build profile)
 *   3. 'demo-tenant'                  (local dev fallback)
 */
export async function getActiveTenantId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(TENANT_KEY);
    if (stored) return stored;
  } catch {}
  return FALLBACK;
}
