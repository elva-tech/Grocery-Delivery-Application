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
  delivery: {
    bannerTitle: 'We can’t deliver to this area',
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
