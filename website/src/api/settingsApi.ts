import axios from "axios";
import { API_BASE_URL, getTenantId } from "../config";
import {
  amountToFreeDelivery,
  qualifiesForFreeStandardDelivery,
  standardDeliveryFee,
} from "../utils/deliveryBilling";

const SETTINGS_URL = `${API_BASE_URL}/api/settings`;

export interface AppSettings {
  deliveryCharge: number;
  freeDeliveryAbove: number;
  discountType: "NONE" | "PERCENTAGE" | "FLAT";
  discountValue: number;
  maxDiscount?: number;
  thresholdDistance: number;
}

let _cache: AppSettings | null = null;
let _cacheExpiry = 0;
const CACHE_TTL = 60_000;

export async function fetchSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (_cache && now < _cacheExpiry) return _cache;

  const res = await axios.get(SETTINGS_URL, {
    headers: { "x-tenant-id": getTenantId() },
  });

  _cache = res.data as AppSettings;
  _cacheExpiry = Date.now() + CACHE_TTL;
  return _cache;
}

export function invalidateSettingsCache() {
  _cache = null;
  _cacheExpiry = 0;
}

export function calculateBill(
  items: { price: number; quantity: number }[],
  settings: AppSettings
) {
  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const deliveryCharge = standardDeliveryFee(
    subtotal,
    settings.deliveryCharge,
    settings.freeDeliveryAbove,
  );
  const isFreeDelivery = qualifiesForFreeStandardDelivery(subtotal, settings.freeDeliveryAbove);
  const amountToFree = amountToFreeDelivery(subtotal, settings.freeDeliveryAbove);

  let discount = 0;
  if (settings.discountType === "PERCENTAGE" && settings.discountValue > 0) {
    discount = Math.round((subtotal * settings.discountValue) / 100);
    if ((settings.maxDiscount ?? 0) > 0) {
      discount = Math.min(discount, settings.maxDiscount ?? 0);
    }
  } else if (settings.discountType === "FLAT" && settings.discountValue > 0) {
    discount = settings.discountValue;
  }
  discount = Math.min(discount, subtotal);

  const grandTotal = subtotal + deliveryCharge - discount;

  return {
    subtotal,
    deliveryCharge,
    isFreeDelivery,
    amountToFree,
    discount,
    grandTotal,
    saved: (isFreeDelivery ? settings.deliveryCharge : 0) + discount,
  };
}
