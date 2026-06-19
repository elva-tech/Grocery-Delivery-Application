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

const REQUEST_TIMEOUT_MS = 12000;
const SEND_OTP_TIMEOUT_MS = 45000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const fetchPromise = fetch(url, { ...init, signal: controller.signal });
  const timeoutPromise = new Promise<Response>((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(new Error('Request timed out. Check backend/server connection.'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Request timed out. Check backend/server connection.');
    }
    throw error;
  }
}

async function parseJsonSafely<T>(response: Response): Promise<T> {
  const raw = await response.text();
  if (!raw || !raw.trim()) {
    throw new Error('Empty server response');
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('Invalid server response');
  }
}

/**
 * Send OTP to phone number
 */
export const sendOtp = async (
  phoneNumber: string,
  options: { resend?: boolean } = {},
): Promise<SendOtpResponse> => {
  const response = await fetchWithTimeout(
    `${ACTIVE_API_URL}/api/auth/send-otp`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-platform': 'mobile',
        'x-tenant-id': await getActiveTenantId(),
      },
      body: JSON.stringify({
        phoneNumber,
        ...(options.resend ? { resend: true } : {}),
      }),
    },
    SEND_OTP_TIMEOUT_MS,
  );

  const data = await parseJsonSafely<SendOtpResponse>(response);

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
  const response = await fetchWithTimeout(`${ACTIVE_API_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-platform': 'mobile',
      'x-tenant-id': await getActiveTenantId(),
    },
    body: JSON.stringify({ phoneNumber, otp, ...(name && { name }) }),
  });

  const data = await parseJsonSafely<VerifyOtpResponse>(response);

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
  if (data.address != null) body.address = String(data.address).trim();

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