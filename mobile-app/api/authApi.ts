import { ACTIVE_API_URL, TENANT_ID } from '@/src/config/constants';

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
      'x-tenant-id': TENANT_ID,
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
      'x-tenant-id': TENANT_ID,
    },
    body: JSON.stringify({ phoneNumber, otp, ...(name && { name }) }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to verify OTP');
  }

  return data;
};
