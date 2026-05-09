import axios from "axios";
import { API_BASE_URL, getTenantId } from "../config";

const COUNTRY_CODE = "+91";
const ADDRESSES_URL = `${API_BASE_URL}/api/addresses`;

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

export type ReverseGeocodeDetails = {
  line1: string;
  pincode: string;
  city: string;
  state: string;
};

export const getAddressDetailsFromCoords = async (lat: number, lng: number): Promise<ReverseGeocodeDetails> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lng}`
    );
    const data = await response.json();
    const address = data?.address || {};
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.county ||
      '';
    const state = address.state || '';
    const pincode = String(address.postcode || '').replace(/\D/g, '').slice(0, 6);
    const road = [address.house_number, address.road, address.neighbourhood, address.suburb]
      .filter(Boolean)
      .map((s: string) => String(s).trim())
      .filter(Boolean)
      .join(', ');
    const line1 =
      road ||
      [address.amenity, address.shop].filter(Boolean).join(', ').trim() ||
      (typeof data?.display_name === 'string' ? data.display_name.trim() : '') ||
      'Unknown Location';
    return {
      line1,
      pincode,
      city: String(city).trim(),
      state: String(state).trim(),
    };
  } catch {
    return {
      line1: 'Unknown Location',
      pincode: '',
      city: '',
      state: '',
    };
  }
};

export const getAddresses = async () => {
  const token = localStorage.getItem("token");
  if (!token) return [];
  const res = await axios.get(`${ADDRESSES_URL}/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-tenant-id": getTenantId(),
    },
  });
  return (res.data?.addresses || []).map((addr: any) => ({
    ...addr,
    id: addr._id || addr.id,
  }));
};

const formatStoredPhone = (raw: string) => {
  const d = String(raw || '').replace(/\D/g, '').slice(-10);
  return d ? `${COUNTRY_CODE} ${d}` : '';
};

export const addAddress = async (address: any) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Unauthorized");
  const payload = {
    ...address,
    isMyAddress: address.isMyAddress ?? true,
    phone: formatStoredPhone(address.phone),
    altPhone: address.altPhone ? formatStoredPhone(address.altPhone) : "",
  };
  const res = await axios.post(ADDRESSES_URL, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-tenant-id": getTenantId(),
    },
  });
  return {
    ...(res.data?.address || {}),
    id: res.data?.address?._id || res.data?.address?.id,
  };
};

export const updateAddress = async (id: string, address: any) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Unauthorized");
  const payload = {
    ...address,
    isMyAddress: address.isMyAddress ?? true,
    phone: address.phone ? formatStoredPhone(address.phone) : "",
    altPhone:
      address.altPhone !== undefined
        ? address.altPhone
          ? formatStoredPhone(address.altPhone)
          : ""
        : "",
  };
  const res = await axios.patch(`${ADDRESSES_URL}/${id}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-tenant-id": getTenantId(),
    },
  });
  return {
    ...(res.data?.address || {}),
    id: res.data?.address?._id || res.data?.address?.id,
  };
};

export const deleteAddress = async (id: string) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Unauthorized");
  await axios.delete(`${ADDRESSES_URL}/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-tenant-id": getTenantId(),
    },
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