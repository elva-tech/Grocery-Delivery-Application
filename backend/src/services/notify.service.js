const crypto = require("crypto");
const Tenant = require("../models/Tenant.model");
const User = require("../models/User.model");
const { notifyConfig, validateNotifyConfig } = require("../config/notify.config");
const { formatOrderDisplayId } = require("../utils/orderDisplayId.util");

const TEMPLATE_KEYS = {
  LOGIN_OTP: "LOGIN_OTP",
  ORDER_PLACED: "ORDER_PLACED",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  ORDER_DELIVERED: "ORDER_DELIVERED",
};

const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
const NOTIFY_MAX_ATTEMPTS = 5;
const NOTIFY_CHANNEL = "SMS";
const RETRYABLE_UPSTREAM_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRequestId() {
  return crypto.randomUUID();
}

function normalizeIndianPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (String(phone || "").startsWith("+")) return String(phone).trim();
  return digits ? `+${digits}` : "";
}

function buildCredentials() {
  return {
    appId: notifyConfig.appId,
    apiKey: notifyConfig.apiKey,
  };
}

/** Order /notify templates — named keys mapped by Notify to DLT slots. */
function buildOrderNotifyVariables({ storeName, customerName, orderId } = {}) {
  const variables = {};
  const resolvedStoreName = String(storeName || "").trim();
  if (resolvedStoreName) variables.businessName = resolvedStoreName;
  if (customerName) variables.customerName = String(customerName);
  if (orderId) variables.orderId = String(orderId);
  return variables;
}

function resolveOtpStoreName({ tenantId, storeName } = {}) {
  return (
    String(storeName || "").trim() ||
    String(tenantId || "").trim() ||
    "Store"
  );
}

/**
 * Notify playground pipes DLT slot 1 from ONE value used for both top-level `business`
 * and `variables.businessName` (e.g. business="puma", businessName="puma" → "puma|OTP").
 * If they differ, Notify falls back to the retired static template ("eNandi").
 */
function resolveOtpBrandKey({ tenantId, storeName } = {}) {
  const slug = String(tenantId || "").trim().toLowerCase();
  const displayName = resolveOtpStoreName({ tenantId, storeName });

  if (notifyConfig.otpBrand === "storename") {
    return displayName;
  }

  return slug || displayName || notifyConfig.appId;
}

function resolveOtpBrandId({ tenantId, brandIdOverride } = {}) {
  const override = String(brandIdOverride || "").trim();
  if (override) return override;

  const slug = String(tenantId || "").trim().toLowerCase();
  const mapped = notifyConfig.brandIdByTenant?.[slug];
  if (mapped) return String(mapped).trim();

  const fallback = resolveOtpBrandKey({ tenantId });
  const resolved = String(fallback || "").trim();
  if (!resolved) {
    throw new Error(
      "Notify brandId could not be resolved for this store. Set NOTIFY_BRAND_ID_MAP on the server."
    );
  }
  return resolved;
}

/**
 * Notify POST /otp/send — requires brandId + loginId (Notify playground format).
 */
function buildOtpSendBody({ tenantId, storeName, phone, brandId }) {
  return {
    ...buildCredentials(),
    brandId: resolveOtpBrandId({ tenantId, brandIdOverride: brandId }),
    phone,
    loginId: notifyConfig.loginId,
  };
}

function buildOtpVerifyBody({ tenantId, storeName, phone, otp, brandId }) {
  return {
    ...buildCredentials(),
    brandId: resolveOtpBrandId({ tenantId, brandIdOverride: brandId }),
    phone,
    otp: String(otp).trim(),
    loginId: notifyConfig.loginId,
  };
}

async function resolveTenantStoreName(tenantId) {
  const id = String(tenantId || "").trim().toLowerCase();
  if (!id) return "Store";

  const tenant = await Tenant.findOne({ tenantId: id }).select("name").lean();
  return String(tenant?.name || "").trim() || id;
}

function logNotifyEvent(event, fields = {}) {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    appId: notifyConfig.appId,
    ...fields,
  };
  console.log(JSON.stringify(payload));
}

function assertNotifyReady({ requireOtp = false, requireOrder = false } = {}) {
  if (!notifyConfig.enabled) {
    throw new NotifyServiceError("Notification service is disabled", 503);
  }

  const errors = validateNotifyConfig(true);
  if (errors.length) {
    throw new NotifyServiceError(errors.join("; "), 503);
  }

  if (requireOtp && !notifyConfig.loginOtpEnabled) {
    throw new NotifyServiceError("OTP notifications are disabled", 503);
  }

  if (requireOrder) {
    const anyOrder =
      notifyConfig.orderPlacedEnabled ||
      notifyConfig.outForDeliveryEnabled ||
      notifyConfig.orderDeliveredEnabled;
    if (!anyOrder) {
      throw new NotifyServiceError("Order notifications are disabled", 503);
    }
  }
}

