import * as Location from 'expo-location';

let ADDRESS_DB = [];
const savedKeys = new Set();

const makeKey = (address) =>
  `${address.label?.trim()}|${address.full?.trim()}|${address.phone?.trim()}`;

// --- EXISTING FUNCTIONS ---
export const getAddressFromCoords = async (lat, lng, signal) => {
  if (signal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  try {
    const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (signal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    if (!result || result.length === 0) return 'Address not found';
    const addr = result[0];
    const parts = [addr.name || addr.houseNumber, addr.street, addr.district || addr.subregion, addr.city, addr.postalCode]
      .filter(part => part && part !== 'null' && part !== 'undefined');
    return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return 'Error fetching address';
  }
};

export const getAddresses = async () => {
  return new Promise((resolve) => setTimeout(() => resolve([...ADDRESS_DB]), 100));
};

export const addAddress = async (address) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const key = makeKey(address);
      if (savedKeys.has(key)) {
        reject(Object.assign(new Error('This address is already saved.'), { code: 'DUPLICATE' }));
        return;
      }
      savedKeys.add(key);
      const newAddress = { ...address, id: Date.now().toString() };
      ADDRESS_DB.push(newAddress);
      resolve(newAddress);
    }, 100);
  });
};

// --- NEW ORDER API FUNCTION ---
export const createOrder = async (orderPayload) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Logic: If orderType is 'others', we ensure recipientDetails exists
      console.log("FINAL API CALL DATA:", JSON.stringify(orderPayload, null, 2));
      
      if (!orderPayload.items || orderPayload.items.length === 0) {
        reject(new Error("Cart is empty"));
        return;
      }

      // Simulate success
      resolve({ 
        success: true, 
        orderId: `ORD-${Math.floor(Math.random() * 1000000)}`,
        timestamp: new Date().toISOString()
      });
    }, 1500); // 1.5s delay to simulate network
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