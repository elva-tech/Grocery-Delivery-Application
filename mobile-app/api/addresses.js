import * as Location from 'expo-location';

let ADDRESS_DB = [];

export const getAddressFromCoords = async (lat, lng) => {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (result.length > 0) {
        const addr = result[0];
        const formatted = [
          addr.name,
          addr.street,
          addr.district,
          addr.city,
          addr.region,
          addr.postalCode
        ].filter(Boolean).join(', ');
        setTimeout(() => resolve(formatted), 300);
      } else {
        resolve("Unknown Location");
      }
    } catch (error) {
      reject(error);
    }
  });
};

export const getAddresses = async () => {
  return new Promise((resolve) => {
    setTimeout(() => resolve([...ADDRESS_DB]), 100);
  });
};

export const addAddress = async (address) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newAddress = { ...address, id: Date.now().toString() };
      ADDRESS_DB.push(newAddress);
      resolve(newAddress);
    }, 100);
  });
};

export const clearAddresses = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      ADDRESS_DB = [];
      resolve(true);
    }, 100);
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