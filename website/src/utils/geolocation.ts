export type PreciseGeoResult = {
  lat: number;
  lng: number;
  /** Horizontal accuracy in metres (larger = less precise). */
  accuracyMeters: number;
};

/**
 * Request a fresh fix (no stale cache). Retries with lower accuracy if GPS times out
 * (common on desktop / weak GPS — network-assisted may still help vs failing outright).
 */
export function requestPrecisePosition(options?: {
  highAccuracyTimeoutMs?: number;
  fallbackTimeoutMs?: number;
}): Promise<PreciseGeoResult> {
  const highAccuracyTimeoutMs = options?.highAccuracyTimeoutMs ?? 15000;
  const fallbackTimeoutMs = options?.fallbackTimeoutMs ?? 12000;

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    const fromPosition = (pos: GeolocationPosition): PreciseGeoResult => ({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracyMeters: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : 0,
    });

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(fromPosition(pos)),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(err);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(fromPosition(pos)),
          (err2) => reject(err2),
          {
            enableHighAccuracy: false,
            maximumAge: 0,
            timeout: fallbackTimeoutMs,
          },
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: highAccuracyTimeoutMs,
      },
    );
  });
}

/** Fresh high-accuracy read; retries once if the first fix is still very coarse (>2km). */
export async function getAccurateLocation(
  options?: Parameters<typeof requestPrecisePosition>[0],
): Promise<PreciseGeoResult> {
  const first = await requestPrecisePosition(options);
  if (first.accuracyMeters > 2000) {
    return await requestPrecisePosition(options);
  }
  return first;
}
