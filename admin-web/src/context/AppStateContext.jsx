import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  MOCK_PRODUCTS,
  MOCK_RIDERS,
  MOCK_CATEGORIES,
  MOCK_BANNERS,
  MOCK_RETURNS
} from '../services/mockData';

import { apiService } from '../services/apiService';

const AppStateContext = createContext();

export const AppStateProvider = ({ children }) => {

  /* ---------- SETTINGS ---------- */
  const [appSettings, setAppSettings] = useState(() => {
    const saved = sessionStorage.getItem('app_settings');
    return saved ? JSON.parse(saved) : {
      allowRefunds: true,
      allowReportIssue: true,
      allowOrderCancellation: true
    };
  });

  const [products, setProducts] = useState(() => {
    const saved = sessionStorage.getItem('app_products');
    return saved ? JSON.parse(saved) : MOCK_PRODUCTS;
  });

  const [categories, setCategories] = useState(() => {
    const saved = sessionStorage.getItem('app_categories');
    return saved ? JSON.parse(saved) : MOCK_CATEGORIES;
  });

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

  // Fetch returns from backend
  useEffect(() => {
    const fetchReturns = async () => {
      try {
        const token = localStorage.getItem('jwtToken');
        if (!token) return;
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
          evidence: r.evidence || '',
        }));
        setReturns(normalized);
      } catch (err) {
        setReturns([]);
      }
    };
    fetchReturns();
  }, []);

  // Process return request
  const processReturnRequest = async (id, decision, resolutionNote) => {
    try {
      if (decision === 'APPROVE') {
        await apiService.approveReturn(id, resolutionNote);
      } else if (decision === 'REJECT') {
        await apiService.rejectReturn(id, resolutionNote);
      }

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
        evidence: r.evidence || '',
      }));

      setReturns(normalized);
    } catch (err) {
      alert('Failed to process return request.');
    }
  };

  /* ---------- FETCH ORDERS ---------- */
  useEffect(() => {
    const fetchOrders = async () => {
      const token = localStorage.getItem('jwtToken');
      if (!token) return;

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
          customer: o.userId?.name || "Guest User",
          address: {
            full: o.deliveryAddress?.line1 || "No Address"
          },
          itemsText: (o.items || [])
            .map(i => `${i.name} x${i.qty}`)
            .join(", ")
        }));

        setOrders(normalized);

      } catch (err) {
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
    };

    fetchOrders();
  }, []);

  /* ---------- FETCH RIDERS ---------- */
  useEffect(() => {
    const fetchRiders = async () => {
      const token = localStorage.getItem('jwtToken');
      if (!token) return;

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

        console.error("Failed to fetch riders:", err);
      }
    };

    fetchRiders();
  }, []);

  /* ---------- SAVE STATE ---------- */
  useEffect(() => {
    sessionStorage.setItem('app_settings', JSON.stringify(appSettings));
    sessionStorage.setItem('app_products', JSON.stringify(products));
    sessionStorage.setItem('app_categories', JSON.stringify(categories));
    sessionStorage.setItem('app_returns', JSON.stringify(returns));
    sessionStorage.setItem('app_banners', JSON.stringify(banners));
  }, [products, categories, banners, returns, appSettings]);

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

      addProduct: p =>
        setProducts(prev => [...prev, { ...p, id: `p${Date.now()}` }]),

      updateProduct: (id, up) =>
        setProducts(prev => prev.map(p => p.id === id ? { ...p, ...up } : p)),

      deleteProduct: id =>
        setProducts(prev => prev.filter(p => p.id !== id)),

      addCategory: c =>
        setCategories(prev => [...prev, { ...c, id: `cat${Date.now()}` }]),

      updateCategory: (id, up) =>
        setCategories(prev => prev.map(c => c.id === id ? { ...c, ...up } : c)),

      deleteCategory: id =>
        setCategories(prev => prev.filter(c => c.id !== id)),

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