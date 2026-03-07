import axios from "axios";

/* -------- CREATE AXIOS INSTANCE -------- */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // 10 second timeout
});

/* -------- ATTACH TOKEN AUTOMATICALLY -------- */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwtToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

/* -------- RESPONSE ERROR INTERCEPTOR -------- */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors
    if (!error.response) {
      error.message = "Network error. Unable to connect to server.";
    }
    return Promise.reject(error);
  }
);

/* -------- API SERVICES -------- */
export const apiService = {
  /* -------- GET ALL RETURN REQUESTS (ADMIN) -------- */
  getAllReturns: async () => {
    const res = await api.get("/api/returns/all");
    return res.data;
  },

  /* -------- APPROVE RETURN REQUEST (ADMIN) -------- */
  approveReturn: async (id, resolutionNote) => {
    const res = await api.put(`/api/returns/approve/${id}`, { resolutionNote });
    return res.data;
  },

  /* -------- REJECT RETURN REQUEST (ADMIN) -------- */
  rejectReturn: async (id, resolutionNote) => {
    const res = await api.put(`/api/returns/reject/${id}`, { resolutionNote });
    return res.data;
  },

  /* -------- SEND OTP -------- */
  sendOtp: async (phoneNumber) => {

    const res = await api.post("/api/auth/send-otp", { phoneNumber });

    return res.data;
  },

  /* -------- VERIFY OTP -------- */
  verifyOtp: async (phoneNumber, otp) => {

    const res = await api.post("/api/auth/verify-otp", { phoneNumber, otp });

    return res.data;
  },

  /* -------- GET ORDERS -------- */
  getOrders: async () => {

    const res = await api.get("/api/admin/orders?page=1&limit=100");

    return res.data;
  },

  /* -------- GET RIDERS -------- */
  getRiders: async () => {

    const res = await api.get("/api/riders?page=1&limit=100");

    return res.data;
  },

  /* -------- CREATE RIDER -------- */
  createRider: async (riderData) => {

    // Transform frontend field names to backend schema
    const payload = {
      name: riderData.name,
      phoneNumber: riderData.phone, // Map 'phone' to 'phoneNumber'
      vehicle: riderData.vehicle,
      licenseNumber: riderData.licenseNumber || "",
    };

    const res = await api.post("/api/riders", payload);

    return res.data;
  },

  /* -------- UPDATE RIDER STATUS -------- */
  updateRiderStatus: async (riderId, status) => {

    const res = await api.put(`/api/riders/${riderId}/status`, { status });

    return res.data;
  },

  /* -------- UPDATE ORDER STATUS -------- */
  updateOrderStatus: async (orderId, status) => {

    const res = await api.put(`/api/admin/orders/${orderId}/status`, {
      status,
    });

    return res.data;
  },

  /* -------- ASSIGN RIDER TO ORDER -------- */
  assignRiderToOrder: async (riderId, orderId) => {

    const res = await api.post(`/api/riders/${riderId}/assign-order`, {
      orderId,
    });

    return res.data;
  },

};