import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@tenant_branding_v1';

export type TenantBrandingCache = {
  tenantId: string;
  storeName: string;
  logo?: string;
  tagline?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroBadge?: string;
};

function normalizeTenantId(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

export async function readTenantBrandingCache(
  tenantId: string,
): Promise<TenantBrandingCache | null> {
  const tid = normalizeTenantId(tenantId);
  if (!tid) return null;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TenantBrandingCache;
    if (normalizeTenantId(parsed?.tenantId) !== tid) return null;
    if (!parsed.storeName?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeTenantBrandingCache(data: TenantBrandingCache): Promise<void> {
  const tid = normalizeTenantId(data.tenantId);
  if (!tid || !data.storeName?.trim()) return;
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        tenantId: tid,
        storeName: data.storeName.trim(),
        logo: data.logo?.trim() || undefined,
        tagline: data.tagline?.trim() || undefined,
        heroTitle: data.heroTitle?.trim() || undefined,
        heroSubtitle: data.heroSubtitle?.trim() || undefined,
        heroBadge: data.heroBadge?.trim() || undefined,
      }),
    );
  } catch {
    /* ignore */
  }
}
