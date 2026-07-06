import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { clearPersistedCart, loadPersistedCart } from '../../utils/cartStorage';

export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  unit: string;
  stock?: number;
}

interface CartState {
  items: CartItem[];
  totalAmount: number;
}

const persisted = loadPersistedCart();

const initialState: CartState = {
  items: persisted.items,
  totalAmount: persisted.totalAmount,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    hydrateCart: (state, action: PayloadAction<{ items?: CartItem[]; totalAmount?: number }>) => {
      const items = Array.isArray(action.payload.items) ? action.payload.items : [];
      state.items = items;
      state.totalAmount =
        typeof action.payload.totalAmount === 'number'
          ? action.payload.totalAmount
          : items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    },
    addToCart: (state, action: PayloadAction<CartItem>) => {
      const maxStock = action.payload.stock;
      const existingItem = state.items.find(item => item.id === action.payload.id);
      if (existingItem) {
        if (maxStock != null && maxStock > 0 && existingItem.quantity >= maxStock) return;
        existingItem.quantity += 1;
        if (maxStock != null) existingItem.stock = maxStock;
      } else {
        if (maxStock != null && maxStock <= 0) return;
        state.items.push({ ...action.payload, quantity: 1 });
      }
      state.totalAmount += action.payload.price;
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      const index = state.items.findIndex(item => item.id === action.payload);
      if (index !== -1) {
        state.totalAmount -= state.items[index].price;
        if (state.items[index].quantity > 1) {
          state.items[index].quantity -= 1;
        } else {
          state.items.splice(index, 1);
        }
      }
    },
    clearCart: (state) => {
      state.items = [];
      state.totalAmount = 0;
      clearPersistedCart();
    },
  },
});

export const { hydrateCart, addToCart, removeFromCart, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
