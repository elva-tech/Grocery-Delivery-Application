import { getCustomerOrderStatusTheme } from './orderStatusDisplay';

export type OrderStatusFilter =
  | 'all'
  | 'active'
  | 'placed'
  | 'confirmed'
  | 'out_for_delivery'
  | 'delivered'
  | 'returns'
  | 'cancelled';

export type OrderSortBy = 'newest' | 'oldest' | 'amount_high' | 'amount_low';

export const ORDER_STATUS_FILTERS: { id: OrderStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'In progress' },
  { id: 'placed', label: 'Waiting' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'out_for_delivery', label: 'On the way' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'returns', label: 'Refund / issue' },
  { id: 'cancelled', label: 'Cancelled' },
];

export const ORDER_SORT_OPTIONS: { id: OrderSortBy; label: string }[] = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'amount_high', label: 'Highest amount' },
  { id: 'amount_low', label: 'Lowest amount' },
];

export function formatOrderDateTime(dateString?: string | null): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatOrderDate(dateString?: string | null): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatOrderTime(dateString?: string | null): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function orderIdStr(order: { id?: string; _id?: string }): string {
  return String(order.id ?? order._id ?? '');
}

function orderStatus(order: { status?: string; orderStatus?: string }): string {
  return String(order.status ?? order.orderStatus ?? '').toUpperCase();
}

function matchesStatusFilter(order: { status?: string; orderStatus?: string }, filter: OrderStatusFilter): boolean {
  const s = orderStatus(order);
  switch (filter) {
    case 'all':
      return true;
    case 'active':
      return ['PLACED', 'CONFIRMED', 'OUT_FOR_DELIVERY'].includes(s);
    case 'placed':
      return s === 'PLACED';
    case 'confirmed':
      return s === 'CONFIRMED';
    case 'out_for_delivery':
      return s === 'OUT_FOR_DELIVERY';
    case 'delivered':
      return s === 'DELIVERED';
    case 'returns':
      return ['ISSUE_REPORTED', 'REFUND_APPROVED', 'REFUND_REJECTED'].includes(s);
    case 'cancelled':
      return s === 'CANCELLED';
    default:
      return true;
  }
}

function matchesSearch(order: any, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (orderIdStr(order).toLowerCase().includes(q)) return true;

  const theme = getCustomerOrderStatusTheme(orderStatus(order));
  if (theme.label.toLowerCase().includes(q)) return true;

  const items = Array.isArray(order.items) ? order.items : [];
  if (items.some((i: { name?: string }) => String(i.name || '').toLowerCase().includes(q))) {
    return true;
  }

  if (order.createdAt) {
    const d = new Date(order.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    if (d.toLowerCase().includes(q)) return true;
  }

  if (String(order.totalAmount ?? '').includes(q)) return true;

  return false;
}

export function sortCustomerOrders<T extends { createdAt?: string; totalAmount?: number }>(
  orders: T[],
  sortBy: OrderSortBy,
): T[] {
  const copy = [...orders];
  copy.sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    const aa = Number(a.totalAmount) || 0;
    const ab = Number(b.totalAmount) || 0;
    switch (sortBy) {
      case 'oldest':
        return ta - tb;
      case 'amount_high':
        return ab - aa || tb - ta;
      case 'amount_low':
        return aa - ab || tb - ta;
      case 'newest':
      default:
        return tb - ta;
    }
  });
  return copy;
}

export function filterAndSortCustomerOrders(
  orders: any[],
  searchQuery: string,
  statusFilter: OrderStatusFilter,
  sortBy: OrderSortBy,
): any[] {
  const filtered = orders.filter(
    (o) => matchesStatusFilter(o, statusFilter) && matchesSearch(o, searchQuery),
  );
  return sortCustomerOrders(filtered, sortBy);
}
