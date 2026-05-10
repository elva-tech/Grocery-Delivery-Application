import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const ADDRESSES_KEY = '@enandi_addresses';
const PREFERRED_DELIVERY_ADDRESS_ID_KEY = '@enandi_preferred_delivery_address_id';

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
const COUNTRY_CODE = "+91"; // Backend controlled

const makeKey = (address: any) =>
  `${address.label?.trim()}|${address.line1?.trim() || address.full?.trim()}|${address.pincode?.trim() || ''}|${address.phone?.trim()}`;

export type ReverseAddress = {
  line1: string;
  city: string;
  state: string;
  pincode: string;
};

export const getAddressFromCoordsDetailed = async (
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ReverseAddress> => {
  if (signal?.aborted) {
    return { line1: '', city: '', state: '', pincode: '' };
  }
  try {
    const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (signal?.aborted) {
      return { line1: '', city: '', state: '', pincode: '' };
    }
    if (!result || result.length === 0) {
      return { line1: 'Address not found', city: '', state: '', pincode: '' };
    }
    
    const addr = result[0];

    // Prefer street geometry over POI `name` so line1 is not dominated by a nearby landmark/brand
    // (eligibility still uses map lat/lng; this only affects the auto-filled address line).
    const streetLine = [addr.streetNumber, addr.street].filter(Boolean).join(' ').trim();
    const parts = [
      streetLine || undefined,
      addr.district,
      addr.subregion,
      addr.city,
      addr.postalCode,
    ].filter(part => part && part !== 'null' && part !== 'undefined' && part !== '');

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
  const existing = await getAddresses();
  const key = makeKey(address);
  if (existing.some((a: any) => makeKey(a) === key)) {
    throw Object.assign(new Error('This address is already saved.'), { code: 'DUPLICATE' });
  }
  const newAddress = {
    ...address,
    id: Date.now().toString(),
    phone: `${COUNTRY_CODE} ${address.phone}`,
    altPhone: address.altPhone ? `${COUNTRY_CODE} ${address.altPhone}` : '',
  };
  const updated = [...existing, newAddress];
  await AsyncStorage.setItem(ADDRESSES_KEY, JSON.stringify(updated));
  return newAddress;
};

export const updateAddress = async (id: string, patch: any): Promise<any> => {
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
  const key = makeKey(merged);
  if (existing.some((a: any, i: number) => i !== idx && makeKey(a) === key)) {
    throw Object.assign(new Error('This address is already saved.'), { code: 'DUPLICATE' });
  }
  const updated = [...existing];
  updated[idx] = merged;
  await AsyncStorage.setItem(ADDRESSES_KEY, JSON.stringify(updated));
  return merged;
};

export async function deleteAddress(id: string): Promise<void> {
  const existing = await getAddresses();
  const sid = String(id);
  const updated = existing.filter((a: any) => String(a?.id) !== sid);
  await AsyncStorage.setItem(ADDRESSES_KEY, JSON.stringify(updated));
  const pref = await getPreferredDeliveryAddressId();
  if (pref === sid) {
    await setPreferredDeliveryAddressId(updated[0]?.id != null ? String(updated[0].id) : null);
  }
}
