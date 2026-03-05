import axios from "axios";

const BASE_URL = "http://localhost:5000";

const getToken = () => {
  return localStorage.getItem("jwtToken");
};

export const apiService = {

  /* -------- GET ORDERS -------- */
  getOrders: async () => {
    const token = getToken();

    const res = await axios.get(
      `${BASE_URL}/api/admin/orders?page=1&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return res.data;
  },

  /* -------- UPDATE ORDER STATUS -------- */
  updateOrderStatus: async (orderId, status) => {
    const token = getToken();

    const res = await axios.put(
      `${BASE_URL}/api/admin/orders/${orderId}/status`,
      { status },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return res.data;
  },
};