import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppStateProvider, useAppState } from './context/AppStateContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import Login from './modules/Auth/Login';
import ProductList from './modules/Products/ProductsList';
import OrderList from './modules/Orders/OrderList';
import DashboardHome from './modules/Dashboard/DashboardHome'; 
import ReportsPage from './modules/Reports/ReportsPage';
import RiderManagement from './pages/Riders/RiderManagement';
import BannerManagement from './components/banner/BannerManagement';
import ReturnManagement from './modules/Orders/ReturnManagement';
import SettingsPage from './modules/Settings/SettingsPage';
import CouponManagement from './modules/Coupons/CouponManagement';

import PaymentPlan from './modules/Settings/PaymentPlan';
import Schedule from './modules/Settings/Schedule';
import StoreProfilePage from './modules/Settings/StoreProfilePage';

// Create a helper component to handle the conditional logic inside the Router
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<DashboardHome />} /> 
        <Route path="products" element={<ProductList />} />
        <Route path="orders" element={<OrderList />} />
        <Route path="export" element={<ReportsPage />} />
        <Route path="/riders" element={<RiderManagement />} />
        <Route path="/settings/payment-plan" element={<PaymentPlan />} />
        <Route path="/settings/schedule" element={<Schedule />} />

        
        {/* PROTECTED RETURN ROUTE: Redirects to home if disabled */}
        <Route 
          path="/returns" 
          element={<ReturnManagementWrapper />} 
        />

        <Route path="/banners" element={<BannerManagement />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/coupons" element={<CouponManagement />} />
        <Route path="store-profile" element={<StoreProfilePage />} />
      </Route>
      {/* Catch all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// Wrapper component that uses AppState context only when rendered
const ReturnManagementWrapper = () => {
  const { appSettings } = useAppState();
  
  if (!appSettings.allowRefunds) {
    return <Navigate to="/" replace />;
  }
  
  return <ReturnManagement />;
};

function App() {
  return (
    <ToastProvider>
      <AppStateProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppStateProvider>
    </ToastProvider>
  );
}

export default App;