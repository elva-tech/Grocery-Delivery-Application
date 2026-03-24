import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppStateProvider, useAppState } from './context/AppStateContext'; // Added useAppState
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
import Signup from './modules/Auth/SignUp';

// Create a helper component to handle the conditional logic inside the Router
const AppRoutes = () => {
  const { appSettings } = useAppState();

  return (
    <Routes>
      <Route path="/signup" element={<Signup/>} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<DashboardHome />} /> 
        <Route path="products" element={<ProductList />} />
        <Route path="orders" element={<OrderList />} />
        <Route path="export" element={<ReportsPage />} />
        <Route path="/riders" element={<RiderManagement />} />
        
        {/* PROTECTED RETURN ROUTE: Redirects to home if disabled */}
        <Route 
          path="/returns" 
          element={
            appSettings.allowRefunds 
              ? <ReturnManagement /> 
              : <Navigate to="/" replace />
          } 
        />

        <Route path="/banners" element={<BannerManagement />} />
      </Route>
      {/* Catch all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppStateProvider>
    </AuthProvider>
  );
}

export default App;