/** Customer-facing order status labels (order history only). */

export type CustomerOrderStatusKey =
  | 'PLACED'
  | 'CONFIRMED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'ISSUE_REPORTED'
  | 'REFUND_APPROVED'
  | 'REFUND_REJECTED';

export type CustomerOrderStatusTheme = {
  label: string;
  subtitle?: string;
  color: string;
  bg: string;
};

export const CUSTOMER_ORDER_STATUS_THEME: Record<string, CustomerOrderStatusTheme> = {
  PLACED: {
    label: 'Waiting for confirmation',
    subtitle: 'The store will accept your order shortly',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
  },
  CONFIRMED: {
    label: 'Order confirmed',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  OUT_FOR_DELIVERY: {
    label: 'On its way',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  DELIVERED: {
    label: 'Delivered',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  ISSUE_REPORTED: {
    label: 'Issue reported',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  REFUND_APPROVED: {
    label: 'Refund approved',
    color: 'text-emerald-700',
    bg: 'bg-emerald-100',
  },
  REFUND_REJECTED: {
    label: 'Refund rejected',
    color: 'text-red-700',
    bg: 'bg-red-100',
  },
};

export function getCustomerOrderStatusTheme(status: string): CustomerOrderStatusTheme {
  return (
    CUSTOMER_ORDER_STATUS_THEME[status] ?? {
      label: status.replace(/_/g, ' '),
      color: 'text-slate-500',
      bg: 'bg-slate-50',
    }
  );
}

/** Refund line for cancelled online-paid orders (order history). */
export function getOnlineRefundSubtitle(order: {
  status?: string;
  paymentMode?: string;
  paymentStatus?: string;
  refundStatus?: string;
}): string | undefined {
  if (order.status !== 'CANCELLED') return undefined;
  if ((order.paymentMode || '').toUpperCase() !== 'ONLINE') return undefined;

  const paymentStatus = (order.paymentStatus || '').toUpperCase();
  const refundStatus = (order.refundStatus || 'NONE').toUpperCase();

  if (paymentStatus === 'REFUNDED' || refundStatus === 'FULL') {
    return 'Refund completed — amount should reflect in 5–7 business days';
  }
  if (paymentStatus === 'REFUND_PENDING' || refundStatus === 'PENDING') {
    return 'Refund is processing';
  }
  if (refundStatus === 'FAILED') {
    return 'Refund could not be processed — please contact support';
  }
  if (paymentStatus === 'PAID') {
    return 'Refund is being arranged — contact support if you do not receive it';
  }
  return undefined;
}
