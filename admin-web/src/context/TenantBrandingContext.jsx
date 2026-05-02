import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiService } from '../services/apiService';

function titleCaseTenantId(tenantId) {
  return String(tenantId || '')
    .split(/[-_]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const TenantBrandingContext = createContext(null);

export function TenantBrandingProvider({ children }) {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(() => {
    setLoading(true);
    setError(null);
    return apiService
      .getStoreProfile()
      .then((data) => {
        setRaw(data);
      })
      .catch((e) => {
        setError(
          e?.response?.data?.message ||
            e?.message ||
            'Failed to load store profile'
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadProfile().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  const value = useMemo(() => {
    const tid = (raw?.tenantId || '').trim();
    const storeName =
      (raw?.storeName || '').trim() || (tid ? titleCaseTenantId(tid) : 'Store');
    return {
      loading,
      error,
      raw,
      storeName,
      logo: typeof raw?.logo === 'string' ? raw.logo.trim() : '',
      logisticsLabel: `${storeName} logistics`,
      refreshTenantProfile: loadProfile,
    };
  }, [raw, loading, error, loadProfile]);

  return (
    <TenantBrandingContext.Provider value={value}>
      {children}
    </TenantBrandingContext.Provider>
  );
}

export function useTenantBranding() {
  const ctx = useContext(TenantBrandingContext);
  if (!ctx) {
    throw new Error('useTenantBranding must be used within TenantBrandingProvider');
  }
  return ctx;
}
