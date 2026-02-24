import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOCK_ORDERS } from './mockData';

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
  return await updateOrderStatusApi(orderId, 'CANCELLED');
};

export const getUserOrders = async (userId: string) => {
  try {
    const savedOrders = await AsyncStorage.getItem(ORDERS_KEY);
    const userOrders = savedOrders ? JSON.parse(savedOrders) : [];

    const normalizedUserOrders = userOrders.map((order: any) => ({
      ...order,
      items: Array.isArray(order.items)
        ? order.items.map((i: any) => ({
            ...i,
            image: Array.isArray(i.image) ? i.image[0] : i.image
          }))
        : []
    }));

    const allOrders = [...normalizedUserOrders, ...MOCK_ORDERS];

    return allOrders
      .filter(order => order.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('Order fetch error:', error);
    return MOCK_ORDERS.filter(order => order.userId === userId);
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
  try {
    const savedOrders = await AsyncStorage.getItem(ORDERS_KEY);
    const userOrders = savedOrders ? JSON.parse(savedOrders) : [];
    const allOrders = [...userOrders, ...MOCK_ORDERS];
    return allOrders.find(order => order.id === orderId);
  } catch (error) {
    return MOCK_ORDERS.find(order => order.id === orderId);
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
