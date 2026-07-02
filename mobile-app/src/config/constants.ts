import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

import { getTenantId } from '../utils/getTenantId';

/**
 * Mobile App Constants
 * Configuration for API environment URLs and settings
 */

// ============================================
// API ENVIRONMENT URLS
// ============================================

/**
 * In Expo Go / dev, the JS bundle URL contains the same host the device uses to reach Metro
 * (e.g. hotspot: `http://192.168.43.12:8081/...`). Re-use that host for the API so you do not
 * need to hand-edit IPs when switching Wi‑Fi / hotspot / USB.
 */
function inferPackagerHostname(): string | null {
  if (Platform.OS === 'web') return null;
  try {
    const hostUriFromExpoConfig = (Constants.expoConfig as any)?.hostUri as string | undefined;
    if (hostUriFromExpoConfig && typeof hostUriFromExpoConfig === 'string') {
      const host = hostUriFromExpoConfig.split(':')[0]?.trim();
      if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
    }

    const hostUriFromManifest2 = (Constants as any)?.manifest2?.extra?.expoClient?.hostUri as
      | string
      | undefined;
    if (hostUriFromManifest2 && typeof hostUriFromManifest2 === 'string') {
      const host = hostUriFromManifest2.split(':')[0]?.trim();
      if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
    }

    const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;
    if (!scriptURL || typeof scriptURL !== 'string') return null;
    const m = scriptURL.match(/\/\/([^/:?]+)/);
    const host = m?.[1]?.trim();
    if (!host || host === 'localhost' || host === '127.0.0.1') return null;
    return host;
  } catch {
    return null;
  }
}

/** Dev API: override with EXPO_PUBLIC_API_DEV_URL. Web uses localhost. Native infers host from Metro when possible. */
function resolveDevelopmentApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_DEV_URL?.trim();
  if (fromEnv) return fromEnv;
  if (Platform.OS === 'web') return 'http://localhost:5000';
  const host = inferPackagerHostname();
  if (host) return `http://${host}:5000`;
  return 'http://192.168.254.226:5000';
}

export const API_BASE_URL = {
  get DEVELOPMENT(): string {
    return resolveDevelopmentApiUrl();
  },
  STAGING: 'https://staging-api.egrocery.com',
  PRODUCTION:
    process.env.EXPO_PUBLIC_API_URL?.trim() ||
    'https://grocery-delivery-application-x1yk.onrender.com',
};


// export const ACTIVE_API_URL = API_BASE_URL.DEVELOPMENT;

const ENV = (process.env.EXPO_PUBLIC_ENV || 'development').toLowerCase();
// In Expo Go / local dev, always use DEVELOPMENT backend even if env accidentally says production.
const IS_PRODUCTION_BUILD = ENV === 'production' && !__DEV__;

export const ACTIVE_API_URL = IS_PRODUCTION_BUILD
  ? API_BASE_URL.PRODUCTION
  : API_BASE_URL.DEVELOPMENT;

if (__DEV__) {
  // Helps diagnose "no backend calls" quickly in Expo logs.
  console.log('[config] ACTIVE_API_URL =', ACTIVE_API_URL);
}

    

// Resolved at runtime via store code / QR — see tenantStorage (empty until user picks a store).
export const TENANT_ID = getTenantId();
export const RAZORPAY_KEY_ID = 'rzp_test_SaHmJpDs42QvIp';
export const APP_BRAND = 'Enandi';
export const SUPPORT_PHONE = '+919876543210';

// ============================================
// ORDER STATUSES
// ============================================

export const ORDER_STATUS = {
  PLACED: 'PLACED',
  CONFIRMED: 'CONFIRMED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};

// ============================================
// PAYMENT MODES
// ============================================

export const PAYMENT_MODES = {
  COD: 'COD',
  ONLINE: 'ONLINE',
  WALLET: 'WALLET',
};

// ============================================
// PAYMENT STATUS
// ============================================

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
};

// ============================================
// RETURN STATUS
// ============================================

export const RETURN_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REFUNDED: 'REFUNDED',
};

// ============================================
// HTTP STATUS CODES
// ============================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// ============================================
// ERROR MESSAGES
// ============================================

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'Unauthorized. Please login again.',
  INVALID_CREDENTIALS: 'Invalid username or password.',
  ACCOUNT_NOT_FOUND: 'Account not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  TIMEOUT: 'Request timeout. Please try again.',
  DATA_NOT_FOUND: 'Data not found.',
};

// ============================================
// SUCCESS MESSAGES
// ============================================

export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful',
  ORDER_PLACED: 'Order placed successfully',
  ADDRESS_ADDED: 'Address added successfully',
  ADDRESS_UPDATED: 'Address updated successfully',
  ADDRESS_DELETED: 'Address deleted successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
};

// ============================================
// APP SETTINGS
// ============================================

export const APP_SETTINGS = {
  APP_NAME: 'Enandi',
  VERSION: '1.0.0',
  BUILD_NUMBER: 1,
};

// ============================================
// FEATURE FLAGS
// ============================================

export const FEATURES = {
  ENABLE_PAYMENTS: true,
  ENABLE_RETURNS: true,
  ENABLE_RATINGS: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_PUSH_NOTIFICATIONS: true,
};

// ============================================
// UI CONFIGURATION
// ============================================

export const UI_CONFIG = {
  ANIMATION_DURATION: 300,
  TOAST_TIMEOUT: 3000,
  DEBOUNCE_DELAY: 300,
  RETRY_ATTEMPTS: 3,
};

// ============================================
// STORAGE KEYS
// ============================================

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  CART_DATA: 'cart_data',
  ADDRESSES: 'addresses',
  PREFERENCES: 'preferences',
  THEME: 'theme',
};

// ============================================
// PAGINATION
// ============================================

export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// ============================================
// VALIDATION RULES
// ============================================

export const VALIDATION = {
  EMAIL_REGEX: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  PHONE_REGEX: /^[6-9]\d{9}$/,
  MIN_PASSWORD_LENGTH: 6,
  MIN_NAME_LENGTH: 2,
};

/** Seconds before "Resend OTP" is enabled after a successful send. */
export const OTP_RESEND_COOLDOWN_SECONDS = 150;
