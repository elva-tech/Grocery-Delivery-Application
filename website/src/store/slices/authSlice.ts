import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  user: any | null;
  token: string | null;
  isAuthenticated: boolean;
}

// Load persisted data from localStorage
const loadPersistedAuth = () => {
  try {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      return {
        user: JSON.parse(user),
        token,
        isAuthenticated: true,
      };
    }
  } catch (error) {
    console.error('Error loading persisted auth:', error);
  }
  return {
    user: null,
    token: null,
    isAuthenticated: false,
  };
};

const initialState: AuthState = loadPersistedAuth();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: any; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      // Clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Remove any 'jwtToken' key to avoid confusion
      localStorage.removeItem('jwtToken');
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;