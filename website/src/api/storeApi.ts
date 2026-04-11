import axios from 'axios';
import { API_BASE_URL, TENANT_ID } from '../config';

export interface StoreStatusResponse {
  isOpen: boolean;
  reason?: string;
  nextChange?: string | null;
  store?: {
    isOpen?: boolean;
    manualOverride?: boolean;
    schedule?: {
      openTime?: string | null;
      closeTime?: string | null;
    };
  };
}

const getTenantId = () => {
  const token = localStorage.getItem('token');

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload?.tenantId) {
        return payload.tenantId as string;
      }
    } catch {
      // Ignore malformed tokens and fall back to configured tenant.
    }
  }

  return TENANT_ID;
};

export const fetchStoreStatus = async (): Promise<StoreStatusResponse> => {
  const token = localStorage.getItem('token');
  const res = await axios.get(`${API_BASE_URL}/api/store/status`, {
    headers: {
      'x-tenant-id': getTenantId(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return res.data as StoreStatusResponse;
};