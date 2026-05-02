import { createContext, useContext, useState } from 'react';
import { apiService } from '../services/apiService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

  const envTenantId = String(import.meta.env.VITE_TENANT_ID || '').trim().toLowerCase();

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('freshroot_user');
    if (!savedUser) return null;
    try {
      const parsed = JSON.parse(savedUser);
      const savedTenant = String(parsed?.tenantId || '').trim().toLowerCase();
      // If env tenant changed, force fresh login for correct tenant context.
      if (envTenantId && savedTenant && savedTenant !== envTenantId) {
        localStorage.removeItem('freshroot_user');
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('token');
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const login = async (phoneNumber, otp) => {
    try {
      const response = await apiService.verifyOtp(phoneNumber, otp);
      

      if (response.success && response.token) {
        const userData = {
          id: response.user.id,
          phoneNumber: response.user.phoneNumber,
          role: response.user.role,
          tenantId: response.user.tenantId,
        };

        setUser(userData);
        localStorage.setItem('freshroot_user', JSON.stringify(userData));
        localStorage.setItem('jwtToken', response.token);
        // Remove any old 'token' key to avoid confusion
        localStorage.removeItem('token');

        return { success: true, user: userData };
      }

      return { success: false, message: response.message || "Login failed" };
    } catch (error) {
      console.error("Login error:", error);
      const msg =
        (error.response && error.response.data && error.response.data.message) ||
        error.message ||
        "Login failed";
      return { success: false, message: msg };
    }
  };

  const logout = () => {

    setUser(null);

    localStorage.removeItem('freshroot_user');
    localStorage.removeItem('jwtToken');
    // Remove any 'token' key to avoid confusion
    localStorage.removeItem('token');

    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {

  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};