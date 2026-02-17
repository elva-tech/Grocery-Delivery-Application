import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // 1. Initialize from LocalStorage so reload doesn't logout
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('freshroot_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = (credentials) => {
    if (credentials.email === 'admin@test.com' && credentials.password === 'admin123') {
      const userData = { name: 'System Admin', role: 'admin' };
      
      // 2. Save to state AND LocalStorage
      setUser(userData);
      localStorage.setItem('freshroot_user', JSON.stringify(userData));
      return true;
    }
    return false;
  };

  const logout = () => {
    // 3. Clear both on logout
    setUser(null);
    localStorage.removeItem('freshroot_user');
    // Optional: Force clear session to ensure redirect
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