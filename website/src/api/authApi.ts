/**
 * Backend API configuration and authentication endpoints
 */

import { API_BASE_URL, getTenantId } from '../config';

export interface SendOtpResponse {
  success: boolean;
  message: string;
}

export interface AuthUserPayload {
  id: string;
  phoneNumber: string;
  name?: string;
  email?: string;
  alternatePhone?: string;
  role?: string;
  tenantId?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: AuthUserPayload;
}

export interface UpdateProfileResponse {
  success: boolean;
  message?: string;
  user?: AuthUserPayload;
}

/**
 * Send OTP to phone number
 */
export const sendOtp = async (phoneNumber: string): Promise<SendOtpResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-platform': 'web',
        'x-tenant-id': getTenantId(),
      },
      body: JSON.stringify({ phoneNumber }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send OTP');
    }

    return data;
  } catch (error) {
    console.error('sendOtp error:', error);
    throw error;
  }
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
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-platform': 'web',
        'x-tenant-id': getTenantId(),
      },
      body: JSON.stringify({ phoneNumber, otp, mode, ...(name && { name }) }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to verify OTP');
    }

    return data;
  } catch (error) {
    console.error('verifyOtp error:', error);
    throw error;
  }
};

/**
 * Update authenticated user profile
 */
export const updateProfile = async (data: {
  name: string;
  email?: string;
  alternatePhone?: string;
}): Promise<UpdateProfileResponse> => {
  const token = localStorage.getItem('token')?.trim();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const body: Record<string, string> = { name: data.name.trim() };
  if (data.email !== undefined) body.email = data.email.trim();
  if (data.alternatePhone !== undefined) body.alternatePhone = data.alternatePhone.trim();

  const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-platform': 'web',
      'x-tenant-id': getTenantId(),
    },
    body: JSON.stringify(body),
  });

  const resData = await response.json();

  if (!response.ok) {
    throw new Error(resData.message || 'Failed to update profile');
  }

  return resData;
};
