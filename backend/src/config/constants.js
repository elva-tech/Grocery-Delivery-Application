/**
 * Backend Constants
 * Configuration for environment URLs and settings
 */

// ============================================
// SERVER URLS
// ============================================

export const SERVER_URLS = {
  DEVELOPMENT: 'http://localhost:5000',
  STAGING: 'https://staging-api.egrocery.com',
  PRODUCTION: 'https://api.egrocery.com',
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
// PAYMENT STATUS
// ============================================

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
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
// USER ROLES
// ============================================

export const USER_ROLES = {
  ADMIN: 'ADMIN',
  RIDER: 'RIDER',
  CUSTOMER: 'CUSTOMER',
  VENDOR: 'VENDOR',
};

// ============================================
// API RESPONSE CODES
// ============================================

export const RESPONSE_CODES = {
  SUCCESS: 200,
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
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation error',
  DUPLICATE_ENTRY: 'Duplicate entry not allowed',
  SERVER_ERROR: 'Internal server error',
  DATABASE_ERROR: 'Database operation failed',
  INVALID_CREDENTIALS: 'Invalid credentials',
};

// ============================================
// SUCCESS MESSAGES
// ============================================

export const SUCCESS_MESSAGES = {
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  LOGIN_SUCCESS: 'Login successful',
  ORDER_PLACED: 'Order placed successfully',
  ORDER_CONFIRMED: 'Order confirmed successfully',
  ORDER_DELIVERED: 'Order delivered successfully',
};

// ============================================
// SETTINGS
// ============================================

export const SETTINGS = {
  LOW_STOCK_THRESHOLD: 10,
  CRITICAL_STOCK_THRESHOLD: 5,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  FEATURES: {
    ALLOW_REFUNDS: true,
    ALLOW_ORDER_CANCELLATION: true,
  },
};
