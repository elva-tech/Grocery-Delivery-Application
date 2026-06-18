/**
 * Notify API configuration — all values from environment variables.
 * No product names, URLs, or secrets are hardcoded here.
 */

function parseEnvBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return defaultValue;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function trimTrailingSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

const notifyConfig = {
  enabled: parseEnvBoolean(process.env.NOTIFY_ENABLED, false),

  baseUrl: trimTrailingSlash(process.env.NOTIFY_BASE_URL || ""),
  appId: String(process.env.NOTIFY_APP_ID || "").trim(),
  apiKey: String(process.env.NOTIFY_API_KEY || "").trim(),

  loginOtpEnabled: parseEnvBoolean(process.env.NOTIFY_LOGIN_OTP_ENABLED, true),
  /** LOGIN_OTP brand: tenantId (playground default, e.g. puma) or storeName (Tenant.name). */
  otpBrand: String(process.env.NOTIFY_OTP_BRAND || "tenantId")
    .trim()
    .toLowerCase(),
  orderPlacedEnabled: parseEnvBoolean(process.env.NOTIFY_ORDER_PLACED_ENABLED, true),
  outForDeliveryEnabled: parseEnvBoolean(
    process.env.NOTIFY_OUT_FOR_DELIVERY_ENABLED,
    true
  ),
  orderDeliveredEnabled: parseEnvBoolean(
    process.env.NOTIFY_ORDER_DELIVERED_ENABLED,
    true
  ),
};

function validateNotifyConfig(requireCredentials = false) {
  const errors = [];

  if (!notifyConfig.baseUrl) {
    errors.push("NOTIFY_BASE_URL is required when Notify is enabled");
  }
  if (requireCredentials) {
    if (!notifyConfig.appId) errors.push("NOTIFY_APP_ID is required");
    if (!notifyConfig.apiKey) errors.push("NOTIFY_API_KEY is required");
  }

  return errors;
}

module.exports = {
  notifyConfig,
  parseEnvBoolean,
  validateNotifyConfig,
};
