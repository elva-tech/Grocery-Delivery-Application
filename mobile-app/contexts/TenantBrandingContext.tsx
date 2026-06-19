import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DeviceEventEmitter } from 'react-native';

import { fetchTenantDetails, type TenantDetails } from '@/api/tenantApi';
import { titleCaseTenantId } from '@/src/utils/brandWords';
import { getTenantId } from '@/src/utils/getTenantId';
import {
  readTenantBrandingCache,
  writeTenantBrandingCache,
} from '@/src/utils/tenantBrandingCache';
import { getActiveTenantId } from '@/src/utils/tenantStorage';
import { resolveProductImageUri } from '@/utils/resolveProductImageUri';

export type TenantBrandingValue = {
  /** Cache applied and bootstrap finished — safe to show branded UI. */
  ready: boolean;
  loading: boolean;
  error: string | null;
  raw: TenantDetails | null;
  storeName: string;
  logoUri: string | null;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBadge: string;
  storeAddressLine: string;
  supportEmail: string;
  supportPhone: string;
  supportHours: string;
  refetch: () => Promise<void>;
};

const TenantBrandingContext = createContext<TenantBrandingValue | null>(null);

function cacheToTenantDetails(
  tenantId: string,
  cached: NonNullable<Awaited<ReturnType<typeof readTenantBrandingCache>>>,
): TenantDetails {
  return {
    tenantId,
    storeName: cached.storeName,
    logo: cached.logo,
    tagline: cached.tagline,
    heroTitle: cached.heroTitle,
    heroSubtitle: cached.heroSubtitle,
    heroBadge: cached.heroBadge,
  };
}

export function TenantBrandingProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<TenantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState(getTenantId);

  const load = useCallback(async (tid: string, opts?: { hadCache?: boolean }) => {
    if (!opts?.hadCache) setLoading(true);
    setError(null);
    try {
      const data = await fetchTenantDetails();
      setRaw(data);
      await writeTenantBrandingCache({
        tenantId: data.tenantId || tid,
        storeName: data.storeName,
        logo: data.logo,
        tagline: data.tagline,
        heroTitle: data.heroTitle,
        heroSubtitle: data.heroSubtitle,
        heroBadge: data.heroBadge,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load store';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setReady(false);
    const tid = (await getActiveTenantId()).trim() || getTenantId().trim();
    setTenantId(tid);

    if (!tid) {
      setRaw(null);
      setLoading(false);
      setReady(true);
      return;
    }

    const cached = await readTenantBrandingCache(tid);
    if (cached) {
      setRaw(cacheToTenantDetails(tid, cached));
      setLoading(false);
    } else {
      setRaw(null);
      setLoading(true);
    }
    setReady(true);
    await load(tid, { hadCache: Boolean(cached) });
  }, [load]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('tenant-changed', () => {
      bootstrap();
    });
    return () => sub.remove();
  }, [bootstrap]);

  const value = useMemo((): TenantBrandingValue => {
    const tid = raw?.tenantId?.trim() || tenantId || getTenantId().trim();
    const storeName =
      raw?.storeName?.trim() || (tid ? titleCaseTenantId(tid) : 'ELVA');
    const logoUri = raw?.logo?.trim()
      ? resolveProductImageUri({ imageUrl: raw.logo.trim() })
      : null;
    const supportEmail =
      raw?.supportEmail?.trim() || raw?.contactEmail?.trim() || '';
    const supportPhone =
      raw?.supportPhone?.trim() || raw?.phoneNumber?.trim() || '';
    const supportHours = raw?.supportHours?.trim() || '';
    const storeAddressLine = raw?.storeAddress?.trim() || '';
    const heroBadge = raw?.heroBadge?.trim() || '';
    return {
      ready,
      loading,
      error,
      raw,
      storeName,
      logoUri,
      tagline: raw?.tagline?.trim() || '',
      heroTitle: raw?.heroTitle?.trim() || `Welcome to ${storeName}`,
      heroSubtitle:
        raw?.heroSubtitle?.trim() ||
        'Browse categories, add items to your cart, and check out in minutes.',
      heroBadge,
      storeAddressLine,
      supportEmail,
      supportPhone,
      supportHours,
      refetch: () => bootstrap(),
    };
  }, [raw, loading, ready, error, bootstrap, tenantId]);

  return (
    <TenantBrandingContext.Provider value={value}>{children}</TenantBrandingContext.Provider>
  );
}

export function useTenantBranding(): TenantBrandingValue {
  const ctx = useContext(TenantBrandingContext);
  if (!ctx) {
    throw new Error('useTenantBranding must be used within TenantBrandingProvider');
  }
  return ctx;
}
