import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import { apiSlice } from '@/api/apiSlice';
import { ACTIVE_API_URL } from '@/src/config/constants';
import { getActiveTenantId } from '@/src/utils/tenantStorage';
import { logout } from '@/store/slices/authSlice';
import { clearCart } from '@/store/slices/cartSlice';
import { store } from '@/store/store';

// NOTE: Must stay in sync with `src/utils/customerLocalStorage.ts` for wipe-on-logout.
const ADDRESSES_KEY = '@enandi_addresses';
const PREFERRED_DELIVERY_ADDRESS_ID_KEY = '@enandi_preferred_delivery_address_id';

/** Per-user+tenant one-shot legacy migration; must match `customerLocalStorage` wipe prefix. */
const ADDRESS_CLOUD_MIGRATION_KEY_PREFIX = '@enandi_addr_cloud_mig_';

const COUNTRY_CODE = '+91';

function getAuthToken(): string | null {
  try {
    return (store.getState() as { auth?: { token?: string } }).auth?.token ?? null;
  } catch {
    return null;
  }
}

function getAuthUserId(): string | null {
  try {
    const id = (store.getState() as { auth?: { user?: { id?: string } } }).auth?.user?.id;
    return id != null ? String(id).trim() : null;
  } catch {
    return null;
  }
}

async function addressesAuthHeaders(): Promise<HeadersInit> {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-tenant-id': await getActiveTenantId(),
    'x-platform': 'mobile',
  };
}

/**
 * Backend returns 401 with messages like "jwt expired" / "Invalid or expired token" when the
 * stored JWT is stale. We can't refresh silently (no refresh-token flow), so the only safe path
 * is: wipe the bad token, reset RTK Query cache, and surface a "Session expired" error that the
 * UI can show via its existing toast. Auth-gated screens will route back to login on next render
 * because `isAuthenticated` flips to false.
 */
let sessionExpiredHandledAt = 0;
async function handleAuthExpired(): Promise<void> {
  const now = Date.now();
  if (now - sessionExpiredHandledAt < 1000) return;
  sessionExpiredHandledAt = now;
  try {
    await AsyncStorage.multiRemove(['token', 'user', 'jwtToken']);
  } catch {
    /* ignore */
  }
  try {
    store.dispatch(logout());
    store.dispatch(clearCart());
    store.dispatch(apiSlice.util.resetApiState());
  } catch {
    /* ignore */
  }
}

function isAuthExpiredResponse(status: number, body: any): boolean {
  if (status !== 401) return false;
  const msg = String(body?.message || '').toLowerCase();
  return (
    msg.includes('expired') ||
    msg.includes('invalid') ||
    msg.includes('token missing') ||
    msg.includes('unauthorized')
  );
}

async function migrationDoneKey(): Promise<string | null> {
  const uid = getAuthUserId();
  const tenantId = String(await getActiveTenantId()).trim();
  if (!uid || !tenantId) return null;
  return `${ADDRESS_CLOUD_MIGRATION_KEY_PREFIX}${tenantId}_${uid}`;
}

/** Backend stores `_id`; UI expects `id`. */
function normalizeServerAddress(doc: any): any {
  if (!doc || typeof doc !== 'object') return doc;
  const id = doc._id != null ? String(doc._id) : String(doc.id ?? '');
  return { ...doc, id };
}

function addressToServerPayload(address: any): Record<string, unknown> {
  const rawPhone = String(address.phone ?? '').trim();
  const digits = rawPhone.replace(/\D/g, '').slice(-10);
  const phone = digits ? `${COUNTRY_CODE} ${digits}` : rawPhone;

  const altRaw = address.altPhone != null ? String(address.altPhone).trim() : '';
  const altDigits = altRaw.replace(/\D/g, '').slice(-10);
  const altPhone = altDigits ? `${COUNTRY_CODE} ${altDigits}` : '';

  return {
    label: String(address.label ?? '').trim(),
    line1: String(address.line1 ?? '').trim(),
    line2: String(address.line2 ?? '').trim(),
    landmark: String(address.landmark ?? '').trim(),
    city: String(address.city ?? '').trim(),
    state: String(address.state ?? '').trim(),
    pincode: String(address.pincode ?? '').trim(),
    phone,
    altPhone,
    recipientName: String(address.recipientName ?? '').trim(),
    recipientPhone: String(address.recipientPhone ?? '').trim(),
    full: String(address.full ?? '').trim(),
    lat: Number.isFinite(Number(address.lat)) ? Number(address.lat) : 0,
    lng: Number.isFinite(Number(address.lng)) ? Number(address.lng) : 0,
    isMyAddress: address.isMyAddress !== undefined ? Boolean(address.isMyAddress) : true,
  };
}

