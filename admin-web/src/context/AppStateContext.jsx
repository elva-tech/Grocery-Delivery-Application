import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  MOCK_RIDERS,
  MOCK_BANNERS,
  MOCK_RETURNS
} from '../services/mockData';

import { apiService } from '../services/apiService';
import { formatDeliveryAddressSummary } from '../utils/deliveryAddress';
import { useToast } from './ToastContext';

// ── helpers to normalise backend category/subcategory strings into stable IDs ──
const toCatId = s =>
  'cat_' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const toSubId = s =>
  'sub_' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** Preserve Cloudinary public_id for admin deletes / updates. */
const imagesFromPayload = (p) => {
  if (Array.isArray(p.images) && p.images.length) {
    return p.images
      .map((img) => {
        if (!img || typeof img !== 'object') return null;
        const url = typeof img.url === 'string' ? img.url.trim() : '';
        if (!url) return null;
        const public_id =
          typeof img.public_id === 'string' ? img.public_id.trim() : '';
        return { url, public_id };
      })
      .filter(Boolean);
  }
  if (typeof p.imageUrl === 'string' && p.imageUrl.trim()) {
    return [{ url: p.imageUrl.trim(), public_id: '' }];
  }
  return [];
};

const normaliseProduct = p => {
  const imageRows = imagesFromPayload(p);
  const urls = imageRows.map((r) => r.url);
  return {
  id:               String(p.productId || p._id || ''),
  productId:        String(p.productId || p._id || ''),
  name:             p.name,
  description:      p.description || '',
  price:            p.price,
  unit:             p.unit,
  imageUrl:         urls[0] || '',
  images:           imageRows,
  stock:            p.availableQty ?? 0,
  availableQty:     p.availableQty ?? 0,
  threshold:        p.thresholdQty ?? 10,
  thresholdQty:     p.thresholdQty ?? 10,
  status:           'Active',
  category:         p.category,
  subcategory:      p.subcategory,
  parentCategoryId: toCatId(p.category || 'uncategorized'),
  subCategoryId:    p.subcategory ? toSubId(p.subcategory) : null,
};
};

const buildCategories = items => {
  const parents = new Map();
  const subs    = new Map();
  items.forEach(p => {
    const catId = toCatId(p.category || 'uncategorized');
    if (!parents.has(catId))
      parents.set(catId, { id: catId, name: p.category || 'Uncategorized', parentId: null, icon: 'grid-outline', image: [] });
    if (p.subcategory) {
      const subId = toSubId(p.subcategory);
      if (!subs.has(subId))
        subs.set(subId, { id: subId, name: p.subcategory, parentId: catId, icon: 'pricetag-outline', image: [] });
    }
  });
  return [...parents.values(), ...subs.values()];
};

const AppStateContext = createContext();

