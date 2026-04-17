/**
 * App Constants
 * Configuration for API URLs, statuses, and settings
 */

// ============================================
// API CONFIGURATION - ENVIRONMENT URLS
// ============================================

export const API_BASE_URL = {
  DEVELOPMENT: 'https://grocery-delivery-application-2kc4.onrender.com',
  STAGING: 'https://staging-api.egrocery.com',
  PRODUCTION: 'https://grocery-delivery-application-2kc4.onrender.com',
};

// ============================================
// ORDER STATUSES
// ============================================

export const ORDER_STATUS = {
  PLACED: 'PLACED',
  CONFIRMED: 'CONFIRMED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUND_APPROVED: 'REFUND_APPROVED',
  REFUND_REJECTED: 'REFUND_REJECTED',
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
  REFUNDED: 'REFUNDED',
};

// ============================================
// RIDER STATUS
// ============================================

export const RIDER_STATUS = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  ON_DELIVERY: 'On Delivery',
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
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// ============================================
// ERROR MESSAGES
// ============================================

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'Unauthorized. Please login again.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  NOT_FOUND: 'Resource not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  TIMEOUT: 'Request timeout. Please try again.',
};


// ============================================
// APP SETTINGS
// ============================================

export const APP_SETTINGS = {
  FEATURES: {
    ENABLE_PAYMENTS: true,
    ENABLE_RETURNS: true,
    ENABLE_RATINGS: true,
    ENABLE_NOTIFICATIONS: true,
    ALLOW_REFUNDS: true,
    ALLOW_ORDER_CANCELLATION: true,
  },
  LOW_STOCK_THRESHOLD: 10,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  TOAST_TIMEOUT: 3000,
  ANIMATION_DURATION: 300,
};
