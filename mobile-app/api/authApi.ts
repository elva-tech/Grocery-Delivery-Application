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

  let data: SendOtpResponse;
  try {
    data = await response.json();
  } catch {
    throw new Error('Network error. Please check your connection.');
  }

  if (!response.ok) {
    throw new Error((data as any)?.message || 'Failed to send OTP');
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

  let data: VerifyOtpResponse;
  try {
    data = await response.json();
  } catch {
    throw new Error('Invalid server response');
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Failed to verify OTP');
  }
  if (!data.token || !data.user) {
    throw new Error(data.message || 'Verification failed');
  }

  return data;
};

/**
 * PATCH /api/auth/profile — must send a valid Bearer token (pass fresh token from verify-otp before AsyncStorage is updated).
 */
export const updateProfile = async (
  data: {
    name?: string;
    email?: string;
    address?: string;
    alternatePhone?: string;
  },
  tokenOverride?: string
) => {
  const token = (tokenOverride?.trim() || (await AsyncStorage.getItem('token')) || '').trim();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const body: Record<string, string> = {};
  if (data.name != null && String(data.name).trim().length > 0) {
    body.name = String(data.name).trim();
  }
  if (data.email != null) body.email = String(data.email).trim();
  if (data.alternatePhone != null) body.alternatePhone = String(data.alternatePhone).trim();

  const response = await fetch(`${ACTIVE_API_URL}/api/auth/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-platform': 'mobile',
      'x-tenant-id': await getActiveTenantId(),
    },
    body: JSON.stringify(body),
  });

  let resData: { message?: string };
  try {
    resData = await response.json();
  } catch {
    throw new Error('Invalid server response');
  }

  if (!response.ok) {
    throw new Error(resData.message || 'Failed to update profile');
  }

  return resData;
};