export const AppStateProvider = ({ children }) => {
  const { showToast } = useToast();

  /* ---------- SETTINGS ---------- */
  const [appSettings, setAppSettings] = useState(() => {
    const saved = sessionStorage.getItem('app_settings');
    return saved ? JSON.parse(saved) : {
      allowRefunds: true,
      allowReportIssue: true,
      allowOrderCancellation: true
    };
  });

  // Initialise empty — populated by fetchProductsFromAPI on mount
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);

  const [orders, setOrders] = useState([]);

  /* -------- LOADING + ERROR STATE -------- */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [riders, setRiders] = useState([]);

  const [banners, setBanners] = useState(() => {
    const saved = sessionStorage.getItem('app_banners');
    return saved ? JSON.parse(saved) : MOCK_BANNERS;
  });

  const [returns, setReturns] = useState([]);

  /* ---------- FETCH PRODUCTS FROM BACKEND ---------- */
  const fetchProductsFromAPI = useCallback(async () => {
    const token = localStorage.getItem('jwtToken');
    if (!token) return;
    try {
      const data = await apiService.getInventory();
      const items = data.data || [];
      setProducts(items.map(normaliseProduct));
      // Categories are derived from products; keep in-session "New Category" rows until a product uses them
      setCategories((prev) => {
        const fromProducts = buildCategories(items);
        const ids = new Set(fromProducts.map((c) => c.id));
        const extras = prev.filter((c) => !ids.has(c.id));
        return [...fromProducts, ...extras];
      });
      // Remove stale cached data so re-mounts always show fresh backend data
      sessionStorage.removeItem('app_products');
      sessionStorage.removeItem('app_categories');
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  }, []);

  useEffect(() => { fetchProductsFromAPI(); }, [fetchProductsFromAPI]);

  // Fetch returns from backend
  useEffect(() => {
    const fetchReturns = async () => {
      try {
        const token = localStorage.getItem('jwtToken');
        if (!token) return;
        const data = await apiService.getAllReturns();
        // Normalize for frontend usage
        const normalized = (data.data || []).map(r => ({
          id: r._id,
          orderId: r.orderId?._id || r.orderId,
          customerName: r.userId?.name || 'Unknown',
          date: r.createdAt,
          status: (r.status || '').toUpperCase(),
          reason: r.reason,
          amount: r.refundAmount,
          comment: r.customerComment,
          adminComment: r.resolutionNote,
         evidence: r.evidenceImage || r.evidence || '',
        }));
        setReturns(normalized);
      } catch (err) {
        setReturns([]);
      }
    };
    fetchReturns();
  }, []);
  // Process return request (approve/reject)
  const processReturnRequest = async (id, decision, resolutionNote) => {
    try {
      if (decision === 'APPROVE') {
        await apiService.approveReturn(id, resolutionNote);
      } else if (decision === 'REJECT') {
        await apiService.rejectReturn(id, resolutionNote);
      }
      // Refresh returns after action
      const data = await apiService.getAllReturns();
      const normalized = (data.data || []).map(r => ({
        id: r._id,
        orderId: r.orderId?._id || r.orderId,
        customerName: r.userId?.name || 'Unknown',
        date: r.createdAt,
        status: (r.status || '').toUpperCase(),
        reason: r.reason,
        amount: r.refundAmount,
        comment: r.customerComment,
        adminComment: r.resolutionNote,
        evidence: r.evidenceImage || r.evidence || '',
      }));
      setReturns(normalized);
    } catch (err) {
      showToast('error', 'Failed to process return request.');
    }
  };

  /* ---------- FETCH ORDERS ---------- */
  const fetchOrders = useCallback(async () => {

    // Only fetch if user has a token
    const token = localStorage.getItem('jwtToken');
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {

      const data = await apiService.getOrders();

      const normalized = (data.orders || []).map(o => ({
        ...o,
        id: o._id,
        status: o.orderStatus,
        total: o.totalAmount,
        date: o.createdAt,
        assignment: o.riderId?.name || o.riderName || "Pending",
        customer: o.customerName || o.userId?.name || "Guest User",
        customerName: o.customerName || o.userId?.name || "Guest User",
        address: {
          full: formatDeliveryAddressSummary(o.deliveryAddress),
        },
        paymentMode: o.paymentMode || "ONLINE",
        paymentStatus: o.paymentStatus || "PENDING",
        itemsText: (o.items || [])
          .map(i => `${i.name} x${i.qty}`)
          .join(", ")
      }));

      setOrders(normalized);

    } catch (err) {

      // Handle 401 - redirect to login
      if (err.response?.status === 401) {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('freshroot_user');
        window.location.href = '/login';
        return;
      }

      console.error("Failed to fetch orders:", err);
      setError("Failed to load orders");

    } finally {

      setLoading(false);

    }

  }, []);

  /* ---------- FETCH RIDERS ---------- */
  useEffect(() => {

    const fetchRiders = async () => {

      // Only fetch if user has a token
      const token = localStorage.getItem('jwtToken');
      if (!token) {
        return;
      }

      try {

        const data = await apiService.getRiders();

        const normalized = (data.data?.riders || []).map(r => ({
          ...r,
          id: r._id,
        }));

        setRiders(normalized);

      } catch (err) {

        // Handle 401 - redirect to login
        if (err.response?.status === 401) {
          localStorage.removeItem('jwtToken');
          localStorage.removeItem('freshroot_user');
          window.location.href = '/login';
          return;
        }

        console.error("Failed to fetch riders:", err);

      }

    };

    fetchRiders();

  }, []);

  /* ---------- SAVE STATE ---------- */
  useEffect(() => {
    sessionStorage.setItem('app_settings', JSON.stringify(appSettings));
    sessionStorage.setItem('app_banners',  JSON.stringify(banners));
  }, [banners, appSettings]);

  /* ---------- RIDER FUNCTIONS ---------- */

  const addRider = async (riderData) => {
    try {
      // Call API to create rider
      await apiService.createRider(riderData);
      
      // Fetch updated riders list
      const data = await apiService.getRiders();
      const normalized = (data.data?.riders || []).map(r => ({
        ...r,
        id: r._id,
      }));
      
      setRiders(normalized);
    } catch (error) {
      console.error("Add rider failed:", error);
      throw error;
    }
  };

  const toggleRiderStatus = async (id, newStatus) => {
    try {
      // Call API to update rider status
      await apiService.updateRiderStatus(id, newStatus);
      
      // Update local state
      setRiders(prev =>
        prev.map(r =>
          r.id === id || r._id === id
            ? { ...r, status: newStatus }
            : r
        )
      );
    } catch (error) {
      console.error("Toggle rider status failed:", error);
      throw error;
    }
  };

  const assignRider = async (orderId, riderId, riderName) => {
    try {
      // Call API to assign rider
      await apiService.assignRiderToOrder(riderId, orderId);

      // Fetch updated orders
      const data = await apiService.getOrders();

      const normalized = (data.orders || []).map(o => ({
        ...o,
        id: o._id,
        status: o.orderStatus,
        total: o.totalAmount,
        date: o.createdAt,
        assignment: o.riderId?.name || o.riderName || "Pending",
        customer: o.customerName || o.userId?.name || "Guest User",
        customerName: o.customerName || o.userId?.name || "Guest User",
        address: {
          full: formatDeliveryAddressSummary(o.deliveryAddress),
        },
        paymentMode: o.paymentMode || "ONLINE",
        paymentStatus: o.paymentStatus || "PENDING",
        itemsText: (o.items || [])
          .map(i => `${i.name} x${i.qty}`)
          .join(", ")
      }));

      setOrders(normalized);
    } catch (error) {
      console.error("Assign rider failed:", error);
      throw error;
    }
  };

  /* ---------- UPDATE ORDER STATUS ---------- */

  const updateOrderStatus = async (orderId, newStatus) => {

    try {

      await apiService.updateOrderStatus(orderId, newStatus);

      const data = await apiService.getOrders();

      const normalized = (data.orders || []).map(o => ({
        ...o,
        id: o._id,
        status: o.orderStatus,
        total: o.totalAmount,
        date: o.createdAt,
        assignment: o.riderName || "Pending",
        customer: o.customerName || o.userId?.name || "Guest User",
        customerName: o.customerName || o.userId?.name || "Guest User",
        address: {
          full: formatDeliveryAddressSummary(o.deliveryAddress),
        },
        paymentMode: o.paymentMode || "ONLINE",
        paymentStatus: o.paymentStatus || "PENDING",
        itemsText: (o.items || [])
          .map(i => `${i.name} x${i.qty}`)
          .join(", ")
      }));

      setOrders(normalized);

    } catch (error) {

      console.error("Update order failed:", error);

    }

  };

  return (
    <AppStateContext.Provider value={{
      appSettings,
      loading,
      error,
      updateSettings: (newSettings) =>
        setAppSettings(prev => ({ ...prev, ...newSettings })),

      products,
      categories,
      orders,
      riders,
      banners,
      returns,
      processReturnRequest,

      // Product CRUD — all trigger a backend refetch so the list stays in sync
      addProduct:    async () => { await fetchProductsFromAPI(); },
      updateProduct: async () => { await fetchProductsFromAPI(); },
      deleteProduct: async (id) => {
        try {
          await apiService.deleteProduct(id);
          await fetchProductsFromAPI();
        } catch (err) {
          console.error('Delete product failed:', err);
          showToast('error', err?.response?.data?.message || 'Failed to delete product');
        }
      },
      refreshProducts: fetchProductsFromAPI,
      refreshOrders: fetchOrders,

      addCategory: c => {
        const id = c.parentId ? toSubId(c.name) : toCatId(c.name);
        setCategories(prev =>
          prev.some(cat => cat.id === id) ? prev : [...prev, { ...c, id }]
        );
      },

      updateCategory: (id, up) =>
        setCategories(prev => prev.map(c => c.id === id ? { ...c, ...up } : c)),

      deleteCategory: id =>
        setCategories(prev => prev.filter(c => c.id !== id)),

      updateOrderStatus,
      markCODPaid: async (orderId) => {
        await apiService.markCODPaid(orderId);
        setOrders(prev => prev.map(o =>
          (o.id === orderId || o._id === orderId)
            ? { ...o, paymentStatus: 'PAID' }
            : o
        ));
      },
      addRider,
      toggleRiderStatus,
      assignRider,

      addBanner: b =>
        setBanners(prev => [...prev, { ...b, id: Date.now().toString() }]),

      deleteBanner: id =>
        setBanners(prev => prev.filter(b => b.id !== id)),
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

export function useAppState() {

  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }

  return context;

}