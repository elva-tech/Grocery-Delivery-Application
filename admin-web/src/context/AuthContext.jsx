import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

  // keep login after refresh
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

      
      localStorage.setItem(
        "jwtToken",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OThmMjZkODBkYmYwOGE5NTJiNGQ2ZTQiLCJyb2xlIjoiQURNSU4iLCJ0ZW5hbnRJZCI6ImRlbW8tdGVuYW50IiwiaWF0IjoxNzcyNDUxMDE5LCJleHAiOjE3NzMwNTU4MTl9.R0HknMM2tSrbKA84pIrCuHdVqhVhyrOYU3Fd_-e-aGQ"
      );

      // existing logic
      setUser(userData);
      localStorage.setItem('freshroot_user', JSON.stringify(userData));

      return true;
    }

    return false;
  };

  const logout = () => {
    setUser(null);

    // remove both user + token
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