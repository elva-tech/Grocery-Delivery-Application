import { API_BASE_URL } from '@/src/config/constants';
import { getActiveTenantId } from '@/src/utils/tenantStorage';

/** Matches backend Banner documents returned from GET /api/banners (same as customer website). */
export type BannerRecord = {
  _id: string;
  id?: string;
  title?: string;
  imageUrl?: string;
  image?: string;
  imagePublicId?: string;
  tenantId?: string;
  isActive?: boolean;
};

/**
 * GET /api/banners — same contract as website `getBanners` (returns `response.data`, i.e. `payload.data`).
 */
export async function fetchBanners(): Promise<BannerRecord[]> {
  const tenantId = (await getActiveTenantId()).trim();
  if (!tenantId) {
    throw new Error('Tenant not configured');
  }

  const res = await fetch(`${API_BASE_URL.DEVELOPMENT}/api/banners`, {
    headers: { 'x-tenant-id': tenantId },
  });

  let body: { success?: boolean; message?: string; data?: BannerRecord[] };
  try {
    body = await res.json();
  } catch {
    throw new Error('Invalid server response');
  }

  if (!res.ok) {
    throw new Error(body?.message || 'Failed to fetch banners');
  }

  const list = body.data;
  if (!Array.isArray(list)) return [];
  return list;
}
