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
    registerSubtitle: 'Sign up quickly with mobile OTP',
    signInCta: 'Already have an account? Sign in',
    otpTitle: 'OTP Verification',
  },
  home: {
    deliverToFallback: 'Add a delivery address (Home / Work)',
    nearPrefix: 'Near ',
    currentLocationDeliverTo: 'Current location',
    deliveryNeedLocationPermission: 'Allow location access to see if we deliver to your area.',
    deliveryCheckFailed: 'Could not verify delivery availability.',
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
