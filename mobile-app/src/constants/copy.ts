export const MOBILE_COPY = {
  common: {
    addToCart: 'Add to Cart',
    myCart: 'My Cart',
    guestUser: 'Guest User',
    viewAll: 'View All',
  },
  auth: {
    loginSubtitle: 'Enter your mobile number to continue',
    createAccountCta: 'New here? Create an account',
    registerSubtitle: 'Enter your name and mobile number to get started',
    signInCta: 'Already have an account? Sign in',
    otpTitle: 'OTP Verification',
    loginToContinueTitle: 'Please log in to continue',
    loginToContinueMessage:
      'Sign in to choose a delivery address and complete your order. Your cart will stay here.',
  },
  home: {
    deliverToFallback: 'Add a delivery address (Home / Work)',
    nearPrefix: 'Near ',
    currentLocationDeliverTo: 'Current location',
    deliveryNeedLocationPermission: 'Allow location access to see if we deliver to your area.',
    deliveryLocationPermissionDenied:
      'Please allow location access so we can check if we deliver to your area.',
    deliveryCheckFailed: 'Could not verify delivery availability.',
    deliveryCheckFailedDetail:
      "We couldn't reach our delivery service. Please try again in a moment or choose a saved address.",
    deliveryCheckingLabel: 'Checking delivery availability…',
    deliveryAvailableHere: 'Service available — we deliver to this location.',
    deliveryUnavailableTitle: 'No delivery to this area',
    deliveryCheckUnavailableTitle: 'Delivery check unavailable',
    addToCartToastTitle: 'Added to cart',
    addToCartToastSuffix: 'added to your cart',
    recommendedForYou: 'Recommended for You',
  },
  cart: {
    emptyTitle: 'Your cart is empty',
    emptySubtitle: 'Add items to continue.',
    quickDelivery: 'Quick Delivery',
    qualityChecked: 'Quality Checked',
    maxStockInCart: (count: number) =>
      count === 1
        ? 'Only 1 left in stock'
        : `Only ${count} left in stock`,
  },
  store: {
    closingSoonTitle: 'Closing soon',
    closingInMinutes: (minutes: number) =>
      minutes <= 1
        ? 'Store closes in about a minute — place your order now.'
        : `Store closes in ${minutes} minutes — place your order soon.`,
    closingAt: (time: string) =>
      `Store closes at ${time} — finish checkout to get your order in.`,
  },
  checkout: {
    storeUnavailable:
      'This store is temporarily unable to accept orders. Please try again later or contact the store.',
    onlinePaymentUnavailable:
      'Online payment is not available at this store right now. Please choose Cash on Delivery or contact the store.',
    paymentFailedGeneric: 'Could not complete your order. Please try again or use Cash on Delivery.',
  },
  orderSuccess: {
    title: 'Order Placed!',
    /** Tenant-agnostic — works for grocery, pharmacy, retail, etc. */
    subtitle: (storeName?: string | null) => {
      const name = String(storeName || '').trim();
      if (name) {
        return `${name} is preparing your order and it will be on its way soon.`;
      }
      return 'Your order is confirmed and will be on its way soon.';
    },
    orderIdLabel: 'ORDER ID',
    trackOrder: 'Track Order',
    returnToShop: 'Return to Shop',
  },
  delivery: {
    checkoutBlockedHint:
      'This address is outside our delivery area. Choose another saved address or pin a closer location.',
    unavailableToastTitle: 'Delivery unavailable',
    /** Mirrors website storefront wording where technical API lines should not leak to users. */
    outsideDeliveryRadius:
      'This location looks outside our delivery area. Try picking an address a little closer to the store.',
    notEligibleGeneric:
      "We're unable to deliver to this address right now. Please choose another nearby location.",
  },
  product: {
    featuredItem: 'Featured Item',
    packedForDelivery: 'Packed for delivery',
    descriptionFallbackPrefix: 'prepared and packed for doorstep delivery.',
    featureFreshQuality: 'Fresh Quality',
    featureQualityAssured: 'Quality Assured',
    addedToCartBanner: 'Added to your cart',
    nonReturnable:
      'This item is non-returnable. Refunds or returns are not available after delivery.',
    nonReturnableFootnote: 'This item is non-returnable after delivery.',
  },
  orders: {
    nonReturnableOrder:
      'Return is not available for this order — it contains only non-returnable items.',
    nonReturnableOrderNamed: (names: string[]) =>
      names.length === 1
        ? `Return is not available for "${names[0]}". This product is non-returnable.`
        : `Return is not available for: ${names.join(', ')}. These products are non-returnable.`,
  },
} as const;

