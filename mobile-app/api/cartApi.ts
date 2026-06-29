import { ACTIVE_API_URL } from '@/src/config/constants';
import { getActiveTenantId } from '@/src/utils/tenantStorage';

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

/** Fetches delivery settings once per session, then reuses cache. */
export type CartBillingSettings = {
  freeDeliveryAbove: number;
  deliveryCharge: number;
};

let cachedBillingSettings: CartBillingSettings | null = null;
let billingSettingsPromise: Promise<CartBillingSettings> | null = null;

export async function getCartBillingSettings(): Promise<CartBillingSettings> {
  if (cachedBillingSettings) return cachedBillingSettings;
  if (!billingSettingsPromise) {
    billingSettingsPromise = (async () => {
      try {
        const res = await fetch(`${ACTIVE_API_URL}/api/settings`, {
          headers: { 'x-tenant-id': await getActiveTenantId() },
        });
        if (!res.ok) throw new Error('settings fetch failed');
        const s = await res.json();
        cachedBillingSettings = {
          freeDeliveryAbove: s.freeDeliveryAbove,
          deliveryCharge: s.deliveryCharge,
        };
      } catch {
        cachedBillingSettings = {
          freeDeliveryAbove: CART_CONFIG.FREE_DELIVERY_THRESHOLD,
          deliveryCharge: CART_CONFIG.DEFAULT_DELIVERY_FEE,
        };
      }
      return cachedBillingSettings;
    })().finally(() => {
      billingSettingsPromise = null;
    });
  }
  return billingSettingsPromise;
}

/** Fetches live delivery settings from backend, falls back to defaults */
export const getCartCalculation = async (items: any[]) => {
  const settings = await getCartBillingSettings();
  return calculateBillBackend(items, {
    freeDeliveryThreshold: settings.freeDeliveryAbove,
    deliveryCharge: settings.deliveryCharge,
  });
};
