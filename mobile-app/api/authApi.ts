import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACTIVE_API_URL } from '@/src/config/constants';
import { getActiveTenantId } from '@/src/utils/tenantStorage';

export interface SendOtpResponse {
  success: boolean;
  message: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    phoneNumber: string;
    name?: string;
    email?: string;
    address?: string;
    alternatePhone?: string;
    tenantId?: string;
  };
}

/**
 * Send OTP to phone number
 */
export const sendOtp = async (phoneNumber: string): Promise<SendOtpResponse> => {
  const response = await fetch(`${ACTIVE_API_URL}/api/auth/send-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-platform': 'mobile',
      'x-tenant-id': await getActiveTenantId(),
    },
    body: JSON.stringify({ phoneNumber }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to send OTP');
  }

  return data;
};

/**
 * Verify OTP and get authentication token
 */
export const verifyOtp = async (
  phoneNumber: string,
  otp: string,
  name?: string,
  mode: 'signup' | 'login' = 'signup'
): Promise<VerifyOtpResponse> => {
  const response = await fetch(`${ACTIVE_API_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-platform': 'mobile',
      'x-tenant-id': await getActiveTenantId(),
    },
    body: JSON.stringify({ phoneNumber, otp, ...(name && { name }) }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to verify OTP');
  }

  return data;
};
export const updateProfile = async (
  data: {
    name?: string;
    email?: string;
    address?: string;
    alternatePhone?: string;
  }
) => {
  const token = await AsyncStorage.getItem('token');

  const response = await fetch(`${ACTIVE_API_URL}/api/auth/update-profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-platform': 'mobile',
    },
    body: JSON.stringify(data),
  });

  const resData = await response.json();

  if (!response.ok) {
    throw new Error(resData.message || 'Failed to update profile');
  }

  return resData;
};