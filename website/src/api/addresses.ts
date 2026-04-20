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

const formatStoredPhone = (raw: string) => {
  const d = String(raw || '').replace(/\D/g, '').slice(-10);
  return d ? `${COUNTRY_CODE} ${d}` : '';
};

export const addAddress = async (address: any) => {
  return new Promise((resolve) => {
    const current = JSON.parse(localStorage.getItem('user_addresses') || '[]');
    const newAddress = {
      ...address,
      id: Date.now().toString(),
      phone: formatStoredPhone(address.phone),
      altPhone: address.altPhone ? formatStoredPhone(address.altPhone) : '',
    };
    const updated = [...current, newAddress];
    localStorage.setItem('user_addresses', JSON.stringify(updated));
    resolve(newAddress);
  });
};

export const updateAddress = async (id: string, address: any) => {
  return new Promise((resolve, reject) => {
    const current = JSON.parse(localStorage.getItem('user_addresses') || '[]');
    const idx = current.findIndex((a: any) => a.id === id);
    if (idx === -1) {
      reject(new Error('Address not found'));
      return;
    }
    const prev = current[idx];
    const merged = {
      ...prev,
      ...address,
      id: prev.id,
      phone: address.phone ? formatStoredPhone(address.phone) : prev.phone,
      altPhone:
        address.altPhone !== undefined
          ? address.altPhone
            ? formatStoredPhone(address.altPhone)
            : ''
          : prev.altPhone,
    };
    current[idx] = merged;
    localStorage.setItem('user_addresses', JSON.stringify(current));
    resolve(merged);
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