import axios from "axios";
import { API_BASE_URL, getTenantId } from "../config";

const API_URL = `${API_BASE_URL}/api/orders`;
const COUPONS_URL = `${API_BASE_URL}/api/coupons`;

const ORDERS_KEY = '@enandi_orders_v1';
const ORDER_COUNTER_KEY = '@enandi_order_counter';
const LAST_ORDER_KEY = '@last_order_id';

const storage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
};
export const getCartCalculation = async (items: any[]) => {
  const subtotal = items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);

  const settingsRes = await axios.get(`${API_BASE_URL}/api/settings`, {
    headers: { 'x-tenant-id': getTenantId() },
  });
  const s = settingsRes.data;

  const deliveryCharge: number = s.deliveryCharge;
  const freeDeliveryAbove: number = s.freeDeliveryAbove;
  const discountType: string = s.discountType ?? 'NONE';
  const discountValue: number = s.discountValue ?? 0;

  const isFreeDelivery = subtotal >= freeDeliveryAbove;
  const finalDelivery = (subtotal === 0 || isFreeDelivery) ? 0 : deliveryCharge;
  const amountToFree = isFreeDelivery ? 0 : freeDeliveryAbove - subtotal;
  const progress = Math.min(subtotal / freeDeliveryAbove, 1);

  let discount = 0;
  if (discountType === 'PERCENTAGE' && discountValue > 0) {
    discount = Math.round((subtotal * discountValue) / 100);
  } else if (discountType === 'FLAT' && discountValue > 0) {
    discount = discountValue;
  }
  discount = Math.min(discount, subtotal);

  const grandTotal = subtotal + finalDelivery - discount;

  return {
    subtotal,
    isFreeDelivery,
    amountToFree,
    progress,
    deliveryCharge: finalDelivery,
    grandTotal,
    discount,
    saved: (isFreeDelivery ? deliveryCharge : 0) + discount,
  };
};

export const generateBackendOrderId = async (): Promise<string> => {
  const counterStr = storage.getItem(ORDER_COUNTER_KEY);
  const currentCounter = counterStr ? parseInt(counterStr, 10) : 1000;
  const newCounter = currentCounter + 1;
  storage.setItem(ORDER_COUNTER_KEY, newCounter.toString());
  return `ORD${newCounter.toString().padStart(6, '0')}`;
};



export const saveNewOrder = async (orderData: any) => {
  const orderId = await generateBackendOrderId();
  const newOrder = {
    ...orderData,
    id: orderId,
    createdAt: new Date().toISOString(),
    status: 'PLACED',
    items: orderData.items.map((i: any) => ({
      ...i,
      image: Array.isArray(i.image) ? i.image[0] : i.image
    }))
  };

  const savedOrdersStr = storage.getItem(ORDERS_KEY);
  const currentOrders = savedOrdersStr ? JSON.parse(savedOrdersStr) : [];
  storage.setItem(ORDERS_KEY, JSON.stringify([newOrder, ...currentOrders]));
  storage.setItem(LAST_ORDER_KEY, orderId);
  return newOrder;
};

export const getUserOrders = async () => {
  try {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("Unauthorized"); // ✅ FIX
    }

    const res = await axios.get(`${API_URL}/my`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': getTenantId(),
      }
    });

    if (!res.data?.orders) {
      throw new Error("Invalid response");
    }

    return res.data.orders.map((order: any) => ({
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      paymentStatus: order.paymentStatus,
      paymentMode: order.paymentMode,
      refundStatus: order.refundStatus,
      refundAmount: order.refundAmount,
      createdAt: order.createdAt,
      address: order.address,
      deliverySlot: order.deliverySlot,
      invoiceAvailable: Boolean(order.invoiceAvailable),
      deliveryPartner: order.deliveryPartner || null,
      adminNote: order.adminNote,
      returnReason: order.returnReason,
      returnEvidence: order.returnEvidence,
      items: order.items || [],
      rating: order.rating,
    }));

  } catch (error) {
    console.error("Error fetching orders:", error);
    throw error; // ✅ IMPORTANT (don't silently return [])
  }
};
// ✅ CANCEL ORDER (CALL BACKEND)
export const cancelOrderApi = async (orderId: string) => {
  try {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("Unauthorized"); // ✅ FIX
    }

    const res = await axios.patch(
      `${API_URL}/${orderId}/cancel`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': getTenantId(),
        }
      }
    );

    if (!res.data?.success) {
      return { success: false, message: res.data?.message };
    }

    return res.data;

  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Cancel failed"
    };
  }
};
export const processAdminRefundApi = async (orderId: string, decision: 'APPROVE' | 'REJECT', adminNote: string) => {
  const existingOrders = localStorage.getItem(ORDERS_KEY);
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
    localStorage.setItem(ORDERS_KEY, JSON.stringify(updatedOrders));
    return { success: true };
  }
  return { success: false };
};
/* ─── PLACE ORDER (real backend) ──────────────────────────────── */
export const validateCouponApi = async (code: string, cartTotal: number): Promise<{
  valid: boolean;
  code: string;
  discountAmount: number;
  description: string;
  message: string;
}> => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Unauthorized');
  const res = await axios.post(
    `${COUPONS_URL}/validate`,
    { code: code.trim().toUpperCase(), cartTotal },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': getTenantId(),
      },
    }
  );
  return res.data;
};

export const placeOrderApi = async (payload: {
  items: { productId: string; variantId?: string; qty: number }[];
  paymentMode: 'COD' | 'ONLINE';
  deliveryAddress: {
    line1: string;
    line2?: string;
    landmark: string;
    city: string;
    state: string;
    pincode: string;
    lat: number;
    lng: number;
    addressUrl?: string;
  };
  couponCode?: string | null;
}) => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Unauthorized');
  const res = await axios.post(API_URL, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': getTenantId(),
    },
  });
  return res.data; // { orderId, totalAmount, orderStatus, ... }
};

export const reportOrderIssueApi = async (payload: {
  orderId: string;
  reason: string;
  comment: string;
  evidenceUrl: string;
}) => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Unauthorized');
  const res = await axios.post(
    `${API_URL}/report-issue`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': getTenantId(),
      },
    }
  );
  return res.data;
};

export const rateOrderApi = async (orderId: string, rating: number, comment: string) => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Unauthorized');
  const res = await axios.post(
    `${API_URL}/${orderId}/rate`,
    { rating, comment },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': getTenantId(),
      },
    }
  );
  return res.data; // { success: true, message }
};

export const downloadOrderSummaryPdfApi = async (orderId: string): Promise<void> => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Unauthorized");
  const res = await axios.get(`${API_URL}/${orderId}/order-summary/download`, {
    responseType: "blob",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-tenant-id": getTenantId(),
    },
  });
  const blob = new Blob([res.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `order-summary-${orderId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
