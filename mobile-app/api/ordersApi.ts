import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, TENANT_ID } from '@/src/config/constants';
import { store } from '@/store/store';

const BASE = API_BASE_URL.DEVELOPMENT;

const getAuthToken = (): string | null => (store.getState() as any).auth?.token ?? null;

const ORDERS_KEY = '@enandi_orders_v1';
const ORDER_COUNTER_KEY = '@enandi_order_counter';
const LAST_ORDER_KEY = '@last_order_id';

const generateBackendOrderId = async (): Promise<string> => {
  try {
    const counterStr = await AsyncStorage.getItem(ORDER_COUNTER_KEY);
    const currentCounter = counterStr ? parseInt(counterStr, 10) : 1000;
    const newCounter = currentCounter + 1;
    await AsyncStorage.setItem(ORDER_COUNTER_KEY, newCounter.toString());
    return `ORD${newCounter.toString().padStart(6, '0')}`;
  } catch (error) {
    return `ORD${Date.now().toString().slice(-6)}`;
  }
};

/* ----------- CANCEL ORDER (real backend) ----------- */
export const cancelOrderApi = async (orderId: string) => {
  const token = getAuthToken();
  if (!token) return { success: false };
  try {
    const res = await fetch(`${BASE}/api/orders/${orderId}/cancel`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
};

/* ----------- GET USER ORDERS ----------- */
export const getUserOrders = async (_userId?: string) => {
  const token = getAuthToken();
  if (!token) return [];
  try {
    const res = await fetch(`${BASE}/api/orders/my`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });
    if (!res.ok) throw new Error('orders fetch failed');
    const json = await res.json();
    const orders = json.orders ?? json ?? [];
    return orders.map((order: any) => ({
      ...order,
      id: order._id ?? order.id,
      items: Array.isArray(order.items)
        ? order.items.map((i: any) => ({
            ...i,
            id: i.productId ?? i.id,
            image: i.imageUrl ?? (Array.isArray(i.image) ? i.image[0] : i.image) ?? '',
          }))
        : [],
    }));
  } catch (error) {
    console.error('Order fetch error:', error);
    return [];
  }
};

export const getOrderById = async (orderId: string) => {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await fetch(`${BASE}/api/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_ID,
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const order = json.order ?? json;
    return {
      ...order,
      id: order._id ?? order.id,
      items: Array.isArray(order.items)
        ? order.items.map((i: any) => ({
            ...i,
            id: i.productId ?? i.id,
            image: i.imageUrl ?? (Array.isArray(i.image) ? i.image[0] : i.image) ?? '',
          }))
        : [],
    };
  } catch (error) {
    return null;
  }
};

/* ----------- CART CALCULATION (local) ----------- */
export const getCartCalculation = async (items: any[]) => {
  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const FREE_DELIVERY_THRESHOLD = 500;
  const SHIPPING_CHARGES = 40;
  const isFreeDelivery = subtotal >= FREE_DELIVERY_THRESHOLD;
  const deliveryCharge = isFreeDelivery ? 0 : SHIPPING_CHARGES;

  return {
    subtotal,
    isFreeDelivery,
    amountToFree: isFreeDelivery ? 0 : FREE_DELIVERY_THRESHOLD - subtotal,
    progress: Math.min(subtotal / FREE_DELIVERY_THRESHOLD, 1),
    deliveryCharge,
    grandTotal: subtotal + deliveryCharge,
    saved: isFreeDelivery ? SHIPPING_CHARGES : 0,
  };
};

// ─── REAL BACKEND API FUNCTIONS ──────────────────────────────────────────────

const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  'x-tenant-id': TENANT_ID,
  Authorization: `Bearer ${token}`,
});

/** Place an order on the backend. Returns { orderId, ... } */
export const placeOrderBackend = async (
  payload: {
    items: { productId: string; qty: number }[];
    paymentMode: string;
    deliveryAddress: { line1: string; lat: number; lng: number };
    couponCode?: string | null;
  },
  token: string,
) => {
  const res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Order creation failed');
  return data; // { orderId, totalAmount, ... }
};

/** Validate a coupon code against the current cart total. */
export const validateCouponApi = async (
  code: string,
  cartTotal: number,
  token: string,
) => {
  const res = await fetch(`${BASE}/api/coupons/validate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ code, cartTotal }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Invalid coupon');
  return data; // { code, discountAmount, message, ... }
};

/** Create a Razorpay payment order for an existing backend order. */
export const createMobilePaymentOrder = async (orderId: string, token: string) => {
  const res = await fetch(`${BASE}/api/payments/create`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ orderId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Payment initiation failed');
  return data; // { amount (paise), currency, razorpay_order_id }
};

/** Verify Razorpay payment signature with the backend. */
export const verifyMobilePayment = async (
  payload: {
    order_id: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  },
  token: string,
) => {
  const res = await fetch(`${BASE}/api/payments/verify`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Payment verification failed');
  return data; // { success: true }
};

/** Submit a star rating for a delivered order. */
export const rateOrderApi = async (
  orderId: string,
  rating: number,
  comment: string,
) => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${BASE}/api/orders/${orderId}/rate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ rating, comment }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to submit rating');
  return data; // { success: true, message }
};
