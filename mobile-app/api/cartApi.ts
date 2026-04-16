import { API_BASE_URL, TENANT_ID } from '@/src/config/constants';

// ── Cart Bill Calculation ─────────────────────────────────────────────────────

/** Fallback defaults used when the backend is unreachable */
export const CART_CONFIG = {
  FREE_DELIVERY_THRESHOLD: 500,
  DEFAULT_DELIVERY_FEE: 40,
};

/** Synchronous bill computation used as fallback */
export const calculateBillBackend = (
  items: any[],
  settings?: { freeDeliveryThreshold?: number; deliveryCharge?: number },
) => {
  const threshold = settings?.freeDeliveryThreshold ?? CART_CONFIG.FREE_DELIVERY_THRESHOLD;
  const fee = settings?.deliveryCharge ?? CART_CONFIG.DEFAULT_DELIVERY_FEE;
  const itemTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = itemTotal >= threshold ? 0 : fee;

  return {
    itemTotal,
    deliveryFee,
    grandTotal: itemTotal + deliveryFee,
    isFreeDelivery: deliveryFee === 0,
    amountToFree: Math.max(0, threshold - itemTotal),
    progress: Math.min(1, itemTotal / threshold),
  };
};

/** Fetches live delivery settings from backend, falls back to defaults */
export const getCartCalculation = async (items: any[]) => {
  try {
    const res = await fetch(`${API_BASE_URL.DEVELOPMENT}/api/settings`, {
      headers: { 'x-tenant-id': TENANT_ID },
    });
    if (!res.ok) throw new Error('settings fetch failed');
    const s = await res.json();
    return calculateBillBackend(items, {
      freeDeliveryThreshold: s.freeDeliveryAbove,
      deliveryCharge: s.deliveryCharge,
    });
  } catch {
    return calculateBillBackend(items);
  }
};