/** Align with website `customerFacingDeliveryUnavailable` — hide jargon from map-service messages. */
export function customerFacingDeliveryUnavailable(apiMessage?: string | null): string {
  const m = (apiMessage ?? '').trim().toLowerCase();
  if (!m) return MOBILE_COPY.delivery.notEligibleGeneric;

  const mentionsDistance =
    m.includes('exceed') ||
    m.includes('maximum distance') ||
    m.includes('max distance') ||
    m.includes('maxdistance') ||
    m.includes('too far') ||
    (m.includes('outside') && m.includes('distance'));

  if (mentionsDistance || (m.includes('not eligible') && m.includes('distance'))) {
    return MOBILE_COPY.delivery.outsideDeliveryRadius;
  }

  if (m.includes('not eligible')) {
    return MOBILE_COPY.delivery.notEligibleGeneric;
  }

  const looksTechnical =
    /configured|threshold|maxdistance|eligibility\s+check|api\b|endpoint|payload/i.test(apiMessage ?? '');
  if (looksTechnical) {
    return MOBILE_COPY.delivery.notEligibleGeneric;
  }

  return (apiMessage ?? '').trim();
}

/** Map / delivery-check warnings — permission issues get their own copy. */
export function customerFacingMapServiceError(apiMessage?: string | null): string {
  const raw = (apiMessage ?? '').trim();
  if (!raw) return MOBILE_COPY.home.deliveryCheckFailedDetail;

  const m = raw.toLowerCase();

  if (
    m.includes('permission denied') ||
    m.includes('allow location') ||
    m.includes('location access') ||
    raw === MOBILE_COPY.home.deliveryNeedLocationPermission ||
    raw === MOBILE_COPY.home.deliveryLocationPermissionDenied
  ) {
    return m.includes('permission denied')
      ? MOBILE_COPY.home.deliveryLocationPermissionDenied
      : MOBILE_COPY.home.deliveryNeedLocationPermission;
  }

  if (
    m.includes('tip:') ||
    m.includes('vite_') ||
    m.includes('map-service') ||
    m.includes('localhost') ||
    m.includes('same-origin') ||
    m.includes('backend proxy') ||
    m.includes('cors') ||
    m.includes('onrender.com') ||
    m.includes('store delivery hub is not configured')
  ) {
    return MOBILE_COPY.home.deliveryCheckFailedDetail;
  }

  if (m.includes('delivery eligibility check failed') || m.includes('unable to verify delivery')) {
    return MOBILE_COPY.home.deliveryCheckFailedDetail;
  }

  const looksTechnical =
    /configured|threshold|api\b|endpoint|payload|\benv\b|proxy|eligibility\s+check/i.test(raw);
  if (looksTechnical) {
    return MOBILE_COPY.home.deliveryCheckFailedDetail;
  }

  return raw;
}

/** Hide platform billing / vendor setup messages from shoppers at checkout. */
export function customerFacingCheckoutError(
  apiMessage?: string | null,
  opts?: { code?: string | null },
): string {
  const code = (opts?.code ?? '').trim();
  if (
    code === 'BILLING_OVERDUE' ||
    code === 'SUBSCRIPTION_SUSPENDED' ||
    code === 'TENANT_SUSPENDED'
  ) {
    return MOBILE_COPY.checkout.storeUnavailable;
  }

  const m = (apiMessage ?? '').trim().toLowerCase();
  if (!m) return MOBILE_COPY.checkout.paymentFailedGeneric;

  if (
    m.includes('vendor payment') ||
    m.includes('vendor razorpay') ||
    m.includes('payment configuration not found') ||
    m.includes('platform invoice') ||
    m.includes('subscription bill') ||
    m.includes('billing subscription') ||
    m.includes('onboarding is not active')
  ) {
    return m.includes('platform invoice') || m.includes('subscription')
      ? MOBILE_COPY.checkout.storeUnavailable
      : MOBILE_COPY.checkout.onlinePaymentUnavailable;
  }

  return (apiMessage ?? '').trim() || MOBILE_COPY.checkout.paymentFailedGeneric;
}
