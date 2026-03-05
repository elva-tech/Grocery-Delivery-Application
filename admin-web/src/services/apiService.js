import axios from "axios";
import { API_BASE_URL } from "../config/constants";

const api = axios.create({
  baseURL: API_BASE_URL.DEVELOPMENT,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwtToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const apiService = {

  getProducts: async () => {
    const res = await api.get("/api/products");
    return res.data;
  },

  getOrders: async () => {
    const res = await api.get("/api/orders");
    return res.data;
  },

  addProduct: async (payload) => {
    const res = await api.post("/api/products/admin/products", payload);
    return res.data;
  }
};