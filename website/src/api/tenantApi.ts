import { API_BASE_URL, getTenantId } from '../config';

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
  /** Store hub coordinates — sent as MapService `points[]` for delivery distance. */
  storeLat?: number | null;
  storeLng?: number | null;
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
  /** Shown on Contact Us when set; store owner fills in admin. */
  supportEmail?: string;
  supportPhone?: string;
  supportHours?: string;
  /** Optional Google Play / App Store URLs for website app download promo */
  androidAppLink?: string;
  iosAppLink?: string;
}

export async function fetchTenantDetails(): Promise<TenantDetails> {
  const res = await fetch(`${API_BASE_URL}/api/tenant/details`, {
    headers: { 'x-tenant-id': getTenantId() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch tenant details');
  return data as TenantDetails;
}
