import { API_BASE_URL } from '@/src/config/constants';
import { getActiveTenantId } from '@/src/utils/tenantStorage';

export type StorefrontCoupon = {
  code: string;
  description: string;
  discountSummary: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number | null;
  validTo: string;
  firstTimeUserOnly: boolean;
  applicableNow: boolean;
  blockedReason: string | null;
  blockedMessage: string | null;
};

export async function fetchStorefrontCoupons(
  cartSubtotal: number,
  token?: string | null,
): Promise<StorefrontCoupon[]> {
  const tenant = await getActiveTenantId();
  const headers: Record<string, string> = {
    'x-tenant-id': tenant,
  };
  if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`;
  const q = new URLSearchParams({ cartSubtotal: String(cartSubtotal) });
  const res = await fetch(`${API_BASE_URL.DEVELOPMENT}/api/coupons/public?${q}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'Could not load offers');
  const list = data?.coupons;
  return Array.isArray(list) ? list : [];
}
