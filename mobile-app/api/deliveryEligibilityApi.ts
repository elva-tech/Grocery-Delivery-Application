/**
 * Home / storefront delivery probe — mirrors website `website/src/api/deliveryEligibilityApi.ts` contract.
 */

import { fetchThresholdDistanceKm, resolveDeliveryDestinationPoints } from '@/api/mapDeliveryHelpers';
import { processSelectedLocation } from '@/api/mapService';

export type DeliveryEligibilityResponse = {
  address?: string;
  distance?: number;
  duration?: number;
  nearestPoint?: { id: string; lat: number; lng: number };
  isEligible?: boolean;
  eligible?: boolean;
  message?: string;
  mapLink?: string;
};

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

/** Does not throw when customer is outside radius — returns JSON with `isEligible: false`. */
export async function checkDeliveryEligibility(
  lat: number,
  lng: number,
  options?: { timeoutMs?: number },
): Promise<DeliveryEligibilityResponse> {
  const points = await resolveDeliveryDestinationPoints();
  if (!points.length) {
    throw new Error(
      'Store delivery hub is not configured. Set latitude/longitude for this tenant (super-admin / store admin), or EXPO_PUBLIC_STORE_LAT/LNG for local overrides.',
    );
  }

  const maxDistanceKm = await fetchThresholdDistanceKm();
  const raw = await processSelectedLocation(
    {
      lat,
      lng,
      points,
      config: {
        maxDistanceKm,
        enableEligibilityCheck: true,
      },
    },
    { timeoutMs: options?.timeoutMs ?? 24_000, rejectIfNotEligible: false },
  );

  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const merged = pickProcessMapLink(obj);
  const prev = typeof obj.mapLink === 'string' ? obj.mapLink.trim() : '';
  return {
    ...(raw && typeof raw === 'object' ? (raw as DeliveryEligibilityResponse) : {}),
    mapLink: merged || prev || '',
  };
}