class NotifyServiceError extends Error {
  constructor(message, statusCode = 502, meta = {}) {
    super(message);
    this.name = "NotifyServiceError";
    this.statusCode = statusCode;
    this.upstreamStatus = meta.upstreamStatus;
    this.responseData = meta.responseData;
    this.retryable = Boolean(meta.retryable);
  }
}

function isRetryableNotifyFailure(error, upstreamStatus, { allow429Retry = false, allowTimeoutRetry = true } = {}) {
  if (upstreamStatus === 429 && !allow429Retry) return false;
  if (error?.name === "AbortError" && !allowTimeoutRetry) return false;
  if (error?.name === "AbortError") return true;
  if (upstreamStatus && RETRYABLE_UPSTREAM_STATUSES.has(upstreamStatus)) return true;
  if (error instanceof NotifyServiceError && error.retryable) return true;
  return false;
}

async function executeNotifyHttpRequest({
  path,
  body,
  templateKey,
  phone,
  orderId,
  customerId,
  tenantId,
  storeName,
  requestId,
  attempt,
}) {
  const startedAt = Date.now();
  const url = `${notifyConfig.baseUrl}${path}`;

  if (attempt === 1) {
    logNotifyEvent("notify_request_started", {
      requestId,
      templateKey,
      tenantId: tenantId || undefined,
      storeName: storeName || undefined,
      notifyBrandId: body?.brandId,
      notifyLoginId: body?.loginId,
      notifyModuleBusiness: body?.business,
      notifyOtpBrandKey: body?.brandId || body?.business,
      dltSlot1: body?.variables?.businessName ?? (Array.isArray(body?.variables) ? body.variables[0] : undefined),
      notifyVariables: body?.variables,
      phone: phone || undefined,
      orderId: orderId || undefined,
      customerId: customerId || undefined,
      path,
    });
  } else {
    logNotifyEvent("notify_request_retry", {
      requestId,
      templateKey,
      tenantId: tenantId || undefined,
      orderId: orderId || undefined,
      attempt,
      path,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Connection: "close",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await response.text();
    let data = {};
    if (raw && raw.trim()) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { message: raw };
      }
    }

    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      const message =
        data?.message || data?.error || `Notify request failed (${response.status})`;
      const retryable = RETRYABLE_UPSTREAM_STATUSES.has(response.status);
      logNotifyEvent("notify_request_failed", {
        requestId,
        templateKey,
        tenantId: tenantId || undefined,
        storeName: storeName || undefined,
        phone: phone || undefined,
        orderId: orderId || undefined,
        customerId: customerId || undefined,
        durationMs,
        statusCode: response.status,
        attempt,
        error: message,
        notifyResponse: data,
      });
      throw new NotifyServiceError(message, response.status >= 500 ? 502 : 400, {
        upstreamStatus: response.status,
        responseData: data,
        retryable,
      });
    }

    logNotifyEvent("notify_request_completed", {
      requestId,
      templateKey,
      tenantId: tenantId || undefined,
      storeName: storeName || undefined,
      phone: phone || undefined,
      orderId: orderId || undefined,
      customerId: customerId ? String(customerId) : undefined,
      durationMs,
      statusCode: response.status,
      attempt,
    });

    return data;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (error instanceof NotifyServiceError) {
      throw error;
    }

    const message =
      error?.name === "AbortError"
        ? "Notify request timed out"
        : error?.message || "Notify request failed";

    logNotifyEvent("notify_request_failed", {
      requestId,
      templateKey,
      tenantId: tenantId || undefined,
      storeName: storeName || undefined,
      phone: phone || undefined,
      orderId: orderId || undefined,
      customerId: customerId ? String(customerId) : undefined,
      durationMs,
      attempt,
      error: message,
    });

    throw new NotifyServiceError(message, 502, { retryable: true });
  } finally {
    clearTimeout(timeout);
  }
}

async function notifyHttpRequest(options) {
  const maxAttempts = Math.max(1, Number(options.maxAttempts) || 1);
  const retryOptions = options.retryOptions || {};

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await executeNotifyHttpRequest({ ...options, attempt });
    } catch (error) {
      const upstreamStatus =
        error instanceof NotifyServiceError ? error.upstreamStatus : undefined;
      const shouldRetry =
        attempt < maxAttempts &&
        isRetryableNotifyFailure(error, upstreamStatus, retryOptions);

      if (!shouldRetry) {
        throw error;
      }

      await sleep(1000 * attempt + Math.floor(Math.random() * 500));
    }
  }

  throw new NotifyServiceError("Notify request failed after retries", 502, {
    retryable: false,
  });
}

