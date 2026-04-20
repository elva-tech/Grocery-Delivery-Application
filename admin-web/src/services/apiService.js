import axios from "axios";

/* -------- CREATE AXIOS INSTANCE -------- */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://grocery-delivery-application-6n3w.onrender.com",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

/* -------- ATTACH TOKEN + TENANT (send-otp needs tenant before JWT exists) -------- */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwtToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.tenantId) {
        config.headers["x-tenant-id"] = payload.tenantId;
      }
    } catch {
      /* malformed token */
    }
  }

  // When calling a remote API (e.g. Render), hostname is not localhost — backend needs x-tenant-id.
  if (!config.headers["x-tenant-id"]) {
    const fromEnv = import.meta.env.VITE_TENANT_ID;
    if (fromEnv) {
      config.headers["x-tenant-id"] = String(fromEnv).trim();
    } else if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        const local = String(
          import.meta.env.VITE_LOCAL_DEFAULT_TENANT_ID || "demo-tenant"
        ).trim();
        config.headers["x-tenant-id"] = local;
      }
    }
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
updateProduct: async (productId, payload) => {
    if (!productId) throw new Error("Invalid product ID");
    const res = await api.put(`/api/products/admin/products/${productId}`, payload);
    return res.data;
  },

  deleteProduct: async (productId) => {
    if (!productId) throw new Error("Invalid product ID");
    const res = await api.delete(`/api/admin/products/${productId}`);
    return res.data;
  },

  deleteProductImage: async (productId, publicId) => {
    if (!productId || !publicId) {
      throw new Error("productId and public_id are required");
    }
    const res = await api.delete(`/api/products/${productId}/image`, {
      data: { public_id: publicId },
    });
    return res.data;
  },

  /** Multipart append; persists images on the product so delete-by-public_id works before Save. */
  appendProductImages: async (productId, files) => {
    if (!productId || !files?.length) {
      throw new Error("productId and files are required");
    }
    const formData = new FormData();
    for (const f of files) {
      formData.append("files", f);
    }
    const res = await api.post(`/api/products/${productId}/images`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
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
    const res = await api.post("/api/auth/verify-otp", {
      phoneNumber,
      otp,
      forAdminLogin: true,
    });
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

  markCODPaid: async (orderId) => {
    const res = await api.patch(`/api/admin/orders/${orderId}/mark-paid`);
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

  /* -------- GET INVENTORY -------- */
/* -------- GET INVENTORY -------- */
getInventory: async () => {
  try {
    const res = await api.get("/api/admin/inventory");
    return res.data;
  } catch (error) {
    throw error.response?.data || error;
  }
},
/* -------- UNIT APIs -------- */

getUnits: async () => {
  try {
    const res = await api.get("/api/units");
    return res.data;
  } catch (error) {
    throw error.response?.data || error;
  }
},

createUnit: async (name) => {
  try {
    const res = await api.post("/api/units", { name });
    return res.data;
  } catch (error) {
    throw error.response?.data || error;
  }
},

deleteUnit: async (id) => {
  try {
    const res = await api.delete(`/api/units/${id}`);
    return res.data;
  } catch (error) {
    throw error.response?.data || error;
  }
},

/* -------- BANNER APIs -------- */

getBanners: async () => {
  try {
    const res = await api.get("/api/banners");
    return res.data;
  } catch (error) {
    throw error.response?.data || error;
  }
},

createBanner: async (payload) => {
  try {
    const res = await api.post("/api/banners/create-banner", payload);
    return res.data;
  } catch (error) {
    throw error.response?.data || error;
  }
},

uploadFile: async (file, uploadCategory = "products", slotOpts = {}) => {
  const category = ["products", "banners", "returns"].includes(uploadCategory)
    ? uploadCategory
    : "products";
  try {
    const formData = new FormData();
    formData.append("file", file);
    const params = new URLSearchParams();
    if (slotOpts.productId) params.set("productId", String(slotOpts.productId));
    if (slotOpts.slotIndex != null) params.set("slotIndex", String(slotOpts.slotIndex));
    const q = params.toString();
    const url = `/api/upload/${category}${q ? `?${q}` : ""}`;
    const res = await api.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch (error) {
    throw error.response?.data || error;
  }
},

deleteBanner: async (id) => {
  try {
    const res = await api.delete(`/api/banners/delete-banner/${id}`);
    return res.data;
  } catch (error) {
    throw error.response?.data || error;
  }
},

  /* -------- SETTINGS APIs -------- */

  getSettings: async () => {
    const res = await api.get("/api/settings");
    return res.data;
  },

  updateSettings: async (payload) => {
    const res = await api.put("/api/settings", payload);
    return res.data;
  },

  /* -------- COUPON APIs -------- */

  getCoupons: async () => {
    const res = await api.get("/api/coupons");
    return res.data;
  },

  createCoupon: async (payload) => {
    const res = await api.post("/api/coupons", payload);
    return res.data;
  },

  updateCoupon: async (id, payload) => {
    if (!id) throw new Error("Invalid coupon ID");
    const res = await api.patch(`/api/coupons/${id}`, payload);
    return res.data;
  },

  /* -------- BILLING APIs -------- */

  getPlans: async () => {
    const res = await api.get("/api/billing/plans");
    return res.data;
  },

  getSubscription: async () => {
    const res = await api.get("/api/billing/subscription");
    return res.data;
  },

  getUsage: async () => {
    const res = await api.get("/api/billing/usage");
    return res.data;
  },

  getCurrentInvoice: async () => {
    const res = await api.get("/api/billing/invoice/current");
    return res.data;
  },

  triggerBillingGeneration: async (tenantId) => {
    const res = await api.post("/api/billing/generate", tenantId ? { tenantId } : {});
    return res.data;
  },

  changePlan: async (planId) => {
    const res = await api.put("/api/billing/subscription/plan", { planId });
    return res.data;
  },

  createInvoicePayment: async (invoiceId) => {
    const res = await api.post(`/api/billing/invoice/${invoiceId}/pay`);
    return res.data;
  },

  verifyInvoicePayment: async (payload) => {
    const res = await api.post(`/api/billing/invoice/${payload.invoiceId}/verify`, payload);
    return res.data;
  },

  initiatePlanPayment: async (planId) => {
    const res = await api.post("/api/billing/plan/initiate-payment", { planId });
    return res.data;
  },

  activatePlanNow: async (payload) => {
    const res = await api.post("/api/billing/plan/activate", payload);
    return res.data;
  },

  /* -------- STORE PROFILE -------- */

  getStoreProfile: async () => {
    const res = await api.get("/api/tenant/details");
    return res.data;
  },

  getAccountStatus: async () => {
    const res = await api.get("/api/tenant/account-status");
    return res.data;
  },

  updateTenantSupportContact: async ({ supportEmail, supportPhone, supportHours }) => {
    const res = await api.patch("/api/tenant/support-contact", {
      supportEmail,
      supportPhone,
      supportHours,
    });
    return res.data;
  },

};

