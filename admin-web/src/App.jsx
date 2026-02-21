import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppStateProvider } from './context/AppStateContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import Login from './modules/Auth/Login';
import ProductList from './modules/Products/ProductsList';
import OrderList from './modules/Orders/OrderList';
// import SalesReport from './modules/Reports/SalesReport'; 
import DashboardHome from './modules/Dashboard/DashboardHome'; 
import ReportsPage from './modules/Reports/ReportsPage';
import RiderManagement from './pages/Riders/RiderManagement';
import BannerManagement from './components/banner/BannerManagement';
import ReturnManagement from './modules/Orders/ReturnManagement';

function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              {/* REPLACED THE PLACEHOLDER WITH REAL COMPONENT */}
              <Route index element={<DashboardHome />} /> 
              
              <Route path="products" element={<ProductList />} />
              <Route path="orders" element={<OrderList />} />
              {/* <Route path="reports" element={<SalesReport />} /> */}
              <Route path="export" element={<ReportsPage />} />
              <Route path="/riders" element={<RiderManagement />} />
              <Route path="/returns" element={<ReturnManagement />} />
              <Route path="/banners" element={<BannerManagement />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppStateProvider>
    </AuthProvider>
  );
}

export default App;