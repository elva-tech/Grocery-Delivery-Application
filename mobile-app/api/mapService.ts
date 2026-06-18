/**
 * Map microservice (GET /api/map/search, POST /api/map/process).
 * Default: grocery backend /api/map/* proxy (no CORS, same as customer website).
 */

import { ACTIVE_API_URL } from '@/src/config/constants';

export const REMOTE_MAP_SERVICE_URL = 'https://ola-map-service.onrender.com';

const LOCAL_MAP_FALLBACK = 'http://localhost:3000';

export type PlaceSuggestion = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type MapProcessPayload = {
  lat: number;
  lng: number;
  points: { id: string; lat: number; lng: number }[];
  config: {
    maxDistanceKm: number;
    enableEligibilityCheck: boolean;
  };
};

/** Success body from POST /api/map/process when `enableEligibilityCheck` is true (see website delivery eligibility). */
export type MapProcessEligibilityBody = {
  isEligible?: boolean;
  eligible?: boolean;
  message?: string;
};

function normalizeBase(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function getExplicitBase(): string | null {
  const raw = process.env.EXPO_PUBLIC_MAP_SERVICE_URL?.trim();
  if (!raw) return null;
  return normalizeBase(raw);
}

function defaultBaseChain(): string[] {
  const explicit = getExplicitBase();
  if (explicit) return [explicit];

  const backend = normalizeBase(ACTIVE_API_URL);
  if (backend) {
    return [backend, normalizeBase(REMOTE_MAP_SERVICE_URL), normalizeBase(LOCAL_MAP_FALLBACK)];
  }

  return [normalizeBase(REMOTE_MAP_SERVICE_URL), normalizeBase(LOCAL_MAP_FALLBACK)];
}

function throwIfAborted(signal: AbortSignal | undefined | null): void {
  if (!signal?.aborted) return;
  const err = new Error('Aborted');
  err.name = 'AbortError';
  throw err;
}

async function fetchFromMapService(resourcePath: string, init?: RequestInit): Promise<Response> {
  const path = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`;
  const signal = init?.signal;

  throwIfAborted(signal);

  const bases = defaultBaseChain();
  let lastNonOk: Response | null = null;

  for (const base of bases) {
    try {
      throwIfAborted(signal);
      const res = await fetch(`${base}${path}`, init);
      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500) return res;
      lastNonOk = res;
    } catch (e) {
      const name = (e as Error)?.name;
      if (name === 'AbortError') throw e;
    }
  }

  if (lastNonOk) return lastNonOk;
  return fetch(`${bases[bases.length - 1]}${path}`, init);
}

/** GET /api/map/search — debounce & q.length >= 3 at call sites. */
export async function searchPlaces(query: string, options?: { signal?: AbortSignal }): Promise<PlaceSuggestion[]> {
  const q = String(query ?? '').trim();
  if (q.length < 3) return [];

  const params = new URLSearchParams({ q });
  const res = await fetchFromMapService(`/api/map/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal: options?.signal,
  });

  if (res.status === 400) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Bad request');
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** POST /api/map/process */
export async function processSelectedLocation(
  payload: MapProcessPayload,
  options?: { timeoutMs?: number; /** Default true — set false for probes that need `isEligible: false` in the JSON body. */ rejectIfNotEligible?: boolean },
): Promise<unknown> {
  const timeoutMs = options?.timeoutMs ?? 28_000;
  const rejectIfNotEligible = options?.rejectIfNotEligible !== false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const response = await fetchFromMapService('/api/map/process', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });

    if (!response.ok) {
      let errorMessage = 'Failed to process location';
      try {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (data?.error) errorMessage = data.error;
      } catch {
        /* ignore */
      }
      throw new Error(errorMessage);
    }

    const text = await response.text();
    if (!text.trim()) return {};

    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      return {};
    }

    if (
      rejectIfNotEligible &&
      payload.config.enableEligibilityCheck !== false &&
      data &&
      typeof data === 'object'
    ) {
      const o = data as MapProcessEligibilityBody;
      const eligible =
        typeof o.isEligible === 'boolean'
          ? o.isEligible
          : typeof o.eligible === 'boolean'
            ? o.eligible
            : undefined;
      if (eligible === false) {
        const raw =
          typeof o.message === 'string' && o.message.trim().length > 0
            ? o.message.trim()
            : 'Delivery is not available at this location.';
        throw new Error(raw);
      }
    }

    return data;
  } catch (e: unknown) {
    const name = (e as Error)?.name;
    if (name === 'AbortError') {
      throw new Error('Location check timed out. Check your internet and try again.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Same as {@link processSelectedLocation}; kept for imports that use this name. */
export const processMapProcess = processSelectedLocation;
