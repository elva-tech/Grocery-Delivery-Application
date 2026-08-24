import { ACTIVE_API_URL } from '@/src/config/constants';
import { getActiveTenantId } from '@/src/utils/tenantStorage';

export interface TenantStoreAddressParts {
  line1?: string;
  line2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface TenantDetails {
  success?: boolean;
  tenantId: string;
  storeName: string;
  logo?: string;
  storeAddress?: string;
  storeAddressParts?: TenantStoreAddressParts;
  contactEmail?: string;
  phoneNumber?: string;
  ownerName?: string;
  /** Same value as ownerName; preferred for customer-facing UI. */
  legalName?: string;
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
  /** Store hub for map distance / delivery eligibility */
  storeLat?: number | null;
  storeLng?: number | null;
}

/** Public GET /api/tenant/details — same contract as customer website. */
export async function fetchTenantDetails(): Promise<TenantDetails> {
  const tenantId = (await getActiveTenantId()).trim();
  if (!tenantId) {
    throw new Error('Tenant not configured');
  }

  const res = await fetch(`${ACTIVE_API_URL}/api/tenant/details`, {
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
