import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  unit: string;
}

export type AppliedCartCoupon = { code: string; discountAmount: number };

interface CartState {
  items: CartItem[];
  totalAmount: number;
  /** Set on cart bill summary; sent with place order from address / checkout. */
  appliedCoupon: AppliedCartCoupon | null;
}

const initialState: CartState = {
  items: [],
  totalAmount: 0,
  appliedCoupon: null,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    hydrateCart: (state, action: PayloadAction<Partial<CartState> & { items?: CartItem[] }>) => {
      const p = action.payload;
      state.items = Array.isArray(p.items) ? p.items : [];
      state.totalAmount = typeof p.totalAmount === 'number' ? p.totalAmount : 0;
      state.appliedCoupon =
        p.appliedCoupon && typeof p.appliedCoupon.code === 'string' && typeof p.appliedCoupon.discountAmount === 'number'
          ? { code: p.appliedCoupon.code, discountAmount: p.appliedCoupon.discountAmount }
          : null;
    },
    addToCart: (state, action: PayloadAction<any>) => {
      const existingItem = state.items.find(item => item.id === action.payload.id);
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
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
      state.appliedCoupon = null;
    },
    setAppliedCartCoupon: (state, action: PayloadAction<AppliedCartCoupon | null>) => {
      state.appliedCoupon = action.payload;
    },
    clearAppliedCartCoupon: (state) => {
      state.appliedCoupon = null;
    },
  },
});

export const { hydrateCart, addToCart, removeFromCart, clearCart, setAppliedCartCoupon, clearAppliedCartCoupon } =
  cartSlice.actions;
export default cartSlice.reducer;