function isOtpEnabled() {
  return notifyConfig.enabled && notifyConfig.loginOtpEnabled;
}

function isOrderPlacedEnabled() {
  return notifyConfig.enabled && notifyConfig.orderPlacedEnabled;
}

function isOutForDeliveryEnabled() {
  return notifyConfig.enabled && notifyConfig.outForDeliveryEnabled;
}

function isOrderDeliveredEnabled() {
  return notifyConfig.enabled && notifyConfig.orderDeliveredEnabled;
}

async function sendOtp({ tenantId, phoneNumber, brandId }) {
  assertNotifyReady({ requireOtp: true });

  const requestId = createRequestId();
  const phone = normalizeIndianPhone(phoneNumber);
  if (!phone) {
    throw new NotifyServiceError("Invalid phone number", 400);
  }

  const storeName = await resolveTenantStoreName(tenantId);

  return notifyHttpRequest({
    path: "/otp/send",
    templateKey: TEMPLATE_KEYS.LOGIN_OTP,
    phone,
    tenantId,
    storeName,
    requestId,
    maxAttempts: NOTIFY_MAX_ATTEMPTS,
    retryOptions: { allow429Retry: false, allowTimeoutRetry: false },
    body: buildOtpSendBody({
      tenantId,
      storeName,
      phone,
      brandId,
    }),
  });
}

async function verifyOtp({ tenantId, phoneNumber, otp, brandId }) {
  assertNotifyReady({ requireOtp: true });

  const requestId = createRequestId();
  const phone = normalizeIndianPhone(phoneNumber);
  if (!phone) {
    throw new NotifyServiceError("Invalid phone number", 400);
  }
  if (!otp || !String(otp).trim()) {
    throw new NotifyServiceError("OTP is required", 400);
  }

  const storeName = await resolveTenantStoreName(tenantId);

  return notifyHttpRequest({
    path: "/otp/verify",
    templateKey: TEMPLATE_KEYS.LOGIN_OTP,
    phone,
    tenantId,
    storeName,
    requestId,
    maxAttempts: NOTIFY_MAX_ATTEMPTS,
    // Retry transient Notify failures (503/timeout). Wrong/expired OTP (400/404) never retries.
    retryOptions: { allow429Retry: false, allowTimeoutRetry: true },
    body: buildOtpVerifyBody({ tenantId, storeName, phone, otp, brandId }),
  });
}

async function resendOtp({ tenantId, phoneNumber, brandId }) {
  assertNotifyReady({ requireOtp: true });

  const requestId = createRequestId();
  const phone = normalizeIndianPhone(phoneNumber);
  if (!phone) {
    throw new NotifyServiceError("Invalid phone number", 400);
  }

  const storeName = await resolveTenantStoreName(tenantId);

  return notifyHttpRequest({
    path: "/otp/resend",
    templateKey: TEMPLATE_KEYS.LOGIN_OTP,
    phone,
    tenantId,
    storeName,
    requestId,
    maxAttempts: NOTIFY_MAX_ATTEMPTS,
    retryOptions: { allow429Retry: false, allowTimeoutRetry: false },
    body: buildOtpSendBody({
      tenantId,
      storeName,
      phone,
      brandId,
    }),
  });
}

async function resolveOrderNotifyContext(order) {
  const tenantId = order.tenantId;
  const storeName = await resolveTenantStoreName(tenantId);

  let phoneNumber = String(order.customerPhone || "").trim();
  let customerName = String(order.customerName || "").trim();

  if ((!phoneNumber || !customerName) && order.userId) {
    const user = await User.findById(order.userId).select("phoneNumber name").lean();
    if (!phoneNumber) phoneNumber = String(user?.phoneNumber || "").trim();
    if (!customerName) customerName = String(user?.name || "").trim();
  }

  return {
    tenantId,
    storeName,
    phoneNumber,
    customerName: customerName || "Customer",
    orderId: formatOrderDisplayId(order._id),
  };
}

