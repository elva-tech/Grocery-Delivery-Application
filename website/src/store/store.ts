import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import cartReducer from './slices/cartSlice';
import { apiSlice } from '../api/apiSlice';
import { savePersistedCart } from '../utils/cartStorage';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});

let lastCartSnapshot = JSON.stringify(store.getState().cart);
store.subscribe(() => {
  const cart = store.getState().cart;
  const snapshot = JSON.stringify(cart);
  if (snapshot === lastCartSnapshot) return;
  lastCartSnapshot = snapshot;
  savePersistedCart(cart.items, cart.totalAmount);
});

// These MUST be exported for Orders.tsx to work
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;