async function persistLocalSnapshot(list: any[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ADDRESSES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

async function readCachedAddresses(): Promise<any[]> {
  try {
    const json = await AsyncStorage.getItem(ADDRESSES_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

async function fetchAddressesRemote(token: string): Promise<any[]> {
  const res = await fetch(`${ACTIVE_API_URL}/api/addresses/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'x-tenant-id': await getActiveTenantId(),
      'x-platform': 'mobile',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (isAuthExpiredResponse(res.status, data)) {
      await handleAuthExpired();
      throw Object.assign(new Error('Session expired. Please login again.'), { code: 'AUTH_EXPIRED' });
    }
    throw new Error(data?.message || 'Could not load addresses');
  }
  const raw = data.addresses ?? [];
  return Array.isArray(raw) ? raw.map(normalizeServerAddress) : [];
}

/** One-shot upload of pre-cloud AsyncStorage addresses when the server list is still empty. */
async function migrateLegacyLocalAddressesOnce(token: string): Promise<void> {
  const migKey = await migrationDoneKey();
  if (!migKey) return;
  if ((await AsyncStorage.getItem(migKey)) === '1') return;

  const local = await readCachedAddresses();
  if (!Array.isArray(local) || local.length === 0) {
    await AsyncStorage.setItem(migKey, '1');
    return;
  }

  const headers = await addressesAuthHeaders();
  for (const addr of local) {
    const payload = addressToServerPayload(addr);
    if (!payload.line1 || !payload.landmark || !payload.phone) continue;
    try {
      await fetch(`${ACTIVE_API_URL}/api/addresses`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    } catch {
      /* ignore per row */
    }
  }
  await AsyncStorage.setItem(migKey, '1');
}

/**
 * Load saved addresses: primary copy is the API (per user + tenant on the server).
 * Local snapshot is a cache for offline and fast paint; never replace with an empty list until migration ran.
 */
async function loadAddressesAuthenticated(token: string): Promise<any[]> {
  try {
    let remote = await fetchAddressesRemote(token);

    if (remote.length === 0) {
      await migrateLegacyLocalAddressesOnce(token);
      remote = await fetchAddressesRemote(token);
    }

    if (remote.length > 0) {
      await persistLocalSnapshot(remote);
      return remote;
    }

    return await readCachedAddresses();
  } catch {
    return await readCachedAddresses();
  }
}

/** Emit after preferred delivery address changes (home listens). */
export const PREFERRED_DELIVERY_ADDRESS_CHANGED = 'preferred-delivery-address-changed';

export async function getPreferredDeliveryAddressId(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(PREFERRED_DELIVERY_ADDRESS_ID_KEY);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

export async function setPreferredDeliveryAddressId(id: string | null): Promise<void> {
  try {
    if (!id || !String(id).trim()) await AsyncStorage.removeItem(PREFERRED_DELIVERY_ADDRESS_ID_KEY);
    else await AsyncStorage.setItem(PREFERRED_DELIVERY_ADDRESS_ID_KEY, String(id).trim());
  } catch {
    /* ignore */
  }
}

/** Saved address shown on home / checkout: explicit preference, else default flag, else first. */
export async function pickPreferredSavedAddress(list: unknown[]): Promise<any | null> {
  if (!Array.isArray(list) || list.length === 0) return null;
  const prefId = await getPreferredDeliveryAddressId();
  if (prefId) {
    const m = list.find((a: any) => a && String(a.id) === prefId);
    if (m) return m;
  }
  const def = list.find((a: any) => a?.isDefault);
  return def || list[0] || null;
}

const makeKey = (address: any) =>
  `${address.label?.trim()}|${address.line1?.trim() || address.full?.trim()}|${address.pincode?.trim() || ''}|${address.phone?.trim()}`;

export type ReverseAddress = {
  line1: string;
  city: string;
  state: string;
  pincode: string;
};

const OLA_MAPS_API_KEY = (process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY || '').trim();

/**
 * Ola forward-geocode for an Indian address string.
 *
 * Used when the customer types an address manually and never opens the map picker — without
 * this, `Location.geocodeAsync(pincode)` returns the centroid of the PIN area which is often
 * several kilometres from the real spot and trips the delivery radius gate.
 */
export async function forwardGeocodeViaOla(
  query: string,
  signal?: AbortSignal,
): Promise<{ lat: number; lng: number } | null> {
  const q = String(query || '').trim();
  if (!OLA_MAPS_API_KEY || !q) return null;
  try {
    const url = `https://api.olamaps.io/places/v1/geocode?address=${encodeURIComponent(q)}&api_key=${encodeURIComponent(OLA_MAPS_API_KEY)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
    if (!res.ok) return null;
    const data: any = await res.json().catch(() => null);
    const list: any[] = Array.isArray(data?.geocodingResults)
      ? data.geocodingResults
      : Array.isArray(data?.results)
        ? data.results
        : [];
    const first = list.length > 0 ? list[0] : null;
    const loc = first?.geometry?.location ?? first?.location ?? null;
    if (!loc) return null;
    const lat = Number(loc.lat);
    const lng = Number(loc.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat === 0 && lng === 0) return null;
    return { lat, lng };
  } catch (error: any) {
    if (error?.name === 'AbortError') throw error;
    return null;
  }
}

/**
 * Ola reverse-geocode REST endpoint. Returns a fresh server-side address on every call,
 * unlike `Location.reverseGeocodeAsync` (Android) which is offline and returns coarse
 * results that change very little across a few hundred metres of panning.
 */
async function reverseGeocodeViaOla(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ReverseAddress | null> {
  if (!OLA_MAPS_API_KEY) return null;
  try {
    const url = `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${encodeURIComponent(OLA_MAPS_API_KEY)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
    if (!res.ok) return null;
    const data: any = await res.json().catch(() => null);
    const first = Array.isArray(data?.results) && data.results.length > 0 ? data.results[0] : null;
    if (!first) return null;

    const formatted = String(first.formatted_address || '').trim();
    const components: any[] = Array.isArray(first.address_components) ? first.address_components : [];

    const pickByType = (type: string): string => {
      const hit = components.find((c) => Array.isArray(c?.types) && c.types.includes(type));
      return hit ? String(hit.long_name || hit.short_name || '').trim() : '';
    };

    const city =
      pickByType('locality') ||
      pickByType('administrative_area_level_3') ||
      pickByType('sublocality') ||
      pickByType('sublocality_level_1') ||
      '';
    const state = pickByType('administrative_area_level_1');
    const pincode = (pickByType('postal_code') || '').replace(/\D/g, '').slice(0, 6);
    const line1 = formatted || first.name || 'Unknown Location';

    return { line1, city, state, pincode };
  } catch (error: any) {
    if (error?.name === 'AbortError') throw error;
    return null;
  }
}

async function reverseGeocodeViaExpo(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ReverseAddress> {
  if (signal?.aborted) {
    return { line1: '', city: '', state: '', pincode: '' };
  }
  const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
  if (signal?.aborted) {
    return { line1: '', city: '', state: '', pincode: '' };
  }
  if (!result || result.length === 0) {
    return { line1: 'Address not found', city: '', state: '', pincode: '' };
  }

  const addr = result[0];
  const streetLine = [addr.streetNumber, addr.street].filter(Boolean).join(' ').trim();
  const parts = [
    streetLine || undefined,
    addr.district,
    addr.subregion,
    addr.city,
    addr.postalCode,
  ].filter((part) => part && part !== 'null' && part !== 'undefined' && part !== '');
  const line1Core = parts.length > 0 ? parts.join(', ') : '';
  const line1 =
    line1Core ||
    (addr.name && String(addr.name).trim() && String(addr.name).trim() !== 'null'
      ? String(addr.name).trim()
      : 'Unknown Location');

  return {
    line1,
    city: String(addr.city || addr.subregion || '').trim(),
    state: String(addr.region || '').trim(),
    pincode: String(addr.postalCode || '').replace(/\D/g, '').slice(0, 6),
  };
}

export const getAddressFromCoordsDetailed = async (
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ReverseAddress> => {
  if (signal?.aborted) {
    return { line1: '', city: '', state: '', pincode: '' };
  }
  try {
    const ola = await reverseGeocodeViaOla(lat, lng, signal);
    if (ola && ola.line1 && ola.line1 !== 'Unknown Location') {
      return ola;
    }
    return await reverseGeocodeViaExpo(lat, lng, signal);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { line1: '', city: '', state: '', pincode: '' };
    }
    return { line1: 'Error fetching address', city: '', state: '', pincode: '' };
  }
};

export const getAddressFromCoords = async (lat: number, lng: number, signal?: AbortSignal) => {
  const detailed = await getAddressFromCoordsDetailed(lat, lng, signal);
  return detailed.line1;
};

export const getAddresses = async (): Promise<any[]> => {
  try {
    const json = await AsyncStorage.getItem(ADDRESSES_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
};

export const addAddress = async (address: any): Promise<any> => {
  const token = getAuthToken();

  const existing = token ? await getAddresses() : await readCachedAddresses();
  const key = makeKey(address);
  if (existing.some((a: any) => makeKey(a) === key)) {
    throw Object.assign(new Error('This address is already saved.'), { code: 'DUPLICATE' });
  }

  if (!token) {
    const newAddress = {
      ...address,
      id: Date.now().toString(),
      phone: `${COUNTRY_CODE} ${String(address.phone).replace(/\D/g, '').slice(-10)}`,
      altPhone: address.altPhone ? `${COUNTRY_CODE} ${String(address.altPhone).replace(/\D/g, '').slice(-10)}` : '',
    };
    await persistLocalSnapshot([...existing, newAddress]);
    return newAddress;
  }

  const headers = await addressesAuthHeaders();
  const res = await fetch(`${ACTIVE_API_URL}/api/addresses`, {
    method: 'POST',
    headers,
    body: JSON.stringify(addressToServerPayload(address)),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (isAuthExpiredResponse(res.status, data)) {
      await handleAuthExpired();
      throw Object.assign(new Error('Session expired. Please login again.'), { code: 'AUTH_EXPIRED' });
    }
    throw Object.assign(new Error(data?.message || 'Could not save address'), { code: 'API' });
  }
  const created = normalizeServerAddress(data.address);
  const refreshed = await fetchAddressesRemote(token);
  await persistLocalSnapshot(refreshed);
  return created;
};

export const updateAddress = async (id: string, patch: any): Promise<any> => {
  const token = getAuthToken();
  const existing = await getAddresses();
  const idx = existing.findIndex((a: any) => String(a?.id) === String(id));
  if (idx === -1) {
    throw Object.assign(new Error('Address not found.'), { code: 'NOT_FOUND' });
  }
  const prev = existing[idx];
  const merged = {
    ...prev,
    ...patch,
    id: prev.id,
  };
  if (patch.phone !== undefined && patch.phone !== null && patch.phone !== '') {
    const digits = String(patch.phone).replace(/\D/g, '').slice(-10);
    merged.phone = digits ? `${COUNTRY_CODE} ${digits}` : prev.phone;
  }
  if (patch.altPhone !== undefined) {
    merged.altPhone = patch.altPhone
      ? `${COUNTRY_CODE} ${String(patch.altPhone).replace(/\D/g, '').slice(-10)}`
      : '';
  }
  const dupKey = makeKey(merged);
  if (existing.some((a: any, i: number) => i !== idx && makeKey(a) === dupKey)) {
    throw Object.assign(new Error('This address is already saved.'), { code: 'DUPLICATE' });
  }

  if (!token) {
    const updated = [...existing];
    updated[idx] = merged;
    await persistLocalSnapshot(updated);
    return merged;
  }

  const headers = await addressesAuthHeaders();
  const res = await fetch(`${ACTIVE_API_URL}/api/addresses/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(addressToServerPayload(merged)),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (isAuthExpiredResponse(res.status, data)) {
      await handleAuthExpired();
      throw Object.assign(new Error('Session expired. Please login again.'), { code: 'AUTH_EXPIRED' });
    }
    throw Object.assign(new Error(data?.message || 'Could not update address'), { code: 'API' });
  }
  const updatedDoc = normalizeServerAddress(data.address);
  const refreshed = await fetchAddressesRemote(token);
  await persistLocalSnapshot(refreshed);
  return updatedDoc;
};

export async function deleteAddress(id: string): Promise<void> {
  const token = getAuthToken();
  const sid = String(id);

  if (!token) {
    const existing = await readCachedAddresses();
    const updated = existing.filter((a: any) => String(a?.id) !== sid);
    await persistLocalSnapshot(updated);
    const pref = await getPreferredDeliveryAddressId();
    if (pref === sid) {
      await setPreferredDeliveryAddressId(updated[0]?.id != null ? String(updated[0].id) : null);
    }
    return;
  }

  const headers = await addressesAuthHeaders();
  const res = await fetch(`${ACTIVE_API_URL}/api/addresses/${encodeURIComponent(sid)}`, {
    method: 'DELETE',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (isAuthExpiredResponse(res.status, data)) {
      await handleAuthExpired();
      throw Object.assign(new Error('Session expired. Please login again.'), { code: 'AUTH_EXPIRED' });
    }
    throw Object.assign(new Error(data?.message || 'Could not delete address'), { code: 'API' });
  }

  const refreshed = await fetchAddressesRemote(token);
  await persistLocalSnapshot(refreshed);

  const pref = await getPreferredDeliveryAddressId();
  if (pref === sid) {
    await setPreferredDeliveryAddressId(refreshed[0]?.id != null ? String(refreshed[0].id) : null);
  }
}
