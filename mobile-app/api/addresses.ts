import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const ADDRESSES_KEY = '@enandi_addresses';
const COUNTRY_CODE = "+91"; // Backend controlled

const makeKey = (address: any) =>
  `${address.label?.trim()}|${address.line1?.trim() || address.full?.trim()}|${address.pincode?.trim() || ''}|${address.phone?.trim()}`;

export const getAddressFromCoords = async (lat: number, lng: number, signal?: AbortSignal) => {
  if (signal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  try {
    const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (signal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    if (!result || result.length === 0) return 'Address not found';
    
    const addr = result[0];

    // FIXED: Using property names recognized by expo-location to remove red lines
    const parts = [
      addr.name, 
      addr.street, 
      addr.district, 
      addr.subregion, 
      addr.city, 
      addr.postalCode
    ].filter(part => part && part !== 'null' && part !== 'undefined' && part !== '');

    return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    return 'Error fetching address';
  }
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
