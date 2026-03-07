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

  const [returns, setReturns] = useState(() => {
    const saved = sessionStorage.getItem('app_returns');
    return saved ? JSON.parse(saved) : (MOCK_RETURNS || []);
  });

  /* ---------- FETCH ORDERS ---------- */
  useEffect(() => {

    const fetchOrders = async () => {

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
          assignment: o.riderName || "Pending",
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

    };

    fetchOrders();

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
    sessionStorage.setItem('app_products', JSON.stringify(products));
    sessionStorage.setItem('app_categories', JSON.stringify(categories));
    sessionStorage.setItem('app_returns', JSON.stringify(returns));
    sessionStorage.setItem('app_banners', JSON.stringify(banners));
  }, [products, categories, banners, returns, appSettings]);

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
        assignment: o.riderName || "Pending",
        customer: o.userId?.name || "Guest User",
        address: {
          full: o.deliveryAddress?.line1 || "No Address"
        },
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
        customer: o.userId?.name || "Guest User",
        address: {
          full: o.deliveryAddress?.line1 || "No Address"
        },
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

      updateOrderStatus,
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