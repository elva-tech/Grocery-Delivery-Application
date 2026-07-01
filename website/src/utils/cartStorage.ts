import type { CartItem } from '../store/slices/cartSlice';
import { getTenantId } from './getTenantId';

export const CART_STORAGE_KEY = 'website_cart';

type PersistedCart = {
  tenantId: string;
  items: CartItem[];
  totalAmount: number;
};

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as CartItem;
  return (
    typeof item.id === 'string' &&
    typeof item.productId === 'string' &&
    typeof item.variantId === 'string' &&
    typeof item.name === 'string' &&
    typeof item.price === 'number' &&
    typeof item.quantity === 'number' &&
    item.quantity > 0 &&
    typeof item.image === 'string' &&
    typeof item.unit === 'string'
  );
}

function recalcTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function loadPersistedCart(): { items: CartItem[]; totalAmount: number } {
  try {
    const tenantId = getTenantId();
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { items: [], totalAmount: 0 };

    const parsed = JSON.parse(raw) as Partial<PersistedCart>;
    if (parsed.tenantId && parsed.tenantId !== tenantId) {
      return { items: [], totalAmount: 0 };
    }

    const items = Array.isArray(parsed.items) ? parsed.items.filter(isCartItem) : [];
    return {
      items,
      totalAmount: recalcTotal(items),
    };
  } catch {
    return { items: [], totalAmount: 0 };
  }
}

export function savePersistedCart(items: CartItem[]): void {
  try {
    const payload: PersistedCart = {
      tenantId: getTenantId(),
      items,
      totalAmount: recalcTotal(items),
    };
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

export function clearPersistedCart(): void {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}
