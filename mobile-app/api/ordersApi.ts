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

// Generic Status Update API (Hits local "backend")
export const updateOrderStatusApi = async (orderId: string, newStatus: string) => {
  const existingOrders = await AsyncStorage.getItem(ORDERS_KEY);
  if (existingOrders) {
    const orders = JSON.parse(existingOrders);
    const updatedOrders = orders.map((o: any) => 
      o.id === orderId ? { ...o, status: newStatus } : o
    );
    await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updatedOrders));
    return { success: true };
  }
  return { success: false };
};

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

// Add this to ordersApi.ts
export const processAdminRefundApi = async (orderId: string, decision: 'APPROVE' | 'REJECT', adminNote: string) => {
  const existingOrders = await AsyncStorage.getItem(ORDERS_KEY);
  if (existingOrders) {
    const orders = JSON.parse(existingOrders);
    const updatedOrders = orders.map((o: any) => {
      if (o.id === orderId) {
        return { 
          ...o, 
          status: decision === 'APPROVE' ? 'REFUND_APPROVED' : 'REFUND_REJECTED',
          adminNote: adminNote,
          resolvedAt: new Date().toISOString()
        };
      }
      return o;
    });
    await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updatedOrders));
    return { success: true };
  }
  return { success: false };
};

export const saveNewOrder = async (orderData: any) => {
  try {
    const orderId = await generateBackendOrderId();
    const newOrder = {
      ...orderData,
      id: orderId,
      createdAt: new Date().toISOString(),
      status: 'PLACED', // Default initial status
      items: Array.isArray(orderData.items)
        ? orderData.items.map((i: any) => ({
            ...i,
            image: Array.isArray(i.image) ? i.image[0] : i.image
          }))
        : []
    };

    const savedOrders = await AsyncStorage.getItem(ORDERS_KEY);
    const currentOrders = savedOrders ? JSON.parse(savedOrders) : [];
    const updatedOrders = [newOrder, ...currentOrders];
    await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updatedOrders));
    await AsyncStorage.setItem(LAST_ORDER_KEY, orderId);
    return newOrder;
  } catch (error) {
    console.error('Order save error:', error);
    throw error;
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

export const clearUserOrders = async () => {
  try {
    await AsyncStorage.removeItem(ORDERS_KEY);
    await AsyncStorage.removeItem(ORDER_COUNTER_KEY);
    await AsyncStorage.removeItem(LAST_ORDER_KEY);
  } catch (error) {
    console.error('Clear orders error:', error);
  }
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
