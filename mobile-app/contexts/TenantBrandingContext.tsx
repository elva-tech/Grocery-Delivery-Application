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
import { APP_BRAND } from '@/src/config/constants';
import { resolveProductImageUri } from '@/utils/resolveProductImageUri';

const DEFAULT_TAGLINE = 'Quality you can trust — delivered with care.';

export type TenantBrandingValue = {
  loading: boolean;
  error: string | null;
  raw: TenantDetails | null;
  storeName: string;
  logoUri: string | null;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  /** Short badge from tenant (e.g. “Shop local”) — optional. */
  heroBadge: string;
  /** Single-line area hint for delivery row (store address or empty). */
  storeAddressLine: string;
  /** Customer-facing support email (matches website: supportEmail || contactEmail). */
  supportEmail: string;
  supportPhone: string;
  supportHours: string;
  refetch: () => Promise<void>;
};

const TenantBrandingContext = createContext<TenantBrandingValue | null>(null);

export function TenantBrandingProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<TenantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTenantDetails();
      setRaw(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load store';
      setError(msg);
      setRaw(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('tenant-changed', () => {
      load();
    });
    return () => sub.remove();
  }, [load]);

  const value = useMemo((): TenantBrandingValue => {
    const storeName = raw?.storeName?.trim() || APP_BRAND;
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
      loading,
      error,
      raw,
      storeName,
      logoUri,
      tagline: raw?.tagline?.trim() || DEFAULT_TAGLINE,
      heroTitle: raw?.heroTitle?.trim() || `Welcome to ${storeName}`,
      heroSubtitle:
        raw?.heroSubtitle?.trim() ||
        'Browse categories, add to cart, and checkout in minutes.',
      heroBadge,
      storeAddressLine,
      supportEmail,
      supportPhone,
      supportHours,
      refetch: load,
    };
  }, [raw, loading, error, load]);

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
