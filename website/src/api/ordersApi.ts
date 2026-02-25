import { MOCK_ORDERS } from './mockdata';

const ORDERS_KEY = '@enandi_orders_v1';
const ORDER_COUNTER_KEY = '@enandi_order_counter';
const LAST_ORDER_KEY = '@last_order_id';

const storage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
};
export const getCartCalculation = async (items: any[]) => {
  const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const FREE_DELIVERY_THRESHOLD = 500;
  const SHIPPING_CHARGES = 40;
  
  const isFreeDelivery = subtotal >= FREE_DELIVERY_THRESHOLD;
  const amountToFree = isFreeDelivery ? 0 : FREE_DELIVERY_THRESHOLD - subtotal;
  const progress = Math.min(subtotal / FREE_DELIVERY_THRESHOLD, 1);
  const deliveryCharge = isFreeDelivery ? 0 : SHIPPING_CHARGES;
  const grandTotal = subtotal + deliveryCharge;

  // Simulate API delay if needed, or return immediately
  return {
    subtotal,
    isFreeDelivery,
    amountToFree,
    progress,
    deliveryCharge,
    grandTotal,
    saved: isFreeDelivery ? SHIPPING_CHARGES : 0
  };
};

export const generateBackendOrderId = async (): Promise<string> => {
  const counterStr = storage.getItem(ORDER_COUNTER_KEY);
  const currentCounter = counterStr ? parseInt(counterStr, 10) : 1000;
  const newCounter = currentCounter + 1;
  storage.setItem(ORDER_COUNTER_KEY, newCounter.toString());
  return `ORD${newCounter.toString().padStart(6, '0')}`;
};

export const getUserOrders = async (userId: string) => {
  try {
    const savedOrdersStr = storage.getItem(ORDERS_KEY);
    const savedOrders = savedOrdersStr ? JSON.parse(savedOrdersStr) : [];
    
    // Filter MOCK_ORDERS but allow local overrides (like CANCELLED status) to take precedence
    const filteredMocks = MOCK_ORDERS.filter(
      (mock) => !savedOrders.some((saved: any) => saved.id === mock.id)
    );

    const allOrders = [...savedOrders, ...filteredMocks];

    return allOrders
      .filter((order: any) => order.userId === userId)
      .map((order: any) => ({
        ...order,
        items: order.items.map((i: any) => ({
          ...i,
          image: Array.isArray(i.image) ? i.image[0] : i.image
        }))
      }))
      .sort((a: any) => (a.status === 'OUT_FOR_DELIVERY' ? -1 : 1)) // Priority sort
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    return MOCK_ORDERS.filter(order => order.userId === userId);
  }
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

export const cancelOrderApi = async (orderId: string) => {
  const existingOrdersStr = storage.getItem(ORDERS_KEY);
  let orders = existingOrdersStr ? JSON.parse(existingOrdersStr) : [];
  
  const orderExistsLocally = orders.find((o: any) => o.id === orderId);
  
  if (orderExistsLocally) {
    orders = orders.map((o: any) => o.id === orderId ? { ...o, status: 'CANCELLED' } : o);
  } else {
    // If it's a mock order being cancelled for the first time
    const mockOrder = MOCK_ORDERS.find(o => o.id === orderId);
    if (mockOrder) orders.push({ ...mockOrder, status: 'CANCELLED' });
  }
  
  storage.setItem(ORDERS_KEY, JSON.stringify(orders));
  return { success: true };
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
export const reportOrderIssueApi = async (formData: FormData) => {
  const orderId = String(formData.get('orderId'));
  const reason = formData.get('reason');
  const comment = formData.get('comment');

  const savedOrdersStr = localStorage.getItem(ORDERS_KEY);
  let orders = savedOrdersStr ? JSON.parse(savedOrdersStr) : [];

  const orderExistsLocally = orders.find((o: any) => o.id === orderId);

  if (orderExistsLocally) {
    orders = orders.map((o: any) =>
      o.id === orderId
        ? { ...o, status: 'ISSUE_REPORTED', issueDetails: { reason, comment } }
        : o
    );
  } else {
    const mockOrder = MOCK_ORDERS.find(o => o.id === orderId);
    if (mockOrder) {
      orders.push({
        ...mockOrder,
        status: 'ISSUE_REPORTED',
        issueDetails: { reason, comment }
      });
    }
  }

  

  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { success: true };
};
