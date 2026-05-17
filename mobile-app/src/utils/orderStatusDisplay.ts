/** Customer-facing order status labels (order history only). */

export type CustomerOrderStatusTheme = {
  label: string;
  subtitle?: string;
  color: string;
};

export const CUSTOMER_ORDER_STATUS_THEME: Record<string, CustomerOrderStatusTheme> = {
  PLACED: {
    label: 'Waiting for confirmation',
    subtitle: 'The store will accept your order shortly',
    color: '#d97706',
  },
  CONFIRMED: {
    label: 'Order confirmed',
    color: '#4b6f9e',
  },
  OUT_FOR_DELIVERY: {
    label: 'On its way',
    color: '#f59e0b',
  },
  DELIVERED: {
    label: 'Delivered',
    color: '#10b981',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: '#ef4444',
  },
  ISSUE_REPORTED: {
    label: 'Issue reported',
    color: '#8b5cf6',
  },
  REFUND_APPROVED: {
    label: 'Refund approved',
    color: '#10b981',
  },
  REFUND_REJECTED: {
    label: 'Refund rejected',
    color: '#ef4444',
  },
};

export function getCustomerOrderStatusTheme(status: string): CustomerOrderStatusTheme {
  return (
    CUSTOMER_ORDER_STATUS_THEME[status] ?? {
      label: status.replace(/_/g, ' '),
      color: '#64748b',
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
