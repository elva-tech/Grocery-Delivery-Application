import { API_BASE_URL } from '../config';

let cachedKey: string | null = null;
let inflight: Promise<string> | null = null;

function keyFromViteEnv(): string {
  const raw =
    (import.meta.env.VITE_OLA_MAPS_API_KEY as string | undefined) ||
    (import.meta.env.REACT_APP_OLA_MAPS_API_KEY as string | undefined) ||
    '';
  return String(raw).trim();
}

function apiOriginForConfig(): string {
  const fromEnv = String(API_BASE_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

async function fetchKeyFromBackend(): Promise<string> {
  const origin = apiOriginForConfig();
  if (!origin) return '';

  const res = await fetch(`${origin}/api/map/config`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return '';

  const data = (await res.json().catch(() => null)) as { apiKey?: string } | null;
  return String(data?.apiKey || '').trim();
}

/** Ola Maps tile SDK key — Vite env first, then backend /api/map/config. */
export async function getOlaMapsApiKey(): Promise<string> {
  const fromEnv = keyFromViteEnv();
  if (fromEnv) return fromEnv;
  if (cachedKey) return cachedKey;
  if (inflight) return inflight;

  inflight = fetchKeyFromBackend()
    .then((key) => {
      cachedKey = key;
      return key;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
