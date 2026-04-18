import axios from 'axios';

// ============================================
// DASHBOARD API SERVICE
// ============================================

// Get API Base URL from environment variable or use default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://grocery-delivery-application-6n3w.onrender.com';

// ============================================
// JWT TOKEN DECODER
// ============================================

const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

// Create axios instance
const dashboardApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// REQUEST INTERCEPTOR - ADD JWT TOKEN + TENANT ID
// ============================================

dashboardApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwtToken');
    
    if (token) {
      // Add Authorization header
      config.headers.Authorization = `Bearer ${token}`;
      
      // Decode token to get tenantId
      const decoded = decodeToken(token);
      if (decoded && decoded.tenantId) {
        config.headers['x-tenant-id'] = decoded.tenantId;
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================
// RESPONSE INTERCEPTOR - HANDLE ERRORS
// ============================================

dashboardApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.message = 'Network error. Unable to connect to server.';
    } else if (error.response.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('jwtToken');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

// ============================================
// DASHBOARD API METHODS
// ============================================

export const dashboardService = {
  /**
   * Get active orders count and summary
   */
  getActiveOrders: async () => {
    try {
      const response = await dashboardApi.get('/api/admin/active-orders');
      return response.data;
    } catch (error) {
      console.error('Error fetching active orders:', error);
      throw error;
    }
  },

  /**
   * Get pending orders count
   */
  getPendingOrders: async () => {
    try {
      const response = await dashboardApi.get('/api/admin/pending-orders');
      return response.data;
    } catch (error) {
      console.error('Error fetching pending orders:', error);
      throw error;
    }
  },

  /**
   * Get revenue data for specified number of days
   */
  getRevenue: async (days = 7) => {
    try {
      const response = await dashboardApi.get(`/api/admin/revenue?days=${days}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching revenue:', error);
      throw error;
    }
  },

  /**
   * Get all products for inventory value calculation
   */
  getProducts: async () => {
    try {
      const response = await dashboardApi.get('/api/products');
      return response.data;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },

  /**
   * Get top selling products based on delivered orders
   * @param {number} limit - Max products to return (default 5)
   */
  getTopProducts: async (limit = 5) => {
    try {
      const response = await dashboardApi.get(`/api/analytics/top-products?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching top products:', error);
      throw error;
    }
  },

  /**
   * Get daily sales data for delivered orders
   * @param {number} days - Number of past days (default 7)
   */
  getDailySales: async (days = 7) => {
    try {
      const response = await dashboardApi.get(`/api/analytics/daily-sales?days=${days}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching daily sales:', error);
      throw error;
    }
  },

  /**
   * Get ratings summary (avg, distribution, low ratings count)
   */
  getRatingsSummary: async () => {
    try {
      const response = await dashboardApi.get('/api/analytics/ratings-summary');
      return response.data;
    } catch (error) {
      console.error('Error fetching ratings summary:', error);
      throw error;
    }
  },
};

export default dashboardService;
