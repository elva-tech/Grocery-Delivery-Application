import { API_BASE_URL } from '../config';
import { fetchFromMapService } from '../constants/mapService';

let cachedKey: string | null = null;
let inflight: Promise<string> | null = null;

function keyFromViteEnv(): string {
  const raw =
    (import.meta.env.VITE_OLA_MAPS_API_KEY as string | undefined) ||
    (import.meta.env.REACT_APP_OLA_MAPS_API_KEY as string | undefined) ||
    '';
  return String(raw).trim();
}

async function fetchKeyFromBackend(): Promise<string> {
  const res = await fetchFromMapService('/api/map/config', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return '';

  const data = (await res.json().catch(() => null)) as { apiKey?: string } | null;
  return String(data?.apiKey || '').trim();
}

/** Ola Maps tile SDK key — Vite env first, then backend GET /api/map/config. */
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

/** For diagnostics — whether a key is configured at build time. */
export function hasOlaMapsKeyInBuild(): boolean {
  return Boolean(keyFromViteEnv());
}

/** Backend API origin used for map config fallback (empty if unset). */
export function mapConfigApiOrigin(): string {
  return String(API_BASE_URL || '').trim().replace(/\/$/, '');
}
