import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACTIVE_API_URL } from '@/src/config/constants';

const TOKEN_KEY = 'token';

const getToken = async (): Promise<string> => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error('Unauthorized');
  return token;
};

const API_URL = `${ACTIVE_API_URL}/api/orders`;

/* ----------- GET USER ORDERS (real backend) ----------- */
export const getUserOrders = async () => {
  const token = await getToken();

  const res = await fetch(`${API_URL}/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.message || 'Failed to fetch orders');

  return (data.orders || []).map((order: any) => ({
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    address: order.address,
    deliverySlot: order.deliverySlot,
    items: order.items || [],
  }));
};

/* ----------- CANCEL ORDER (real backend) ----------- */
export const cancelOrderApi = async (orderId: string) => {
  const token = await getToken();

  const res = await fetch(`${API_URL}/${orderId}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();

  if (!res.ok) {
    return { success: false, message: data.message || 'Cancel failed' };
  }

  return data;
};

/* ----------- PLACE ORDER (real backend) ----------- */
export const placeOrderApi = async (payload: {
  items: { productId: string; qty: number }[];
  paymentMode: 'COD' | 'ONLINE';
  deliveryAddress: { line1: string; lat: number; lng: number };
}) => {
  const token = await getToken();

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.message || 'Order failed');

  return data; // { orderId, totalAmount, orderStatus, ... }
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


