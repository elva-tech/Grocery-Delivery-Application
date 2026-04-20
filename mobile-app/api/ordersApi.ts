import { API_BASE_URL, TENANT_ID } from '@/src/config/constants';
import { store } from '@/store/store';

const BASE = API_BASE_URL.DEVELOPMENT;

const getAuthToken = (): string | null => (store.getState() as any).auth?.token ?? null;

/* ----------- CANCEL ORDER (real backend) ----------- */
export const cancelOrderApi = async (orderId: string) => {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${BASE}/api/orders/${orderId}/cancel`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': TENANT_ID,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'Could not cancel order');
  return data;
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
    deliveryAddress: {
      line1: string;
      line2?: string;
      landmark: string;
      city: string;
      state: string;
      pincode: string;
      lat: number;
      lng: number;
    };
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
    body: JSON.stringify({ order_id: orderId }),
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

/** Submit an issue/return request for a delivered order. Uses POST /api/returns/create. */
export const reportOrderIssueApi = async (
  orderId: string,
  reason: string,
  customerComment: string,
  token: string,
  evidenceUrl: string,
) => {
  const res = await fetch(`${BASE}/api/returns/create`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ orderId, reason, customerComment, evidenceUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to submit report');
  return data; // { success: true, data: ReturnRequest }
};

/** Update the authenticated user's display name. */
export const updateProfileApi = async (name: string, token: string) => {
  const res = await fetch(`${BASE}/api/auth/profile`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to update profile');
  return data; // { success: true, user: { id, name, phoneNumber, ... } }
};
