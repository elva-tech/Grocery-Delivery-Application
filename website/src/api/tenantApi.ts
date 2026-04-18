import { API_BASE_URL, TENANT_ID } from '../config';

export interface TenantDetails {
  tenantId: string;
  storeName: string;
  logo: string;
  storeAddress: string;
  contactEmail: string;
  phoneNumber: string;
}

export async function fetchTenantDetails(): Promise<TenantDetails> {
  const res = await fetch(`${API_BASE_URL}/api/tenant/details`, {
    headers: { 'x-tenant-id': TENANT_ID },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch tenant details');
  return data as TenantDetails;
}
