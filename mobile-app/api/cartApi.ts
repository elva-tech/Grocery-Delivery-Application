import { ACTIVE_API_URL } from '@/src/config/constants';
import { getActiveTenantId } from '@/src/utils/tenantStorage';
import {
  amountToFreeDelivery,
  freeDeliveryProgress,
  isExpressDeliveryChoiceEnabled,
  resolveDeliveryFee,
  type DeliveryType,
} from '@/utils/deliveryBilling';

export type { DeliveryType };
export { isExpressDeliveryChoiceEnabled };

// ── Cart Bill Calculation ─────────────────────────────────────────────────────

/** Fallback defaults used when the backend is unreachable */
export const CART_CONFIG = {
  FREE_DELIVERY_THRESHOLD: 500,
  DEFAULT_DELIVERY_FEE: 40,
  DEFAULT_EXPRESS_DELIVERY_FEE: 0,
};

export type StoreDiscountType = 'NONE' | 'PERCENTAGE' | 'FLAT';

export type CartBillSettings = {
  freeDeliveryThreshold?: number;
  deliveryCharge?: number;
  expressDeliveryCharge?: number;
  discountType?: StoreDiscountType | string;
  discountValue?: number;
  maxDiscount?: number;
};

/** Store-wide discount from admin settings (matches website / backend order logic). */
export function computeStoreDiscount(
  subtotal: number,
  settings?: Pick<CartBillSettings, 'discountType' | 'discountValue' | 'maxDiscount'>,
): number {
  const discountType = String(settings?.discountType ?? 'NONE').toUpperCase();
  const discountValue = Number(settings?.discountValue ?? 0);
  const maxDiscount = Number(settings?.maxDiscount ?? 0);
  let discount = 0;

  if (discountType === 'PERCENTAGE' && discountValue > 0) {
    discount = Math.round((subtotal * discountValue) / 100);
    if (maxDiscount > 0) {
      discount = Math.min(discount, maxDiscount);
    }
  } else if (discountType === 'FLAT' && discountValue > 0) {
    discount = discountValue;
  }

  return Math.min(discount, subtotal);
}

/** Synchronous bill computation used as fallback */
export const calculateBillBackend = (
  items: any[],
  settings?: CartBillSettings,
  deliveryType: DeliveryType = 'STANDARD',
) => {
  const itemTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const billingSettings = {
    deliveryCharge: Number(settings?.deliveryCharge ?? CART_CONFIG.DEFAULT_DELIVERY_FEE),
    expressDeliveryCharge: Number(settings?.expressDeliveryCharge ?? CART_CONFIG.DEFAULT_EXPRESS_DELIVERY_FEE),
    freeDeliveryAbove: Number(settings?.freeDeliveryThreshold ?? CART_CONFIG.FREE_DELIVERY_THRESHOLD),
  };
  const { deliveryFee, isFreeDelivery } = resolveDeliveryFee(itemTotal, billingSettings, deliveryType);
  const discount = computeStoreDiscount(itemTotal, settings);
  const saved =
    (isFreeDelivery ? billingSettings.deliveryCharge : 0) + discount;

  return {
    itemTotal,
    deliveryFee,
    discount,
    saved,
    grandTotal: itemTotal + deliveryFee - discount,
    isFreeDelivery,
    amountToFree: amountToFreeDelivery(itemTotal, billingSettings.freeDeliveryAbove),
    progress: freeDeliveryProgress(itemTotal, billingSettings.freeDeliveryAbove),
  };
};

/** Fetches delivery settings once per session, then reuses cache. */
export type CartBillingSettings = {
  freeDeliveryAbove: number;
  deliveryCharge: number;
  expressDeliveryCharge: number;
  discountType: StoreDiscountType;
  discountValue: number;
  maxDiscount: number;
};

let cachedBillingSettings: CartBillingSettings | null = null;
let billingSettingsPromise: Promise<CartBillingSettings> | null = null;

export function clearCartBillingSettingsCache(): void {
  cachedBillingSettings = null;
  billingSettingsPromise = null;
}

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
          freeDeliveryAbove: Number(s.freeDeliveryAbove ?? 0),
          deliveryCharge: Number(s.deliveryCharge ?? 0),
          expressDeliveryCharge: Number(s.expressDeliveryCharge ?? 0),
          discountType: (String(s.discountType ?? 'NONE').toUpperCase() as StoreDiscountType) || 'NONE',
          discountValue: Number(s.discountValue ?? 0),
          maxDiscount: Number(s.maxDiscount ?? 0),
        };
      } catch {
        cachedBillingSettings = {
          freeDeliveryAbove: CART_CONFIG.FREE_DELIVERY_THRESHOLD,
          deliveryCharge: CART_CONFIG.DEFAULT_DELIVERY_FEE,
          expressDeliveryCharge: CART_CONFIG.DEFAULT_EXPRESS_DELIVERY_FEE,
          discountType: 'NONE',
          discountValue: 0,
          maxDiscount: 0,
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
export const getCartCalculation = async (items: any[], deliveryType: DeliveryType = 'STANDARD') => {
  const settings = await getCartBillingSettings();
  return calculateBillBackend(items, {
    freeDeliveryThreshold: settings.freeDeliveryAbove,
    deliveryCharge: settings.deliveryCharge,
    expressDeliveryCharge: settings.expressDeliveryCharge,
    discountType: settings.discountType,
    discountValue: settings.discountValue,
    maxDiscount: settings.maxDiscount,
  }, deliveryType);
};
