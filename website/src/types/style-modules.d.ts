declare module 'swiper/css';
declare module 'swiper/css/pagination';
declare module 'swiper/css/effect-fade';

declare module '@cashfreepayments/cashfree-js' {
  interface CashfreeCheckout {
    checkout(options: {
      paymentSessionId: string;
      redirectTarget?: '_modal' | '_self' | '_blank';
    }): Promise<unknown>;
  }

  export function load(options: {
    mode: 'sandbox' | 'production';
  }): Promise<CashfreeCheckout | null>;
}
