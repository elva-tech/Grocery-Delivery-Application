import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { AppStateProvider } from './context/AppStateContext';
import { TenantBrandingProvider } from './context/TenantBrandingContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* AuthProvider MUST be outside App for useAuth() to work inside App */}
    <AuthProvider>
      <TenantBrandingProvider>
        <App />
      </TenantBrandingProvider>
    </AuthProvider>
  </React.StrictMode>
);