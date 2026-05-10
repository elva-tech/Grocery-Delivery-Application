import axios from 'axios';
import { API_BASE_URL, getTenantId } from '../config';

const URL = `${API_BASE_URL}/api/coupons/public`;

export interface StorefrontCoupon {
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
}

/** Active coupons for the tenant; optional login improves first-order eligibility. */
export async function fetchStorefrontCoupons(cartSubtotal: number): Promise<StorefrontCoupon[]> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'x-tenant-id': getTenantId(),
  };
  if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`;
  const res = await axios.get<{ coupons: StorefrontCoupon[] }>(URL, {
    headers,
    params: { cartSubtotal },
  });
  return Array.isArray(res.data?.coupons) ? res.data.coupons : [];
}
