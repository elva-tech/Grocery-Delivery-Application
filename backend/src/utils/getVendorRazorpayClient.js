const Razorpay = require("razorpay");
const { decrypt } = require("./encryption");

function decryptVendorSecret(encryptedValue, label) {
  try {
    return decrypt(encryptedValue);
  } catch (err) {
    const error = new Error(`Failed to decrypt vendor ${label}`);
    error.status = 500;
    error.cause = err;
    throw error;
  }
}

function getVendorKeySecret(vendor) {
  if (!vendor?.razorpay?.encryptedKeySecret) {
    const err = new Error("Vendor Razorpay key secret is not configured");
    err.status = 400;
    throw err;
  }
  return decryptVendorSecret(vendor.razorpay.encryptedKeySecret, "key secret");
}

function getVendorWebhookSecret(vendor) {
  if (!vendor?.razorpay?.encryptedWebhookSecret) {
    const err = new Error("Vendor Razorpay webhook secret is not configured");
    err.status = 400;
    throw err;
  }
  return decryptVendorSecret(
    vendor.razorpay.encryptedWebhookSecret,
    "webhook secret"
  );
}

function getVendorRazorpayClient(vendor) {
  if (!vendor?.razorpay?.keyId) {
    const err = new Error("Vendor Razorpay key ID is not configured");
    err.status = 400;
    throw err;
  }
  const keySecret = getVendorKeySecret(vendor);
  return new Razorpay({
    key_id: vendor.razorpay.keyId,
    key_secret: keySecret,
  });
}

function assertVendorPaymentReady(vendor, tenantId) {
  if (!vendor) {
    const err = new Error("Vendor payment configuration not found");
    err.status = 404;
    throw err;
  }
  if (!vendor.razorpay?.keyId || !vendor.razorpay?.encryptedKeySecret) {
    const err = new Error("Vendor Razorpay is not configured");
    err.status = 400;
    throw err;
  }
  if (vendor.razorpay.onboardingStatus !== "ACTIVE") {
    const err = new Error("Vendor Razorpay onboarding is not active");
    err.status = 403;
    throw err;
  }
  if (vendor.razorpay.accountStatus !== "ACTIVE") {
    const err = new Error("Vendor Razorpay account is disabled");
    err.status = 403;
    throw err;
  }
  if (tenantId && vendor.tenantId !== tenantId) {
    const err = new Error("Vendor tenant mismatch");
    err.status = 400;
    throw err;
  }
}

module.exports = {
  getVendorRazorpayClient,
  getVendorKeySecret,
  getVendorWebhookSecret,
  assertVendorPaymentReady,
};