async function sendOrderNotification({
  tenantId,
  templateKey,
  phoneNumber,
  customerName,
  orderId,
  customerId,
  storeName,
}) {
  const phone = normalizeIndianPhone(phoneNumber);
  const displayOrderId = formatOrderDisplayId(orderId);

  if (!phone) {
    console.warn(
      JSON.stringify({
        event: "notify_request_skipped",
        reason: "missing_or_invalid_phone",
        templateKey,
        tenantId,
        orderId: displayOrderId,
        customerId: customerId ? String(customerId) : undefined,
      })
    );
    return null;
  }

  const resolvedStoreName = storeName || (await resolveTenantStoreName(tenantId));
  const requestId = createRequestId();

  return notifyHttpRequest({
    path: "/notify",
    templateKey,
    phone,
    orderId: displayOrderId,
    customerId: customerId ? String(customerId) : undefined,
    tenantId,
    storeName: resolvedStoreName,
    requestId,
    maxAttempts: NOTIFY_MAX_ATTEMPTS,
    body: {
      ...buildCredentials(),
      // Notify /notify requires business === appId; store name goes in variables.businessName
      business: notifyConfig.appId,
      channel: NOTIFY_CHANNEL,
      templateKey,
      to: [phone],
      variables: buildOrderNotifyVariables({
        storeName: resolvedStoreName,
        customerName: String(customerName || "Customer"),
        orderId: displayOrderId,
      }),
    },
  });
}

async function sendOrderPlaced(context) {
  if (!isOrderPlacedEnabled()) return null;
  assertNotifyReady();

  return sendOrderNotification({
    templateKey: TEMPLATE_KEYS.ORDER_PLACED,
    ...context,
  });
}

async function sendOutForDelivery(context) {
  if (!isOutForDeliveryEnabled()) return null;
  assertNotifyReady();

  return sendOrderNotification({
    templateKey: TEMPLATE_KEYS.OUT_FOR_DELIVERY,
    ...context,
  });
}

async function sendOrderDelivered(context) {
  if (!isOrderDeliveredEnabled()) return null;
  assertNotifyReady();

  return sendOrderNotification({
    templateKey: TEMPLATE_KEYS.ORDER_DELIVERED,
    ...context,
  });
}

/**
 * Fire-and-forget order notification — never throws; logs warning on failure.
 */
async function sendOrderNotificationSafe(run, meta = {}) {
  try {
    await run();
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "notify_order_notification_failed",
        templateKey: meta.templateKey,
        tenantId: meta.tenantId,
        orderId: meta.orderId,
        upstreamStatus: error?.upstreamStatus,
        notifyResponse: error?.responseData,
        error: error?.message || "Unknown error",
      })
    );
  }
}

async function buildOrderNotifyContext(order, templateKey) {
  const ctx = await resolveOrderNotifyContext(order);
  return {
    tenantId: ctx.tenantId,
    storeName: ctx.storeName,
    phoneNumber: ctx.phoneNumber,
    customerName: ctx.customerName,
    orderId: order._id,
    customerId: order.userId,
    templateKey,
  };
}

function notifyOrderPlacedSafe(order) {
  return sendOrderNotificationSafe(
    async () => {
      const context = await buildOrderNotifyContext(order, TEMPLATE_KEYS.ORDER_PLACED);
      await sendOrderPlaced(context);
    },
    {
      templateKey: TEMPLATE_KEYS.ORDER_PLACED,
      tenantId: order.tenantId,
      orderId: formatOrderDisplayId(order._id),
    }
  );
}

function notifyOutForDeliverySafe(order) {
  return sendOrderNotificationSafe(
    async () => {
      const context = await buildOrderNotifyContext(order, TEMPLATE_KEYS.OUT_FOR_DELIVERY);
      await sendOutForDelivery(context);
    },
    {
      templateKey: TEMPLATE_KEYS.OUT_FOR_DELIVERY,
      tenantId: order.tenantId,
      orderId: formatOrderDisplayId(order._id),
    }
  );
}

function notifyOrderDeliveredSafe(order) {
  return sendOrderNotificationSafe(
    async () => {
      const context = await buildOrderNotifyContext(order, TEMPLATE_KEYS.ORDER_DELIVERED);
      await sendOrderDelivered(context);
    },
    {
      templateKey: TEMPLATE_KEYS.ORDER_DELIVERED,
      tenantId: order.tenantId,
      orderId: formatOrderDisplayId(order._id),
    }
  );
}

module.exports = {
  TEMPLATE_KEYS,
  NotifyServiceError,
  sendOtp,
  verifyOtp,
  resendOtp,
  sendOrderPlaced,
  sendOutForDelivery,
  sendOrderDelivered,
  notifyOrderPlacedSafe,
  notifyOutForDeliverySafe,
  notifyOrderDeliveredSafe,
  isOtpEnabled,
  isOrderPlacedEnabled,
  isOutForDeliveryEnabled,
  isOrderDeliveredEnabled,
};
