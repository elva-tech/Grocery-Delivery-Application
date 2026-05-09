import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchTenantDetails, type TenantDetails } from '../api/tenantApi';
import { getTenantId } from '../utils/getTenantId';

export type TenantBrandingValue = {
  loading: boolean;
  error: string | null;
  raw: TenantDetails | null;
  storeName: string;
  logo: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBadge: string;
};

function titleCaseTenantId(tenantId: string) {
  return tenantId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const TenantBrandingContext = createContext<TenantBrandingValue | null>(null);

export function TenantBrandingProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<TenantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTenantDetails()
      .then((data) => {
        if (!cancelled) setRaw(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e?.message || 'Failed to load store');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo((): TenantBrandingValue => {
    const tid = raw?.tenantId?.trim() || getTenantId();
    const storeName =
      raw?.storeName?.trim() || titleCaseTenantId(tid) || 'Store';
    return {
      loading,
      error,
      raw,
      storeName,
      logo: typeof raw?.logo === 'string' ? raw.logo.trim() : '',
      tagline: raw?.tagline?.trim() || '',
      heroTitle: raw?.heroTitle?.trim() || `Welcome to ${storeName}`,
      heroSubtitle:
        raw?.heroSubtitle?.trim() ||
        'Browse categories, add items to your cart, and check out in minutes.',
      heroBadge: raw?.heroBadge?.trim() || 'Shop local',
    };
  }, [raw, loading, error]);

  return (
    <TenantBrandingContext.Provider value={value}>
      {children}
    </TenantBrandingContext.Provider>
  );
}

export function useTenantBranding(): TenantBrandingValue {
  const ctx = useContext(TenantBrandingContext);
  if (!ctx) {
    throw new Error('useTenantBranding must be used within TenantBrandingProvider');
  }
  return ctx;
}
