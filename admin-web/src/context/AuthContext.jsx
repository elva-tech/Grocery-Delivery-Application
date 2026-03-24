import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // 1. Initialize from LocalStorage so reload doesn't logout
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('freshroot_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // Helper to manage our "Mock Database" in LocalStorage
  const getStoredUsers = () => JSON.parse(localStorage.getItem('freshroot_db_users') || '[]');

  const signup = (userData) => {
    const users = getStoredUsers();
    if (users.find(u => u.email === userData.email)) {
      return { success: false, msg: 'Admin already exists with this email.' };
    }
    const newList = [...users, userData];
    localStorage.setItem('freshroot_db_users', JSON.stringify(newList));
    return { success: true };
  };

  const login = (credentials) => {
    // Check against the dynamic "database" first
    const users = getStoredUsers();
    const found = users.find(u => u.email === credentials.email && u.password === credentials.password);

    // Fallback to your original hardcoded admin for testing
    const isHardcoded = credentials.email === 'admin@test.com' && credentials.password === 'admin123';

    if (found || isHardcoded) {
      const userData = found ? { name: found.name, email: found.email, role: 'admin' } 
                             : { name: 'System Admin', role: 'admin' };
      
      // 2. Save to state AND LocalStorage
      setUser(userData);
      localStorage.setItem('freshroot_user', JSON.stringify(userData));
      return { success: true };
    }
    return { success: false, msg: 'Invalid credentials.' };
  };

  // UPDATED: Production-ready async reset logic
  const resetPassword = async (email, newPassword) => {
    // Simulate API Delay
    return new Promise((resolve) => {
      setTimeout(() => {
        let users = getStoredUsers();
        const index = users.findIndex(u => u.email === email);
        
        if (index === -1) {
          resolve({ success: false, msg: 'Email not found in system.' });
        } else {
          users[index].password = newPassword;
          localStorage.setItem('freshroot_db_users', JSON.stringify(users));
          resolve({ success: true });
        }
      }, 1000); // 1 second "network" delay
    });
  };

  const logout = () => {
    // 3. Clear both on logout
    setUser(null);
    localStorage.removeItem('freshroot_user');
    // Optional: Force clear session to ensure redirect
    window.location.href = '/login'; 
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, resetPassword }}>
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