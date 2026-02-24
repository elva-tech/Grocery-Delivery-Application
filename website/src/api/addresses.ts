// Using localStorage to simulate your React Native DB behavior
let ADDRESS_DB: any[] = JSON.parse(localStorage.getItem('user_addresses') || '[]');
const COUNTRY_CODE = "+91";

export const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    const data = await response.json();
    return data.display_name || "Unknown Location";
  } catch (error) {
    return "Unknown Location";
  }
};

export const getAddresses = async () => {
  return new Promise((resolve) => {
    const data = JSON.parse(localStorage.getItem('user_addresses') || '[]');
    setTimeout(() => resolve(data), 100);
  });
};

export const addAddress = async (address: any) => {
  return new Promise((resolve) => {
    const current = JSON.parse(localStorage.getItem('user_addresses') || '[]');
    // Prepend country code on backend side
    const newAddress = { 
      ...address, 
      id: Date.now().toString(),
      phone: `${COUNTRY_CODE} ${address.phone}`,
      altPhone: address.altPhone ? `${COUNTRY_CODE} ${address.altPhone}` : ''
    };
    const updated = [...current, newAddress];
    localStorage.setItem('user_addresses', JSON.stringify(updated));
    resolve(newAddress);
  });
};

export const requestOtp = async (phone: string) => {
  return new Promise((resolve) => {
    console.log(`Sending new OTP to ${COUNTRY_CODE}${phone}`);
    setTimeout(() => {
      resolve({ success: true, message: "New OTP Sent" });
    }, 800);
  });
};

export const createOrder = async (orderPayload: any) => {
  return new Promise((resolve) => {
    // Format recipient phone if it's for 'others'
    if (orderPayload.orderType === 'others') {
      orderPayload.recipientDetails.recipientPhone = `${COUNTRY_CODE} ${orderPayload.recipientDetails.recipientPhone}`;
    }
    console.log("WEBSITE ORDER PAYLOAD:", orderPayload);
    setTimeout(() => {
      resolve({ success: true, orderId: `WEB-${Date.now()}` });
    }, 1500);
  });
};