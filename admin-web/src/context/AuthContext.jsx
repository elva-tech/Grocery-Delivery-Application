import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('freshroot_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = (credentials) => {

    // DEFAULT LOGIN (DO NOT CHANGE)
    if (
      credentials.email === 'admin@test.com' &&
      credentials.password === 'admin123'
    ) {

      const userData = {
        name: 'System Admin',
        role: 'admin',
      };

      

      setUser(userData);
      localStorage.setItem('freshroot_user', JSON.stringify(userData));

      return true;
    }

    return false;
  };

  const logout = () => {

    setUser(null);

    localStorage.removeItem('freshroot_user');
    localStorage.removeItem('jwtToken');

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