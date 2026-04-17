import { configureStore } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authReducer from './slices/authSlice';
import cartReducer from './slices/cartSlice';
import { apiSlice } from '@/api/apiSlice';

export const CART_STORAGE_KEY = '@enandi_cart';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});

// Persist cart to AsyncStorage on every state change
let lastCart = store.getState().cart;
store.subscribe(() => {
  const current = store.getState().cart;
  if (current !== lastCart) {
    lastCart = current;
    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;