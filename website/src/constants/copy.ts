export const WEB_COPY = {
  header: {
    appPromoTitlePrefix: 'Get the',
    appPromoTitleSuffix: 'App',
    appPromoDescription: 'Use the app for a smoother shopping and checkout experience.',
    continueOnWebsite: 'Continue on website',
    cartLabel: 'Cart',
    confirmLogoutTitle: 'Confirm Logout',
    confirmLogoutDescription: 'Are you sure you want to log out? You can sign in again anytime.',
    confirmLogoutAction: 'Yes, Log Out',
  },
  login: {
    otpVerificationTitle: 'OTP Verification',
    signupHint: 'Sign up with mobile OTP',
    signinHint: 'Sign in with mobile OTP',
    mobilePlaceholder: 'Enter 10-digit mobile number',
    sendOtp: 'Send OTP',
    verifyContinue: 'Verify & Continue',
    verifySignIn: 'Verify & Sign In',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    backToSignIn: '← Back to Sign In',
    backToSignUp: '← Back to Sign Up',
    securityFooter: 'Secured sign-in • OTP verified',
  },
  cart: {
    myCart: 'My Cart',
    itemCountSuffix: 'item(s)',
    freeDeliveryUnlocked: 'Free delivery unlocked',
    addMoreForFreeDelivery: (amount: number | string) => `Add ₹${amount} more for free delivery`,
    deliveryFeeSaved: 'Delivery fee saved',
    emptyCart: 'Your cart is empty',
    onlyLeftInStock: (count: number) =>
      count === 1 ? 'Only 1 left in stock' : `Only ${count} left in stock`,
    maxStockInCart: (count: number) =>
      count === 1
        ? 'Maximum 1 available — you have reached the stock limit'
        : `Only ${count} available in stock — you cannot add more`,
  },
  product: {
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
  /** Customer-facing delivery eligibility (avoid showing raw MapService / admin jargon). */
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
    paymentFailedGeneric: 'Failed to place order. Please try again or use Cash on Delivery.',
  },
  delivery: {
    bannerTitle: 'We can’t deliver to this area',
    checkUnavailableTitle: 'Delivery check unavailable',
    locationPermissionTitle: 'Location access needed',
    locationPermissionDenied:
      'Please allow location access in your browser so we can check if we deliver to your area.',
    locationPermissionNeeded:
      'Turn on location access to see delivery availability, or choose a saved address.',
    checkFailed:
      "We couldn't reach our delivery service. Please try again in a moment or choose a saved address.",
    outsideDeliveryRadius:
      'This location looks outside our delivery area. Try picking an address a little closer to the store.',
    notEligibleGeneric:
      "We're unable to deliver to this address right now. Please choose another nearby location.",
    checkoutBlockedToast:
      'This address is outside our delivery area. Pick a closer location or update your saved address.',
    verifyAddressToast:
      'Fix your delivery address or PIN before paying — we could not confirm delivery to this location.',
  },
} as const;

/** Turns technical API messages (e.g. "Not eligible: exceeds configured maximum distance") into storefront-friendly copy. */
export function customerFacingDeliveryUnavailable(apiMessage?: string | null): string {
  const m = (apiMessage ?? '').trim().toLowerCase();
  if (!m) return WEB_COPY.delivery.notEligibleGeneric;

  const mentionsDistance =
    m.includes('exceed') ||
    m.includes('maximum distance') ||
    m.includes('max distance') ||
    m.includes('maxdistance') ||
    m.includes('too far') ||
    (m.includes('outside') && m.includes('distance'));

  if (mentionsDistance || (m.includes('not eligible') && m.includes('distance'))) {
    return WEB_COPY.delivery.outsideDeliveryRadius;
  }

  if (m.includes('not eligible')) {
    return WEB_COPY.delivery.notEligibleGeneric;
  }

  const looksTechnical =
    /configured|threshold|maxdistance|eligibility\s+check|api\b|endpoint|payload/i.test(apiMessage ?? '');
  if (looksTechnical) {
    return WEB_COPY.delivery.notEligibleGeneric;
  }

  return (apiMessage ?? '').trim();
}

function isLocationPermissionIssue(apiMessage?: string | null): boolean {
  const m = (apiMessage ?? '').trim().toLowerCase();
  if (!m) return false;
  return (
    m.includes('permission denied') ||
    m.includes('allow location') ||
    m.includes('enable location') ||
    m.includes('location access') ||
    m.includes('turn on location') ||
    m.includes('geolocation not supported')
  );
}

/** Map / delivery-check warnings — permission issues get their own copy, not “check your connection”. */
export function customerFacingMapServiceError(apiMessage?: string | null): string {
  const raw = (apiMessage ?? '').trim();

  if (isLocationPermissionIssue(raw)) {
    if (raw.toLowerCase().includes('permission denied')) {
      return WEB_COPY.delivery.locationPermissionDenied;
    }
    return WEB_COPY.delivery.locationPermissionNeeded;
  }

  if (!raw) return WEB_COPY.delivery.checkFailed;

  const m = raw.toLowerCase();

  if (m.includes('could not locate this pin') || m.includes('could not verify delivery for this pin')) {
    return raw;
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
    m.includes('super-admin onboarding') ||
    m.includes('store delivery hub is not configured')
  ) {
    return WEB_COPY.delivery.checkFailed;
  }

  if (m.includes('delivery eligibility check failed') || m.includes('unable to verify delivery availability')) {
    return WEB_COPY.delivery.checkFailed;
  }

  const looksTechnical =
    /configured|threshold|api\b|endpoint|payload|\benv\b|proxy|eligibility\s+check/i.test(raw);
  if (looksTechnical) {
    return WEB_COPY.delivery.checkFailed;
  }

  return raw;
}

export function deliveryCheckWarningTitle(apiMessage?: string | null): string {
  return isLocationPermissionIssue(apiMessage)
    ? WEB_COPY.delivery.locationPermissionTitle
    : WEB_COPY.delivery.checkUnavailableTitle;
}

/** Hide platform billing / vendor setup messages from shoppers at checkout. */
export function customerFacingCheckoutError(
  apiMessage?: string | null,
  opts?: { code?: string | null; status?: number | null },
): string {
  const code = (opts?.code ?? '').trim();
  if (
    code === 'BILLING_OVERDUE' ||
    code === 'SUBSCRIPTION_SUSPENDED' ||
    code === 'TENANT_SUSPENDED' ||
    opts?.status === 402 ||
    opts?.status === 403
  ) {
    const m = (apiMessage ?? '').toLowerCase();
    if (
      m.includes('subscription') ||
      m.includes('platform invoice') ||
      m.includes('suspended') ||
      m.includes('billing')
    ) {
      return WEB_COPY.checkout.storeUnavailable;
    }
  }

  const m = (apiMessage ?? '').trim().toLowerCase();
  if (!m) return WEB_COPY.checkout.paymentFailedGeneric;

  if (
    m.includes('vendor payment') ||
    m.includes('vendor razorpay') ||
    m.includes('payment configuration not found') ||
    m.includes('payment setup') ||
    m.includes('onboarding is not active')
  ) {
    return WEB_COPY.checkout.onlinePaymentUnavailable;
  }

  if (m.includes('platform invoice') || m.includes('subscription bill')) {
    return WEB_COPY.checkout.storeUnavailable;
  }

  return (apiMessage ?? '').trim() || WEB_COPY.checkout.paymentFailedGeneric;
}
