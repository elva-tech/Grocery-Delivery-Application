/**
 * Resolves store hub `points[]` + delivery radius for POST /api/map/process (aligned with website).
 * Order: tenant `storeLat`/`storeLng` from GET `/api/tenant/details` → optional Expo env overrides only.
 */

import { ACTIVE_API_URL } from '@/src/config/constants';
import { getActiveTenantId } from '@/src/utils/tenantStorage';
import { fetchTenantDetails } from '@/api/tenantApi';

export type DeliveryPoint = {
  id: string;
  lat: number;
  lng: number;
};

function isValidCoord(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** Accept backend numbers or numeric strings (defensive). */
function parseHubPair(latRaw: unknown, lngRaw: unknown): { lat: number; lng: number } | null {
  if (latRaw == null || lngRaw == null) return null;
  const lat = typeof latRaw === 'number' ? latRaw : Number(String(latRaw).trim());
  const lng = typeof lngRaw === 'number' ? lngRaw : Number(String(lngRaw).trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!isValidCoord(lat, lng)) return null;
  return { lat, lng };
}

/**
 * When tenant has no hub in DB: optional `EXPO_PUBLIC_*` overrides for local/dev — never hardcoded coordinates.
 */
export function pointsFromExpoEnv(): DeliveryPoint[] {
  const pointsJson = process.env.EXPO_PUBLIC_DELIVERY_POINTS_JSON?.trim();
  if (pointsJson) {
    try {
      const parsed = JSON.parse(pointsJson) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const filtered = parsed.filter(
          (p): p is DeliveryPoint =>
            typeof (p as DeliveryPoint)?.id === 'string' &&
            String((p as DeliveryPoint).id).trim().length > 0 &&
            typeof (p as DeliveryPoint)?.lat === 'number' &&
            typeof (p as DeliveryPoint)?.lng === 'number',
        );
        if (filtered.length > 0) return filtered;
      }
    } catch {
      /* fall through */
    }
  }

  const lat = Number(process.env.EXPO_PUBLIC_STORE_LAT);
  const lng = Number(process.env.EXPO_PUBLIC_STORE_LNG);
  if (Number.isFinite(lat) && Number.isFinite(lng) && isValidCoord(lat, lng)) {
    return [{ id: 'STORE_ENV', lat, lng }];
  }

  return [];
}

/** Cached briefly to avoid duplicate tenant calls when confirming map + eligibility flows expand later. */
let tenantHubCache: { tenantId: string; points: DeliveryPoint[]; expires: number } | null = null;
const TTL_MS = 60_000;

export async function resolveDeliveryDestinationPoints(): Promise<DeliveryPoint[]> {
  const tid = (await getActiveTenantId()).trim().toLowerCase();
  const now = Date.now();
  if (tenantHubCache && tenantHubCache.tenantId === tid && now < tenantHubCache.expires && tenantHubCache.points.length > 0) {
    return tenantHubCache.points;
  }

  try {
    const tenant = await fetchTenantDetails();
    const pair = parseHubPair(tenant.storeLat, tenant.storeLng);
    if (pair) {
      const hubId = `STORE_${String(tenant.tenantId || 'main').replace(/\s+/g, '_')}`;
      const points = [{ id: hubId, lat: pair.lat, lng: pair.lng }];
      tenantHubCache = { tenantId: tid, points, expires: now + TTL_MS };
      return points;
    }
  } catch {
    /* fall through to env */
  }

  const fromEnv = pointsFromExpoEnv();
  tenantHubCache = { tenantId: tid, points: fromEnv, expires: now + TTL_MS };
  return fromEnv;
}

/** Avoid indefinite hangs when the main API never responds (bad network / VPN). */
export async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let tid: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    tid = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (tid !== undefined) clearTimeout(tid);
  }
}

export async function fetchThresholdDistanceKm(): Promise<number> {
  try {
    const res = await fetch(`${ACTIVE_API_URL}/api/settings`, {
      headers: { 'x-tenant-id': await getActiveTenantId() },
    });
    if (!res.ok) return 10;
    const s = (await res.json()) as { thresholdDistance?: number };
    const n = Number(s.thresholdDistance);
    return Number.isFinite(n) && n > 0 ? n : 10;
  } catch {
    return 10;
  }
}
