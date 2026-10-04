/** Web checkout does not load the native Cashfree SDK. */
export function CashfreeCheckoutHost(): null {
  return null;
}

export function startCashfreeCheckout(_input: {
  paymentSessionId: string;
  orderId: string;
  environment: 'sandbox' | 'production';
}): Promise<'SUCCESS' | 'FAILED' | 'CANCELLED'> {
  return Promise.reject(new Error('Online payment is unavailable in this build.'));
}
