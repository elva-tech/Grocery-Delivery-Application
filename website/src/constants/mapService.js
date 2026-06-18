/**
 * Map service routing.
 * Production browsers must not call ola-map-service.onrender.com directly (no CORS).
 * Default: grocery backend GET/POST /api/map/* (server-side proxy).
 * Dev fallbacks: Vite /map-service-remote → Render, then /map-service → localhost:3000.
 */

export const REMOTE_MAP_SERVICE_URL = 'https://ola-map-service.onrender.com';

const RENDER_DEV_PROXY_BASE = '/map-service-remote';
const LOCAL_DEV_PROXY_BASE = '/map-service';

function normalizeBase(url) {
  return String(url || '')
    .trim()
    .replace(/\/$/, '');
}

function getBackendApiBaseUrl() {
  const raw =
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL)) ||
    '';
  const trimmed = normalizeBase(raw);
  if (trimmed) return trimmed;

  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalizeBase(window.location.origin);
  }
  return '';
}

function getExplicitMapServiceBaseUrl() {
  const raw =
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.VITE_MAP_SERVICE_BASE_URL ||
        import.meta.env.REACT_APP_MAP_SERVICE_BASE_URL)) ||
    '';
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) {
    return normalizeBase(trimmed) || LOCAL_DEV_PROXY_BASE;
  }
  return normalizeBase(trimmed);
}

function defaultBaseChain() {
  const explicit = getExplicitMapServiceBaseUrl();
  if (explicit) return [explicit];

  const backend = getBackendApiBaseUrl();
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

  if (backend) {
    if (isDev) {
      return [backend, RENDER_DEV_PROXY_BASE, LOCAL_DEV_PROXY_BASE];
    }
    return [backend];
  }

  if (isDev) {
    return [RENDER_DEV_PROXY_BASE, LOCAL_DEV_PROXY_BASE];
  }

  return [normalizeBase(REMOTE_MAP_SERVICE_URL)];
}

/**
 * @param {string} resourcePath Absolute path + optional query, e.g. /api/map/search?q=x
 * @param {RequestInit} [init]
 */
export async function fetchFromMapService(resourcePath, init) {
  const path = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`;
  const bases = defaultBaseChain();
  /** @type {Response | null} */
  let lastNonOk = null;

  for (let i = 0; i < bases.length; i += 1) {
    const base = bases[i];
    try {
      const res = await fetch(`${normalizeBase(base)}${path}`, init);
      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500) return res;
      lastNonOk = res;
    } catch {
      /* CORS, network, offline target */
    }
  }

  if (lastNonOk) return lastNonOk;
  return fetch(`${normalizeBase(bases[bases.length - 1])}${path}`, init);
}

/** For logging only — first hop in the default chain. */
export function resolveMapServiceBaseUrl() {
  const bases = defaultBaseChain();
  return Promise.resolve(bases[0] || normalizeBase(REMOTE_MAP_SERVICE_URL));
}

export const MAP_SERVICE_BASE_URL = normalizeBase(REMOTE_MAP_SERVICE_URL);
