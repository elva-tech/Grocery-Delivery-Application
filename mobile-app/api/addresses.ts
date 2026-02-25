import * as Location from 'expo-location';

let ADDRESS_DB: any[] = [];
const savedKeys = new Set();
const COUNTRY_CODE = "+91"; // Backend controlled

const makeKey = (address: any) =>
  `${address.label?.trim()}|${address.full?.trim()}|${address.phone?.trim()}`;

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

export const getAddresses = async () => {
  return new Promise<any[]>((resolve) => setTimeout(() => resolve([...ADDRESS_DB]), 100));
};

// NEW: OTP Request API
export const requestOtp = async (phone: string) => {
  return new Promise((resolve) => {
    // Backend logic: Prepend code for the SMS Gateway
    console.log(`[SMS GATEWAY] Sending code to: ${COUNTRY_CODE}${phone}`);
    setTimeout(() => {
      resolve({ success: true, message: "OTP Sent Successfully" });
    }, 800);
  });
};

export const addAddress = async (address: any) => {
  return new Promise<any>((resolve, reject) => {
    setTimeout(() => {
      const key = makeKey(address);
      if (savedKeys.has(key)) {
        reject(Object.assign(new Error('This address is already saved.'), { code: 'DUPLICATE' }));
        return;
      }
      
      // BACKEND LOGIC: Prepend country code before saving to DB
      const newAddress = { 
        ...address, 
        id: Date.now().toString(),
        phone: `${COUNTRY_CODE} ${address.phone}`,
        altPhone: address.altPhone ? `${COUNTRY_CODE} ${address.altPhone}` : ''
      };
      
      savedKeys.add(key);
      ADDRESS_DB.push(newAddress);
      resolve(newAddress);
    }, 100);
  });
};

export const createOrder = async (orderPayload: any) => {
  return new Promise<any>((resolve, reject) => {
    setTimeout(() => {
      if (!orderPayload.items || orderPayload.items.length === 0) {
        reject(new Error("Cart is empty"));
        return;
      }

      // BACKEND LOGIC: Format recipient phone for 'others'
      if (orderPayload.orderType === 'others' && orderPayload.recipientDetails) {
        const rawPhone = orderPayload.recipientDetails.recipientPhone;
        orderPayload.recipientDetails.recipientPhone = `${COUNTRY_CODE} ${rawPhone}`;
      }

      console.log("FINAL API CALL DATA:", JSON.stringify(orderPayload, null, 2));

      resolve({ 
        success: true, 
        orderId: `ORD-${Math.floor(Math.random() * 1000000)}`,
        timestamp: new Date().toISOString()
      });
    }, 1500);
  });
};







// ONCE BACKEND GOOGLE MAPS ENDPOINT AVAILABLE CHANGE/MODIFY LIKE THIS
// import axios from 'axios';

// // The function your UI is already calling
// export const getAddressFromCoords = async (lat, lng) => {
//   try {
//     // 1. Call the new backend endpoint
//     const response = await axios.get(`https://your-backend-api.com/maps/reverse-geocode`, {
//       params: {
//         latitude: lat,
//         longitude: lng
//       }
//     });

//     // 2. Return the formatted string the backend sends back
//     // (Assuming backend returns: { address: "123 Street Name, City..." })
//     return response.data.address; 
    
//   } catch (error) {
//     console.error("Backend Geocoding Error:", error);
//     return "Location not found";
//   }
// };