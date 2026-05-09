import { fetchFromMapService } from '../constants/mapService.js';

/**
 * @typedef {{ id: string; name: string; lat: number; lng: number }} PlaceSuggestion
 */

/**
 * Autocomplete search via MapService (GET /api/map/search).
 * Returns [] when query trimmed length &lt; 3 (caller should debounce).
 * @param {string} query
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<PlaceSuggestion[]>}
 */
export async function searchPlaces(query, options = {}) {
  const q = String(query ?? '').trim();
  if (q.length < 3) return [];

  const params = new URLSearchParams({ q });
  const res = await fetchFromMapService(`/api/map/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal: options.signal,
  });

  if (res.status === 400) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Bad request');
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function processSelectedLocation(payload) {
  const response = await fetchFromMapService('/api/map/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to process location';
    try {
      const data = await response.json();
      if (data?.error) {
        errorMessage = data.error;
      }
    } catch {
      // Keep generic fallback if non-JSON error response.
    }
    throw new Error(errorMessage);
  }

  return response.json();
}
