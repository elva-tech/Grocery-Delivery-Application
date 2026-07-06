import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  MOCK_RIDERS,
  MOCK_BANNERS,
  MOCK_RETURNS
} from '../services/mockData';

import { apiService } from '../services/apiService';
import { formatDeliveryAddressSummary } from '../utils/deliveryAddress';
import { useToast } from './ToastContext';
import { useSocket } from '../hooks/useSocket';

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
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const totalStock =
    variants.length > 0
      ? variants.reduce((sum, v) => sum + (Number(v.availableQty) || 0), 0)
      : Number(p.availableQty ?? 0);
  const prices = variants.length > 0
    ? variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n) && n > 0)
    : [Number(p.price)].filter((n) => Number.isFinite(n) && n > 0);
  const priceMin = prices.length ? Math.min(...prices) : Number(p.price) || 0;
  const priceMax = prices.length ? Math.max(...prices) : Number(p.price) || 0;

  return {
  id:               String(p.productId || p._id || ''),
  productId:        String(p.productId || p._id || ''),
  name:             p.name,
  description:      p.description || '',
  price:            p.price,
  priceMin,
  priceMax,
  unit:             p.unit,
  variants,
  variantCount:     variants.length,
  imageUrl:         urls[0] || '',
  images:           imageRows,
  stock:            totalStock,
  availableQty:     totalStock,
  threshold:        p.thresholdQty ?? 10,
  thresholdQty:     p.thresholdQty ?? 10,
  status:           'Active',
  category:         p.category,
  subcategory:      p.subcategory,
  parentCategoryId: toCatId(p.category || 'uncategorized'),
  subCategoryId:    p.subcategory ? toSubId(p.subcategory) : null,
  returnAllowed:    p.returnAllowed !== false,
  productFeatures:  Array.isArray(p.productFeatures) ? p.productFeatures : [],
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

export function normalizeAdminOrderRow(o) {
  const da = o.deliveryAddress;
  const orderId = String(o._id ?? o.id ?? '').trim();
  const orderStatus = String(o.orderStatus ?? o.status ?? 'PLACED').trim().toUpperCase();
  return {
    ...o,
    _id: orderId,
    id: orderId,
    status: orderStatus,
    orderStatus,
    total: o.totalAmount,
    date: o.createdAt,
    assignment: o.riderId?.name || o.riderName || 'Pending',
    customer: o.customerName || o.userId?.name || 'Guest User',
    customerName: o.customerName || o.userId?.name || 'Guest User',
    customerPhone: String(o.customerPhone || o.userId?.phoneNumber || '').trim(),
    address: {
      full: formatDeliveryAddressSummary(da),
      addressUrl: typeof da?.addressUrl === 'string' ? da.addressUrl.trim() : '',
    },
    deliveryType: String(o.deliveryType || 'STANDARD').toUpperCase() === 'EXPRESS'
      ? 'EXPRESS'
      : 'STANDARD',
    paymentMode: o.paymentMode || 'ONLINE',
    paymentStatus: o.paymentStatus || 'PENDING',
    refundStatus: o.refundStatus || 'NONE',
    refundAmount: o.refundAmount,
    refundedAt: o.refundedAt,
    refundFailureReason: o.refundFailureReason || '',
    itemsText: (o.items || [])
      .map(i => `${i.name} x${i.qty}`)
      .join(', '),
  };
}

export function isPendingReturnRequest(r) {
  return String(r?.status || '').toLowerCase() === 'pending';
}

function normalizeReturnRow(r) {
  const evidence = r.evidenceImage || r.evidence || '';
  return {
    id: r._id,
    orderId: r.orderId?._id || r.orderId,
    orderTotal: r.orderId?.totalAmount,
    orderItems: r.orderId?.items || [],
    paymentMode: r.orderId?.paymentMode,
    customerName: r.userId?.name || 'Unknown',
    date: r.createdAt,
    status: String(r.status || '').toUpperCase(),
    reason: r.reason,
    amount: r.refundAmount,
    comment: r.customerComment,
    adminComment: r.resolutionNote,
    evidence,
  };
}

export const AppStateProvider = ({ children }) => {
  const { showToast } = useToast();
  const { subscribe, isConnected } = useSocket();

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
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [ridersLoading, setRidersLoading] = useState(false);
  const ordersRequestIdRef = useRef(0);

  const [riders, setRiders] = useState([]);

  const [banners, setBanners] = useState(() => {
    const saved = sessionStorage.getItem('app_banners');
    return saved ? JSON.parse(saved) : MOCK_BANNERS;
  });

  const [returns, setReturns] = useState([]);

  /* ---------- FETCH PRODUCTS FROM BACKEND ---------- */
  const fetchProductsFromAPI = useCallback(async () => {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
      setProductsLoading(false);
      return;
    }
    setProductsLoading(true);
    setProductsError(null);
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
      setProductsError('Failed to load inventory data');
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => { fetchProductsFromAPI(); }, [fetchProductsFromAPI]);

  const fetchReturns = useCallback(async () => {
    try {
      const token = localStorage.getItem('jwtToken');
      if (!token) return;
      const data = await apiService.getAllReturns();
      setReturns((data.data || []).map(normalizeReturnRow));
    } catch (err) {
      console.error('fetchReturns failed:', err);
      setReturns([]);
    }
  }, []);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  /* Poll returns so new refund requests show in alerts without manual refresh */
  useEffect(() => {
    const token = localStorage.getItem('jwtToken');
    if (!token) return undefined;
    const id = setInterval(() => {
      fetchReturns();
    }, 30000);
    return () => clearInterval(id);
  }, [fetchReturns]);

  const processReturnRequest = async (id, decision, resolutionNote, refundAmount) => {
    try {
      if (decision === 'APPROVE') {
        await apiService.approveReturn(id, resolutionNote, refundAmount);
        showToast('success', 'Refund initiated — amount will return to customer’s payment method.');
      } else if (decision === 'REJECT') {
        await apiService.rejectReturn(id, resolutionNote);
        showToast('success', 'Return request rejected.');
      }
      await fetchReturns();
      return true;
    } catch (err) {
      const msg =
        err?.response?.data?.message || err?.message || 'Failed to process return request.';
      showToast('error', msg);
      throw err;
    }
  };

  /* ---------- FETCH ORDERS ---------- */
  const fetchOrders = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent);
    const requestId = ++ordersRequestIdRef.current;

    const token = localStorage.getItem('jwtToken');
    if (!token) {
      return;
    }

    if (!silent) {
      setOrdersLoading(true);
      setOrdersError(null);
    }

    try {
      const data = await apiService.getOrders();
      if (requestId !== ordersRequestIdRef.current) return;

      const normalized = (data.orders || []).map(normalizeAdminOrderRow);
      setOrders(normalized);
      return normalized;
    } catch (err) {
      if (requestId !== ordersRequestIdRef.current) return;

      if (err.response?.status === 401) {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('freshroot_user');
        window.location.href = '/login';
        return;
      }
      console.error('Failed to fetch orders:', err);
      if (!silent) setOrdersError('Failed to load orders');
    } finally {
      if (!silent && requestId === ordersRequestIdRef.current) {
        setOrdersLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchOrders({ silent: true });
  }, [fetchOrders]);

  // Real-time order sync via Socket.IO (replaces aggressive polling)
  useEffect(() => {
    const seenNewOrders = new Set();

    const unsubNew = subscribe('new-order', (rawOrder) => {
      const normalized = normalizeAdminOrderRow(rawOrder);
      if (seenNewOrders.has(normalized.id)) return;
      seenNewOrders.add(normalized.id);

      setOrders((prev) => {
        if (prev.some((o) => o.id === normalized.id)) return prev;
        return [normalized, ...prev];
      });
    });

    const unsubUpdated = subscribe('order-updated', (rawOrder) => {
      const normalized = normalizeAdminOrderRow(rawOrder);
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === normalized.id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], ...normalized };
        return next;
      });
    });

    return () => {
      unsubNew();
      unsubUpdated();
    };
  }, [subscribe]);

  // Fallback poll while socket is disconnected
  useEffect(() => {
    const token = localStorage.getItem('jwtToken');
    if (!token) return undefined;
    const intervalMs = isConnected ? 60000 : 15000;
    const id = setInterval(() => {
      if (!isConnected) {
        fetchOrders({ silent: true });
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [fetchOrders, isConnected]);

  /* ---------- FETCH RIDERS ---------- */
  const fetchRiders = useCallback(async (opts = {}) => {
    const silent = Boolean(opts?.silent);
    const token = localStorage.getItem('jwtToken');
    if (!token) return;

    if (!silent) setRidersLoading(true);
    try {
      const data = await apiService.getRiders();
      const normalized = (data.data?.riders || []).map(r => ({
        ...r,
        id: r._id,
      }));
      setRiders(normalized);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('freshroot_user');
        window.location.href = '/login';
        return;
      }
      console.error('Failed to fetch riders:', err);
    } finally {
      if (!silent) setRidersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRiders({ silent: true });
  }, [fetchRiders]);

  const refreshAllAfterLogin = useCallback(() => {
    fetchProductsFromAPI();
    fetchOrders({ silent: false });
    fetchReturns();
    fetchRiders({ silent: true });
  }, [fetchProductsFromAPI, fetchOrders, fetchReturns, fetchRiders]);

  useEffect(() => {
    const onAuthChanged = () => refreshAllAfterLogin();
    window.addEventListener('admin-auth-changed', onAuthChanged);
    return () => window.removeEventListener('admin-auth-changed', onAuthChanged);
  }, [refreshAllAfterLogin]);

  /* ---------- SAVE STATE ---------- */
  useEffect(() => {
    sessionStorage.setItem('app_settings', JSON.stringify(appSettings));
    sessionStorage.setItem('app_banners',  JSON.stringify(banners));
  }, [banners, appSettings]);

  /* ---------- RIDER FUNCTIONS ---------- */

  const addRider = async (riderData) => {
    try {
      await apiService.createRider(riderData);
      await fetchRiders({ silent: true });
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
    const normalizedOrderId = String(orderId ?? '').trim();
    const normalizedRiderId = String(riderId ?? '').trim();
    if (!normalizedOrderId || !normalizedRiderId) {
      throw new Error('Order and rider are required');
    }
    await apiService.assignRiderToOrder(normalizedRiderId, normalizedOrderId);
    try {
      await fetchOrders({ silent: true });
      await fetchRiders({ silent: true });
    } catch (refreshErr) {
      console.warn('Assign succeeded but list refresh failed:', refreshErr);
    }
  };

  /* ---------- UPDATE ORDER STATUS ---------- */

  const updateOrderStatus = async (orderId, newStatus) => {

    try {

      const normalizedOrderId = String(orderId ?? '').trim();
      const result = await apiService.updateOrderStatus(normalizedOrderId, newStatus);

      await fetchOrders({ silent: true });

      if (result?.message) {
        showToast(
          result.refund?.success === false ? 'error' : 'success',
          result.message,
        );
      }

      return result;

    } catch (error) {

      console.error("Update order failed:", error);
      showToast('error', error?.response?.data?.message || 'Failed to update order');
      throw error;

    }

  };

  const retryOrderRefund = async (orderId) => {
    try {
      const result = await apiService.retryOrderRefund(orderId);
      const data = await apiService.getOrders();
      setOrders((data.orders || []).map(normalizeAdminOrderRow));
      showToast('success', result.message || 'Refund initiated');
      return result;
    } catch (error) {
      console.error("Retry refund failed:", error);
      showToast('error', error?.response?.data?.message || 'Refund failed');
      throw error;
    }
  };

  return (
    <AppStateContext.Provider value={{
      appSettings,
      loading: productsLoading,
      error: productsError,
      productsLoading,
      productsError,
      ordersLoading,
      ordersError,
      ridersLoading,
      updateSettings: (newSettings) =>
        setAppSettings(prev => ({ ...prev, ...newSettings })),

      products,
      categories,
      orders,
      riders,
      banners,
      returns,
      processReturnRequest,
      refreshReturns: fetchReturns,

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
      refreshRiders: fetchRiders,

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
      retryOrderRefund,
      markCODPaid: async (orderId) => {
        const data = await apiService.markCODPaid(orderId);
        setOrders(prev => prev.map(o =>
          (o.id === orderId || o._id === orderId)
            ? { ...o, paymentStatus: 'PAID' }
            : o
        ));
        return data;
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