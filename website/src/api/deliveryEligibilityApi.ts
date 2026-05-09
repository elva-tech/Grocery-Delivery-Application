import { fetchSettings } from './settingsApi';
import { fetchTenantDetails } from './tenantApi';
import { fetchFromMapService } from '../constants/mapService.js';

export type DeliveryPoint = {
  id: string;
  lat: number;
  lng: number;
};

/** Dispatched after address save from map (Header modal) so App re-runs eligibility for pinned coords. */
export const WEBSITE_DELIVERY_COORDS_CHANGED = 'website-delivery-coords-changed';

export type DeliveryEligibilityResponse = {
  address: string;
  distance: number;
  duration: number;
  nearestPoint: {
    id: string;
    lat: number;
    lng: number;
  };
  isEligible: boolean;
  message: string;
  mapLink: string;
};

/** Cached tenant hubs — avoids hammering `/api/tenant/details` on every GPS tick. */
let _tenantPointsCache: { tenantId: string; points: DeliveryPoint[]; expires: number } | null = null;
const TENANT_POINTS_TTL_MS = 60_000;

/** Fallback when tenant has no hub: optional env-only hubs for dev/local tooling — never hardcoded coordinates. */
function pointsFromEnv(): DeliveryPoint[] {
  const pointsJson = import.meta.env.VITE_DELIVERY_POINTS_JSON as string | undefined;
  if (pointsJson) {
    try {
      const parsed = JSON.parse(pointsJson) as DeliveryPoint[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(
          (p) =>
            typeof p?.id === 'string' &&
            p.id.trim().length > 0 &&
            typeof p?.lat === 'number' &&
            typeof p?.lng === 'number',
        );
      }
    } catch {
      /* fall through */
    }
  }

  const lat = Number(import.meta.env.VITE_STORE_LAT);
  const lng = Number(import.meta.env.VITE_STORE_LNG);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return [{ id: 'STORE_ENV', lat, lng }];
  }

  return [];
}

function isValidCoord(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Resolves destination `points[]` for POST /api/map/process:
 * 1) Tenant `storeLat` / `storeLng` from GET `/api/tenant/details` (source of truth)
 * 2) Else optional env overrides `VITE_DELIVERY_POINTS_JSON` or `VITE_STORE_LAT` / `VITE_STORE_LNG`
 */
export async function resolveDeliveryDestinationPoints(): Promise<DeliveryPoint[]> {
  const now = Date.now();
  const tid =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_TENANT_ID
      ? String(import.meta.env.VITE_TENANT_ID).trim().toLowerCase()
      : '';

  if (_tenantPointsCache && tid && _tenantPointsCache.tenantId === tid && now < _tenantPointsCache.expires) {
    if (_tenantPointsCache.points.length > 0) return _tenantPointsCache.points;
  }

  try {
    const tenant = await fetchTenantDetails();
    const lat =
      typeof tenant.storeLat === 'number' && Number.isFinite(tenant.storeLat) ? tenant.storeLat : null;
    const lng =
      typeof tenant.storeLng === 'number' && Number.isFinite(tenant.storeLng) ? tenant.storeLng : null;

    if (lat !== null && lng !== null && isValidCoord(lat, lng)) {
      const hubId = `STORE_${String(tenant.tenantId || 'main').replace(/\s+/g, '_')}`;
      const points = [{ id: hubId, lat, lng }];
      _tenantPointsCache = { tenantId: tid || tenant.tenantId || '', points, expires: now + TENANT_POINTS_TTL_MS };
      return points;
    }
  } catch {
    /* fall through to env */
  }

  const fromEnv = pointsFromEnv();
  _tenantPointsCache = { tenantId: tid, points: fromEnv, expires: now + TENANT_POINTS_TTL_MS };
  return fromEnv;
}

/** Map `/process` bodies vary by deployment — merge known keys into `mapLink` for checkout → `addressUrl`. */
function pickProcessMapLink(raw: Record<string, unknown>): string {
  const keys = [
    'mapLink',
    'map_link',
    'mapsUrl',
    'maps_url',
    'directionsUrl',
    'directions_url',
    'mapUrl',
    'map_url',
  ];
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export async function checkDeliveryEligibility(
  lat: number,
  lng: number,
): Promise<DeliveryEligibilityResponse> {
  const settings = await fetchSettings();
  const points = await resolveDeliveryDestinationPoints();

  if (points.length === 0) {
    throw new Error(
      'Store delivery hub is not configured. Set latitude/longitude for this tenant (super-admin onboarding or store admin Store profile), or use VITE_DELIVERY_POINTS_JSON / VITE_STORE_LAT+LNG for local overrides.',
    );
  }

  if (import.meta.env.DEV) {
    console.debug('[delivery eligibility] POST /api/map/process via /map-service-remote then /map-service', {
      lat,
      lng,
    });
  }

  /** Contract: origin = customer (lat,lng), destinations = store hub(s) in points[]. */
  const res = await fetchFromMapService('/api/map/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      lat,
      lng,
      points,
      config: {
        maxDistanceKm: Number(settings.thresholdDistance ?? 10),
        enableEligibilityCheck: true,
      },
    }),
  });

  if (!res.ok) {
    const errorPayload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorPayload?.error || 'Delivery eligibility check failed');
  }

  const body = (await res.json()) as Record<string, unknown> | DeliveryEligibilityResponse;
  const obj = body && typeof body === 'object' ? body : {};
  const merged = pickProcessMapLink(obj as Record<string, unknown>);
  const prev =
    typeof (obj as DeliveryEligibilityResponse).mapLink === 'string'
      ? (obj as DeliveryEligibilityResponse).mapLink.trim()
      : '';
  return {
    ...(obj as DeliveryEligibilityResponse),
    mapLink: merged || prev || '',
  };
}
