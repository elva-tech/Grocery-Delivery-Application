import axios from "axios";

/* -------- CREATE AXIOS INSTANCE -------- */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/* -------- ATTACH TOKEN AUTOMATICALLY -------- */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwtToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/* -------- API SERVICES -------- */
export const apiService = {

  /* -------- GET ORDERS -------- */
  getOrders: async () => {

    const res = await api.get("/api/admin/orders?page=1&limit=100");

    return res.data;
  },

  /* -------- UPDATE ORDER STATUS -------- */
  updateOrderStatus: async (orderId, status) => {

    const res = await api.put(`/api/admin/orders/${orderId}/status`, {
      status,
    });

    return res.data;
  },

};