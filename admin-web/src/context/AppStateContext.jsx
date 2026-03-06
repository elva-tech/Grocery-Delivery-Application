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

  /* ---------- LOADING + ERROR STATE ---------- */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const [riders, setRiders] = useState(() => {
    const saved = sessionStorage.getItem('app_riders');
    return saved ? JSON.parse(saved) : MOCK_RIDERS;
  });

  const [banners, setBanners] = useState(() => {
    const saved = sessionStorage.getItem('app_banners');
    return saved ? JSON.parse(saved) : MOCK_BANNERS;
  });

  const [returns, setReturns] = useState(() => {
    const saved = sessionStorage.getItem('app_returns');
    return saved ? JSON.parse(saved) : (MOCK_RETURNS || []);
  });

  /* ---------- FETCH ORDERS ---------- */
  const fetchOrders = async () => {
    try {

      setLoading(true);
      setError(null);

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

      console.error("Failed to fetch orders:", err);

      setError("Unable to load orders. Please try again.");

    } finally {

      setLoading(false);

    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  /* ---------- SAVE STATE ---------- */
  useEffect(() => {
    sessionStorage.setItem('app_settings', JSON.stringify(appSettings));
    sessionStorage.setItem('app_products', JSON.stringify(products));
    sessionStorage.setItem('app_categories', JSON.stringify(categories));
    sessionStorage.setItem('app_riders', JSON.stringify(riders));
    sessionStorage.setItem('app_returns', JSON.stringify(returns));
    sessionStorage.setItem('app_banners', JSON.stringify(banners));
  }, [products, categories, riders, banners, returns, appSettings]);

  /* ---------- RIDER FUNCTIONS ---------- */

  const addRider = (r) =>
    setRiders(prev => [...prev, { ...r, id: `r${Date.now()}`, activeOrders: 0 }]);

  const toggleRiderStatus = (id) => {
    setRiders(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: r.status === 'Online' ? 'Offline' : 'Online' }
          : r
      )
    );
  };

  const assignRider = (orderId, riderName) => {
    setOrders(prev =>
      prev.map(o =>
        o.id === orderId
          ? { ...o, assignment: riderName, status: 'OUT_FOR_DELIVERY' }
          : o
      )
    );
  };

  /* ---------- UPDATE ORDER STATUS ---------- */

  const updateOrderStatus = async (orderId, newStatus) => {

    try {

      setLoading(true);

      await apiService.updateOrderStatus(orderId, newStatus);

      await fetchOrders();

    } catch (err) {

      console.error("Update order failed:", err);

      setError("Failed to update order status.");

    } finally {

      setLoading(false);

    }

  };

  return (
    <AppStateContext.Provider value={{
      appSettings,
      updateSettings: (newSettings) =>
        setAppSettings(prev => ({ ...prev, ...newSettings })),

      products,
      categories,
      orders,
      riders,
      banners,
      returns,

      loading,
      error,

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
  if (!context) throw new Error('useAppState must be used within an AppStateProvider');
  return context;
}