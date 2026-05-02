import { API_BASE_URL, getTenantId } from '../config';

export interface TenantDetails {
  success?: boolean;
  tenantId: string;
  storeName: string;
  logo?: string;
  storeAddress?: string;
  contactEmail?: string;
  phoneNumber?: string;
  ownerName?: string;
  customerDomain?: string;
  adminDomain?: string;
  tagline?: string;
  heroBadge?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  plan?: string;
  status?: string;
  /** Shown on Contact Us when set; store owner fills in admin. */
  supportEmail?: string;
  supportPhone?: string;
  supportHours?: string;
}

export async function fetchTenantDetails(): Promise<TenantDetails> {
  const res = await fetch(`${API_BASE_URL}/api/tenant/details`, {
    headers: { 'x-tenant-id': getTenantId() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch tenant details');
  return data as TenantDetails;
}
