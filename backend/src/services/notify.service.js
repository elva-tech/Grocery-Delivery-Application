const crypto = require("crypto");
const { notifyConfig, validateNotifyConfig } = require("../config/notify.config");

const TEMPLATE_KEYS = {
  LOGIN_OTP: "LOGIN_OTP",
  ORDER_PLACED: "ORDER_PLACED",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  ORDER_DELIVERED: "ORDER_DELIVERED",
};

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

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

function logNotifyEvent(event, fields = {}) {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    business: notifyConfig.business,
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
  constructor(message, statusCode = 502) {
    super(message);
    this.name = "NotifyServiceError";
    this.statusCode = statusCode;
  }
}

async function notifyHttpRequest({
  path,
  body,
  templateKey,
  phone,
  orderId,
  customerId,
  requestId,
}) {
  const startedAt = Date.now();
  const url = `${notifyConfig.baseUrl}${path}`;

  logNotifyEvent("notify_request_started", {
    requestId,
    templateKey,
    phone: phone || undefined,
    orderId: orderId || undefined,
    customerId: customerId || undefined,
    path,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
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
      logNotifyEvent("notify_request_failed", {
        requestId,
        templateKey,
        phone: phone || undefined,
        orderId: orderId || undefined,
        customerId: customerId || undefined,
        durationMs,
        statusCode: response.status,
        error: message,
      });
      throw new NotifyServiceError(message, response.status >= 500 ? 502 : 400);
    }

    logNotifyEvent("notify_request_completed", {
      requestId,
      templateKey,
      phone: phone || undefined,
      orderId: orderId || undefined,
      customerId: customerId || undefined,
      durationMs,
      statusCode: response.status,
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
      phone: phone || undefined,
      orderId: orderId || undefined,
      customerId: customerId || undefined,
      durationMs,
      error: message,
    });

    throw new NotifyServiceError(message, 502);
  } finally {
    clearTimeout(timeout);
  }
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

async function sendOtp(phoneNumber) {
  assertNotifyReady({ requireOtp: true });

  const requestId = createRequestId();
  const phone = normalizeIndianPhone(phoneNumber);
  if (!phone) {
    throw new NotifyServiceError("Invalid phone number", 400);
  }

  return notifyHttpRequest({
    path: "/otp/send",
    templateKey: TEMPLATE_KEYS.LOGIN_OTP,
    phone,
    requestId,
    body: {
      ...buildCredentials(),
      business: notifyConfig.business,
      phone,
      templateKey: TEMPLATE_KEYS.LOGIN_OTP,
    },
  });
}

async function verifyOtp(phoneNumber, otp) {
  assertNotifyReady({ requireOtp: true });

  const requestId = createRequestId();
  const phone = normalizeIndianPhone(phoneNumber);
  if (!phone) {
    throw new NotifyServiceError("Invalid phone number", 400);
  }
  if (!otp || !String(otp).trim()) {
    throw new NotifyServiceError("OTP is required", 400);
  }

  return notifyHttpRequest({
    path: "/otp/verify",
    templateKey: TEMPLATE_KEYS.LOGIN_OTP,
    phone,
    requestId,
    body: {
      ...buildCredentials(),
      business: notifyConfig.business,
      phone,
      otp: String(otp).trim(),
    },
  });
}

async function resendOtp(phoneNumber) {
  assertNotifyReady({ requireOtp: true });

  const requestId = createRequestId();
  const phone = normalizeIndianPhone(phoneNumber);
  if (!phone) {
    throw new NotifyServiceError("Invalid phone number", 400);
  }

  return notifyHttpRequest({
    path: "/otp/resend",
    templateKey: TEMPLATE_KEYS.LOGIN_OTP,
    phone,
    requestId,
    body: {
      ...buildCredentials(),
      business: notifyConfig.business,
      phone,
      templateKey: TEMPLATE_KEYS.LOGIN_OTP,
    },
  });
}

async function sendOrderNotification({
  templateKey,
  phoneNumber,
  customerName,
  orderId,
  customerId,
}) {
  const phone = normalizeIndianPhone(phoneNumber);
  if (!phone) {
    console.warn(
      JSON.stringify({
        event: "notify_request_skipped",
        reason: "missing_or_invalid_phone",
        templateKey,
        orderId: String(orderId || ""),
        customerId: customerId ? String(customerId) : undefined,
      })
    );
    return null;
  }

  const requestId = createRequestId();

  return notifyHttpRequest({
    path: "/notify",
    templateKey,
    phone,
    orderId: String(orderId || ""),
    customerId: customerId ? String(customerId) : undefined,
    requestId,
    body: {
      ...buildCredentials(),
      business: notifyConfig.business,
      templateKey,
      phone,
      variables: {
        customerName: String(customerName || "Customer"),
        businessName: notifyConfig.appId,
        orderId: String(orderId || ""),
      },
    },
  });
}

async function sendOrderPlaced({ phoneNumber, customerName, orderId, customerId }) {
  if (!isOrderPlacedEnabled()) return null;
  assertNotifyReady();

  return sendOrderNotification({
    templateKey: TEMPLATE_KEYS.ORDER_PLACED,
    phoneNumber,
    customerName,
    orderId,
    customerId,
  });
}

async function sendOutForDelivery({ phoneNumber, customerName, orderId, customerId }) {
  if (!isOutForDeliveryEnabled()) return null;
  assertNotifyReady();

  return sendOrderNotification({
    templateKey: TEMPLATE_KEYS.OUT_FOR_DELIVERY,
    phoneNumber,
    customerName,
    orderId,
    customerId,
  });
}

async function sendOrderDelivered({ phoneNumber, customerName, orderId, customerId }) {
  if (!isOrderDeliveredEnabled()) return null;
  assertNotifyReady();

  return sendOrderNotification({
    templateKey: TEMPLATE_KEYS.ORDER_DELIVERED,
    phoneNumber,
    customerName,
    orderId,
    customerId,
  });
}

/**
 * Fire-and-forget order notification — never throws; logs warning on failure.
 */
async function sendOrderNotificationSafe(sender, context) {
  try {
    await sender(context);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "notify_order_notification_failed",
        templateKey: context?.templateKey,
        orderId: context?.orderId ? String(context.orderId) : undefined,
        customerId: context?.customerId ? String(context.customerId) : undefined,
        error: error?.message || "Unknown error",
      })
    );
  }
}

function notifyOrderPlacedSafe(order) {
  return sendOrderNotificationSafe(sendOrderPlaced, {
    phoneNumber: order.customerPhone,
    customerName: order.customerName,
    orderId: order._id,
    customerId: order.userId,
    templateKey: TEMPLATE_KEYS.ORDER_PLACED,
  });
}

function notifyOutForDeliverySafe(order) {
  return sendOrderNotificationSafe(sendOutForDelivery, {
    phoneNumber: order.customerPhone,
    customerName: order.customerName,
    orderId: order._id,
    customerId: order.userId,
    templateKey: TEMPLATE_KEYS.OUT_FOR_DELIVERY,
  });
}

function notifyOrderDeliveredSafe(order) {
  return sendOrderNotificationSafe(sendOrderDelivered, {
    phoneNumber: order.customerPhone,
    customerName: order.customerName,
    orderId: order._id,
    customerId: order.userId,
    templateKey: TEMPLATE_KEYS.ORDER_DELIVERED,
  });
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
