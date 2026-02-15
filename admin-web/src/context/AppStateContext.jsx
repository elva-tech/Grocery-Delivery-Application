import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  MOCK_PRODUCTS, 
  MOCK_ORDERS, 
  MOCK_RIDERS, 
  MOCK_CATEGORIES, 
  MOCK_BANNERS
} from '../services/mockData';

const AppStateContext = createContext();

export const AppStateProvider = ({ children }) => {
  // 1. FIXED: Added setCategories setter
  const [products, setProducts] = useState(() => {
    const saved = sessionStorage.getItem('app_products');
    return saved ? JSON.parse(saved) : MOCK_PRODUCTS; 
  });

  const [categories, setCategories] = useState(() => {
    const saved = sessionStorage.getItem('app_categories');
    return saved ? JSON.parse(saved) : MOCK_CATEGORIES;
  });

  const [orders, setOrders] = useState(() => {
    const saved = sessionStorage.getItem('app_orders');
    const parsed = saved ? JSON.parse(saved) : MOCK_ORDERS;

    return parsed.map(o => {
      const numericTotal = Number(o.total || o.totalAmount);
      let normalizedAddress = o.address;

      if (typeof o.address === 'string') {
        normalizedAddress = {
          full: o.address,
          label: 'Default',
          phone: o.phone || 'N/A',
          altPhone: o.altPhone || 'N/A',
          landmark: o.landmark || ''
        };
      }

      if (typeof o.address === 'object' && o.address !== null) {
        const parts = [
          o.address.name,
          o.address.street,
          o.address.district,
          o.address.city,
          o.address.region,
          o.address.postalCode
        ].filter(Boolean);

        normalizedAddress = {
          ...o.address,
          full: parts.length > 0 ? parts.join(', ') : o.address.full || 'No Address Detail'
        };
      }

      return {
        ...o,
        address: normalizedAddress,
        total: isNaN(numericTotal) ? 0 : numericTotal,
        date: o.date || new Date().toISOString()
      };
    });
  });

  const [riders, setRiders] = useState(() => {
    const saved = sessionStorage.getItem('app_riders');
    return saved ? JSON.parse(saved) : MOCK_RIDERS;
  });

  const [banners, setBanners] = useState(() => {
    const saved = sessionStorage.getItem('app_banners');
    return saved ? JSON.parse(saved) : MOCK_BANNERS;
  });

  useEffect(() => {
    sessionStorage.setItem('app_products', JSON.stringify(products));
    sessionStorage.setItem('app_categories', JSON.stringify(categories));
    sessionStorage.setItem('app_orders', JSON.stringify(orders));
    sessionStorage.setItem('app_riders', JSON.stringify(riders));
    sessionStorage.setItem('app_banners', JSON.stringify(banners));
  }, [products, categories, orders, riders, banners]);

  // ACTIONS
  const addCategory = (c) => setCategories(prev => [...prev, c]);

  const addRider = (r) =>
    setRiders(prev => [...prev, { ...r, id: `r${Date.now()}`, activeOrders: 0 }]);

  const toggleRiderStatus = (id) => {
    setRiders(prev =>
      prev.map(r =>
        r.id === id ? { ...r, status: r.status === 'Online' ? 'Offline' : 'Online' } : r
      )
    );
  };

  const assignRider = (orderId, riderName) => {
    setOrders(prev =>
      prev.map(o =>
        o.id === orderId ? { ...o, assignment: riderName, status: 'OUT_FOR_DELIVERY' } : o
      )
    );

    setRiders(prev =>
      prev.map(r =>
        r.name === riderName ? { ...r, activeOrders: (r.activeOrders || 0) + 1 } : r
      )
    );
  };

  const updateOrderStatus = (orderId, newStatus) => {
    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId) {
          const nextStatus = newStatus?.toUpperCase();
          if ((nextStatus === 'DELIVERED' || nextStatus === 'CANCELLED') && o.assignment !== 'Pending') {
            setRiders(prevR =>
              prevR.map(r =>
                r.name === o.assignment ? { ...r, activeOrders: Math.max(0, (r.activeOrders || 0) - 1) } : r
              )
            );
          }
          return { ...o, status: nextStatus };
        }
        return o;
      })
    );
  };

  return (
    <AppStateContext.Provider value={{
      products,
      categories,
      orders,
      riders,
      banners,
      // 2. FIXED: Exposed addCategory and corrected addProduct ID logic
      addProduct: p => setProducts(prev => [...prev, { ...p, id: Date.now() }]),
      updateProduct: (id, up) => setProducts(prev => prev.map(p => p.id === id ? { ...p, ...up } : p)),
      deleteProduct: id => setProducts(prev => prev.filter(p => p.id !== id)),
      addCategory,
      updateOrderStatus,
      addRider,
      toggleRiderStatus,
      assignRider,
      addBanner: b => setBanners(prev => [...prev, { ...b, id: Date.now().toString() }]),
      deleteBanner: id => setBanners(prev => prev.filter(b => b.id !== id))
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