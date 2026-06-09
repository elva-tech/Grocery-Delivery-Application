/** Map internal billing / payment errors to storefront-safe messages (never leak platform billing jargon). */

const STORE_UNAVAILABLE =
  "This store is temporarily unable to accept orders. Please try again later or contact the store.";

const ONLINE_PAYMENT_UNAVAILABLE =
  "Online payment is not available at this store right now. Please choose Cash on Delivery or contact the store.";

const PAYMENT_SETUP_INVALID =
  "Online payment is temporarily unavailable. Please try Cash on Delivery or contact the store.";

function customerOrderBlockResponse(err) {
  const code = err?.code;
  if (
    code === "BILLING_OVERDUE" ||
    code === "SUBSCRIPTION_SUSPENDED" ||
    code === "TENANT_SUSPENDED"
  ) {
    return { message: STORE_UNAVAILABLE, code };
  }
  return { message: err?.message || STORE_UNAVAILABLE, code };
}

function customerPaymentErrorMessage(err) {
  const msg = String(err?.message || "");
  const status = err?.status;

  if (
    status === 404 &&
    (msg.includes("Vendor payment configuration not found") ||
      msg.includes("Vendor not found"))
  ) {
    return ONLINE_PAYMENT_UNAVAILABLE;
  }
  if (
    msg.includes("Vendor Razorpay is not configured") ||
    msg.includes("Vendor Razorpay key ID is not configured") ||
    msg.includes("Vendor Razorpay key secret is not configured")
  ) {
    return ONLINE_PAYMENT_UNAVAILABLE;
  }
  if (
    msg.includes("Vendor Razorpay onboarding is not active") ||
    msg.includes("Vendor Razorpay account is disabled")
  ) {
    return ONLINE_PAYMENT_UNAVAILABLE;
  }
  if (msg.includes("decrypt vendor") || msg.includes("Failed to decrypt vendor")) {
    return PAYMENT_SETUP_INVALID;
  }
  if (msg.includes("Order not found")) {
    return "We could not find your order. Please go back to checkout and try again.";
  }
  if (msg.includes("Unauthorized")) {
    return "Your session could not be verified. Please sign in and try again.";
  }
  if (msg.includes("already paid")) {
    return "This order has already been paid.";
  }

  return msg || "Payment could not be started. Please try again or use Cash on Delivery.";
}

module.exports = {
  customerOrderBlockResponse,
  customerPaymentErrorMessage,
  STORE_UNAVAILABLE,
  ONLINE_PAYMENT_UNAVAILABLE,
};
