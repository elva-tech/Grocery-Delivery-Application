/**
 * Mobile App Constants
 * Configuration for API environment URLs and settings
 */

// ============================================
// API ENVIRONMENT URLS
// ============================================

export const API_BASE_URL = {
  DEVELOPMENT: 'http://localhost:5000',
  STAGING: 'https://staging-api.egrocery.com',
  PRODUCTION: 'https://api.egrocery.com',
};

// Active API URL — change to STAGING or PRODUCTION for deployment
export const ACTIVE_API_URL = API_BASE_URL.DEVELOPMENT;

// Tenant ID (must match backend tenant config)
export const TENANT_ID = 'demo-tenant';

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
