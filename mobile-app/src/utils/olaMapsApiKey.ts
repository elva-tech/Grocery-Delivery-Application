import { ACTIVE_API_URL } from '@/src/config/constants';

let cachedKey: string | null = null;
let inflight: Promise<string> | null = null;

function keyFromEnv(): string {
  return String(process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY || '').trim();
}

async function fetchKeyFromBackend(): Promise<string> {
  const base = String(ACTIVE_API_URL || '').trim().replace(/\/$/, '');
  if (!base) return '';

  const res = await fetch(`${base}/api/map/config`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return '';

  const data = (await res.json().catch(() => null)) as { apiKey?: string } | null;
  return String(data?.apiKey || '').trim();
}

/** Ola Maps tile SDK key — Expo env first, then backend GET /api/map/config. */
export async function getOlaMapsApiKey(): Promise<string> {
  const fromEnv = keyFromEnv();
  if (fromEnv) return fromEnv;
  if (cachedKey) return cachedKey;
  if (inflight) return inflight;

  inflight = fetchKeyFromBackend()
    .then(key => {
      cachedKey = key;
      return key;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
