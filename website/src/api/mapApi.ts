import { fetchFromMapService } from '../constants/mapService.js';

export type PlaceSuggestion = { id: string; name: string; lat: number; lng: number };

type SearchOptions = { signal?: AbortSignal };

/**
 * Autocomplete search via MapService (GET /api/map/search).
 * Returns [] when query trimmed length &lt; 3 (caller should debounce).
 */
export async function searchPlaces(
  query: string,
  options: SearchOptions = {},
): Promise<PlaceSuggestion[]> {
  const q = String(query ?? '').trim();
  if (q.length < 3) return [];

  const params = new URLSearchParams({ q });
  const res = await fetchFromMapService(`/api/map/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal: options.signal,
  });

  if (res.status === 400) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Bad request');
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as PlaceSuggestion[]) : [];
}

export async function processSelectedLocation(payload: unknown): Promise<unknown> {
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
      const data = (await response.json()) as { error?: string };
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
