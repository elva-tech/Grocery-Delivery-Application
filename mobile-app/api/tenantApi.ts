import { API_BASE_URL } from '@/src/config/constants';
import { getActiveTenantId } from '@/src/utils/tenantStorage';

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
  supportEmail?: string;
  supportPhone?: string;
  supportHours?: string;
}

/** Public GET /api/tenant/details — same contract as customer website. */
export async function fetchTenantDetails(): Promise<TenantDetails> {
  const tenantId = (await getActiveTenantId()).trim();
  if (!tenantId) {
    throw new Error('Tenant not configured');
  }

  const res = await fetch(`${API_BASE_URL.DEVELOPMENT}/api/tenant/details`, {
    headers: { 'x-tenant-id': tenantId },
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error('Invalid server response');
  }

  const body = data as { message?: string };

  if (!res.ok) {
    throw new Error(body?.message || 'Failed to fetch tenant details');
  }

  return data as TenantDetails;
}
