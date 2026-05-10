/**
 * Map service — browser CORS note:
 * https://ola-map-service.onrender.com does not send Access-Control-Allow-Origin, so the SPA must not
 * fetch it directly. In dev, Vite proxies same-origin paths below. In production, set
 * VITE_MAP_SERVICE_BASE_URL to your own backend path that proxies to the map service (or enable CORS on Render).
 *
 * Order when env is unset:
 * - DEV: /map-service-remote (Vite → Render) then /map-service (Vite → localhost:3000)
 * - PROD: direct Render URL then http://localhost:3000 (both often wrong without env — configure VITE_MAP_SERVICE_BASE_URL)
 */

export const REMOTE_MAP_SERVICE_URL = 'https://ola-map-service.onrender.com';

/** Vite dev proxy → REMOTE_MAP_SERVICE_URL */
const RENDER_DEV_PROXY_BASE = '/map-service-remote';
const LOCAL_DEV_PROXY_BASE = '/map-service';
const LOCAL_DIRECT_BASE = 'http://localhost:3000';

function normalizeBase(url) {
  return String(url || '')
    .trim()
    .replace(/\/$/, '');
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
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
  if (isDev) {
    return [RENDER_DEV_PROXY_BASE, LOCAL_DEV_PROXY_BASE];
  }
  return [normalizeBase(REMOTE_MAP_SERVICE_URL), LOCAL_DIRECT_BASE];
}

/**
 * @param {string} resourcePath Absolute path + optional query, e.g. /api/map/search?q=x
 * @param {RequestInit} [init]
 */
export async function fetchFromMapService(resourcePath, init) {
  const path = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`;
  const explicit = getExplicitMapServiceBaseUrl();
  if (explicit) {
    return fetch(`${explicit}${path}`, init);
  }

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
  const explicit = getExplicitMapServiceBaseUrl();
  if (explicit) return Promise.resolve(explicit);
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
  return Promise.resolve(isDev ? RENDER_DEV_PROXY_BASE : normalizeBase(REMOTE_MAP_SERVICE_URL));
}

export const MAP_SERVICE_BASE_URL = normalizeBase(REMOTE_MAP_SERVICE_URL);
