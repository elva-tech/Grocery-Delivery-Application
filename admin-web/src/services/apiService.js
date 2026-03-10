import axios from "axios";

/* -------- CREATE AXIOS INSTANCE -------- */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

/* -------- ATTACH TOKEN AUTOMATICALLY -------- */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwtToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/* -------- RESPONSE ERROR INTERCEPTOR -------- */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.message = "Network error. Unable to connect to server.";
    }
    return Promise.reject(error);
  }
);

/* -------- API SERVICES -------- */
export const apiService = {

  /* -------- PRODUCT APIs -------- */

  getProducts: async () => {
    const res = await api.get("/api/products");
    return res.data;
  },

  addProduct: async (payload) => {
    const res = await api.post("/api/products/admin/products", payload);
    return res.data;
  },

  /* -------- GET ALL RETURN REQUESTS -------- */

  getAllReturns: async () => {
    const res = await api.get("/api/returns/all");
    return res.data;
  },

  approveReturn: async (id, resolutionNote) => {
    const res = await api.put(`/api/returns/approve/${id}`, { resolutionNote });
    return res.data;
  },

  rejectReturn: async (id, resolutionNote) => {
    const res = await api.put(`/api/returns/reject/${id}`, { resolutionNote });
    return res.data;
  },

  /* -------- AUTH APIs -------- */

  sendOtp: async (phoneNumber) => {
    const res = await api.post("/api/auth/send-otp", { phoneNumber });
    return res.data;
  },

  verifyOtp: async (phoneNumber, otp) => {
    const res = await api.post("/api/auth/verify-otp", { phoneNumber, otp });
    return res.data;
  },

  /* -------- ORDER APIs -------- */

  getOrders: async () => {
    const res = await api.get("/api/admin/orders?page=1&limit=100");
    return res.data;
  },

  updateOrderStatus: async (orderId, status) => {
    const res = await api.put(`/api/admin/orders/${orderId}/status`, { status });
    return res.data;
  },

  /* -------- RIDER APIs -------- */

  getRiders: async () => {
    const res = await api.get("/api/riders?page=1&limit=100");
    return res.data;
  },

  createRider: async (riderData) => {
    const payload = {
      name: riderData.name,
      phoneNumber: riderData.phone,
      vehicle: riderData.vehicle,
      licenseNumber: riderData.licenseNumber || "",
    };

    const res = await api.post("/api/riders", payload);
    return res.data;
  },

  updateRiderStatus: async (riderId, status) => {
    const res = await api.put(`/api/riders/${riderId}/status`, { status });
    return res.data;
  },

  assignRiderToOrder: async (riderId, orderId) => {
    const res = await api.post(`/api/riders/${riderId}/assign-order`, {
      orderId,
    });
    return res.data;
  },
};