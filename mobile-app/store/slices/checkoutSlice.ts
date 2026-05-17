import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type CheckoutOrderMode = 'self' | 'others';

/** Raw delivery payload passed to `buildDeliveryAddressPayload` at place-order time. */
export type CheckoutDeliverySource = Record<string, unknown>;

export type CheckoutDraft = {
  orderMode: CheckoutOrderMode;
  deliverySource: CheckoutDeliverySource;
  addressUrl: string;
  summaryText: string;
};

interface CheckoutState {
  draft: CheckoutDraft | null;
}

const initialState: CheckoutState = {
  draft: null,
};

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    setCheckoutDraft: (state, action: PayloadAction<CheckoutDraft>) => {
      state.draft = action.payload;
    },
    clearCheckoutDraft: (state) => {
      state.draft = null;
    },
  },
});

export const { setCheckoutDraft, clearCheckoutDraft } = checkoutSlice.actions;
export default checkoutSlice.reducer;
