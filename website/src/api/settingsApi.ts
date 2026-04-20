import axios from "axios";
import { API_BASE_URL, getTenantId } from "../config";

const SETTINGS_URL = `${API_BASE_URL}/api/settings`;

export interface AppSettings {
  deliveryCharge: number;
  freeDeliveryAbove: number;
  discountType: "NONE" | "PERCENTAGE" | "FLAT";
  discountValue: number;
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
  const isFreeDelivery = subtotal >= settings.freeDeliveryAbove;
  const deliveryCharge = isFreeDelivery ? 0 : settings.deliveryCharge;
  const amountToFree = isFreeDelivery ? 0 : settings.freeDeliveryAbove - subtotal;

  let discount = 0;
  if (settings.discountType === "PERCENTAGE" && settings.discountValue > 0) {
    discount = Math.round((subtotal * settings.discountValue) / 100);
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
