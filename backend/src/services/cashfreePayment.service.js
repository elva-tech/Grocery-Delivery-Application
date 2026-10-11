const { Cashfree, CFEnvironment } = require("cashfree-pg");
const crypto = require("crypto");
const Order = require("../models/Order.model");
const Vendor = require("../models/Vendor.model");
const { decrypt } = require("../utils/encryption");
const { gatewayConfigError } = require("../utils/paymentGateway.util");
const { notifyOrderPlacedSafe } = require("./notify.service");
const {
  placePaidOnlineOrder,
  cancelUnpaidOnlineOrder,
} = require("./onlineOrderPlacement.service");

const FAILED_PAYMENT_STATUSES = new Set([
  "FAILED",
  "USER_DROPPED",
  "CANCELLED",
  "VOID",
]);

const FAILED_WEBHOOK_TYPES = new Set([
  "PAYMENT_FAILED_WEBHOOK",
  "PAYMENT_USER_DROPPED_WEBHOOK",
]);

function cashfreeNotifyUrl(tenantId, orderId) {
  const configured = String(process.env.PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(configured);
  } catch {
    throw gatewayConfigError("PUBLIC_API_URL missing", tenantId, orderId);
  }
  const host = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== "https:" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1"
  ) {
    throw gatewayConfigError("PUBLIC_API_URL is not a public https url", tenantId, orderId);
  }
  return `${parsed.origin}/api/webhooks/cashfree`;
}

function assertCashfreeReady(vendor, tenantId, orderId) {
  const cashfree = vendor?.cashfree;
  if (cashfree?.environment !== "SANDBOX" && cashfree?.environment !== "PRODUCTION") {
    throw gatewayConfigError("cashfree environment invalid", tenantId, orderId);
  }
  if (!cashfree.appId || !cashfree.encryptedSecretKey) {
    throw gatewayConfigError("cashfree credentials missing", tenantId, orderId);
  }
  if (cashfree.environment === "PRODUCTION" && !cashfree.encryptedWebhookSecret) {
    throw gatewayConfigError("cashfree webhook secret missing", tenantId, orderId);
  }
  if (cashfree.onboardingStatus !== "ACTIVE") {
    throw gatewayConfigError("cashfree onboarding inactive", tenantId, orderId);
  }
  if (cashfree.accountStatus !== "ACTIVE") {
    throw gatewayConfigError("cashfree account disabled", tenantId, orderId);
  }
}

function cashfreeSdkEnvironment(vendor, tenantId, orderId) {
  if (vendor?.cashfree?.environment === "PRODUCTION") return CFEnvironment.PRODUCTION;
  if (vendor?.cashfree?.environment === "SANDBOX") return CFEnvironment.SANDBOX;
  throw gatewayConfigError("cashfree environment invalid", tenantId, orderId);
}

function cashfreeCheckoutMode(vendor) {
  if (vendor?.cashfree?.environment === "PRODUCTION") return "production";
  if (vendor?.cashfree?.environment === "SANDBOX") return "sandbox";
  return null;
}

async function loadCashfreeVendor(order) {
  const vendor = await Vendor.findOne({ tenantId: order.tenantId });
  if (!vendor || vendor.tenantId !== order.tenantId) {
    throw gatewayConfigError("vendor missing", order.tenantId, order._id);
  }
  assertCashfreeReady(vendor, order.tenantId, order._id);
  return vendor;
}

function cashfreeClient(vendor) {
  let secret;
  try {
    secret = decrypt(vendor.cashfree.encryptedSecretKey);
  } catch (err) {
    const error = new Error("Failed to decrypt vendor cashfree secret");
    error.status = 500;
    error.cause = err;
    throw error;
  }
  return new Cashfree(
    cashfreeSdkEnvironment(vendor, vendor.tenantId, null),
    vendor.cashfree.appId,
    secret,
    undefined,
    undefined,
    undefined,
    false
  );
}

function customerPhone(order) {
  const digits = String(order.customerPhone || "").replace(/\D/g, "");
  const phone = digits.length > 10 ? digits.slice(-10) : digits;
  if (!/^[6-9]\d{9}$/.test(phone)) {
    const err = new Error("A valid customer phone number is required for payment");
    err.status = 400;
    throw err;
  }
  return phone;
}

function orderAmount(order) {
  const amount = Math.round(Number(order.totalAmount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error("Order amount is invalid");
    err.status = 400;
    throw err;
  }
  return amount;
}

function throwCashfreeRequestError(err, tenantId, orderId) {
  console.error({
    tenantId,
    orderId: orderId ? String(orderId) : null,
    reason: "cashfree request failed",
    status: err?.response?.status || null,
  });
  const error = new Error("Cashfree payment request failed");
  error.status = 502;
  throw error;
}

function checkoutResponse(order, { paymentSessionId, paymentStatus, environment } = {}) {
  const body = {
    provider: "CASHFREE",
    cashfree_order_id: order.cashfreeOrderId,
    amount: orderAmount(order),
    currency: "INR",
    environment,
  };
  if (paymentSessionId) body.payment_session_id = paymentSessionId;
  if (paymentStatus) body.payment_status = paymentStatus;
  return body;
}

async function fetchCashfreeOrder(client, order) {
  try {
    const response = await client.PGFetchOrder(order.cashfreeOrderId);
    return response?.data || {};
  } catch (err) {
    throwCashfreeRequestError(err, order.tenantId, order._id);
  }
}

function classifyPayments(payments) {
  const list = Array.isArray(payments) ? payments : [];
  const success = list.find((payment) => payment?.payment_status === "SUCCESS");
  if (success) {
    return {
      outcome: "SUCCESS",
      paymentId: success.cf_payment_id ? String(success.cf_payment_id) : null,
    };
  }
  if (list.some((payment) => payment?.payment_status === "PENDING")) {
    return { outcome: "PENDING", paymentId: null };
  }
  if (list.some((payment) => FAILED_PAYMENT_STATUSES.has(payment?.payment_status))) {
    return { outcome: "FAILED", paymentId: null };
  }
  return { outcome: "PENDING", paymentId: null };
}

async function responseForExistingOrder(order) {
  const vendor = await loadCashfreeVendor(order);
  const client = cashfreeClient(vendor);
  const cashfreeOrder = await fetchCashfreeOrder(client, order);
  const mode = cashfreeCheckoutMode(vendor);
  if (cashfreeOrder.order_status === "PAID") {
    return checkoutResponse(order, { paymentStatus: "SUCCESS", environment: mode });
  }
  if (!cashfreeOrder.payment_session_id) {
    throw gatewayConfigError(
      "cashfree payment session missing",
      order.tenantId,
      order._id
    );
  }
  return checkoutResponse(order, {
    paymentSessionId: cashfreeOrder.payment_session_id,
    environment: mode,
  });
}

async function createCashfreePayment(order) {
  const orderId = order._id;
  if (order.cashfreeOrderId && order.cashfreeOrderId !== "LOCKED") {
    if (order.paymentProvider !== "CASHFREE") {
      await Order.updateOne(
        { _id: orderId, paymentProvider: null },
        { $set: { paymentProvider: "CASHFREE" } }
      );
      order.paymentProvider = "CASHFREE";
    }
    return responseForExistingOrder(order);
  }

  const locked = await Order.findOneAndUpdate(
    { _id: orderId, cashfreeOrderId: null },
    { $set: { cashfreeOrderId: "LOCKED", paymentProvider: "CASHFREE" } },
    { new: false }
  );

  if (!locked) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const refreshed = await Order.findById(orderId);
    if (refreshed?.cashfreeOrderId && refreshed.cashfreeOrderId !== "LOCKED") {
      return responseForExistingOrder(refreshed);
    }
    const err = new Error("Payment initiation already in progress");
    err.status = 409;
    throw err;
  }

  let client;
  let amount;
  let phone;
  let notifyUrl;
  let checkoutMode;
  try {
    const vendor = await loadCashfreeVendor(order);
    client = cashfreeClient(vendor);
    checkoutMode = cashfreeCheckoutMode(vendor);
    notifyUrl = cashfreeNotifyUrl(order.tenantId, order._id);
    amount = orderAmount(order);
    phone = customerPhone(order);
  } catch (err) {
    await Order.findByIdAndUpdate(orderId, { cashfreeOrderId: null });
    throw err;
  }

  const merchantOrderId = orderId.toString();

  let response;
  try {
    response = await client.PGCreateOrder({
      order_id: merchantOrderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: String(order.userId).replace(/[^a-zA-Z0-9_-]/g, "") || merchantOrderId,
        customer_phone: phone,
        ...(order.customerName ? { customer_name: order.customerName } : {}),
      },
      order_meta: {
        notify_url: notifyUrl,
      },
      order_tags: {
        tenantId: String(order.tenantId),
        orderId: merchantOrderId,
      },
    });
  } catch (err) {
    await Order.findByIdAndUpdate(orderId, { cashfreeOrderId: null });
    throwCashfreeRequestError(err, order.tenantId, order._id);
  }

  const savedOrderId = response?.data?.order_id || merchantOrderId;
  await Order.findByIdAndUpdate(orderId, { cashfreeOrderId: savedOrderId });
  order.cashfreeOrderId = savedOrderId;

  console.log({
    tenantId: order.tenantId,
    orderId: merchantOrderId,
    cashfreeOrderId: savedOrderId,
    paymentStatus: order.paymentStatus,
    provider: "CASHFREE",
    environment: checkoutMode,
  });

  if (!response?.data?.payment_session_id) {
    return responseForExistingOrder(order);
  }

  return checkoutResponse(order, {
    paymentSessionId: response.data.payment_session_id,
    environment: checkoutMode,
  });
}

function webhookLog(fields) {
  console.log({
    provider: "CASHFREE",
    source: "webhook",
    ...fields,
  });
}

function headerValue(value) {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0].trim() : "";
  return typeof value === "string" ? value.trim() : "";
}

function signaturesMatch(expected, received) {
  const actual = Buffer.from(expected);
  const claimed = Buffer.from(received);
  if (actual.length !== claimed.length) return false;
  return crypto.timingSafeEqual(actual, claimed);
}

function verifyCashfreeSignature(rawBody, signature, timestamp, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp + rawBody)
    .digest("base64");
  return signaturesMatch(expected, signature);
}

function decryptCashfreeWebhookSecret(vendor) {
  if (!vendor?.cashfree?.encryptedWebhookSecret) {
    const err = new Error("Cashfree webhook secret is not configured");
    err.status = 500;
    throw err;
  }
  try {
    return decrypt(vendor.cashfree.encryptedWebhookSecret);
  } catch (err) {
    const error = new Error("Failed to decrypt vendor cashfree webhook secret");
    error.status = 500;
    error.cause = err;
    throw error;
  }
}

function cashfreeWebhookOutcome(event) {
  const status = event?.data?.payment?.payment_status;
  const type = event?.type;
  if (status === "SUCCESS" || (type === "PAYMENT_SUCCESS_WEBHOOK" && !status)) {
    return "SUCCESS";
  }
  if (FAILED_PAYMENT_STATUSES.has(status) || FAILED_WEBHOOK_TYPES.has(type)) {
    return "FAILED";
  }
  return "PENDING";
}

async function applyCashfreeOutcome(order, { outcome, paymentId }) {
  const baseLog = {
    tenantId: order.tenantId,
    orderId: order._id.toString(),
    cashfreeOrderId: order.cashfreeOrderId,
    cashfreePaymentId: paymentId || order.cashfreePaymentId || null,
  };

  if (outcome === "SUCCESS") {
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: { $nin: ["PAID", "REFUNDED"] } },
      {
        paymentStatus: "PAID",
        paymentProvider: "CASHFREE",
        ...(paymentId ? { cashfreePaymentId: paymentId } : {}),
      },
      { new: true }
    );
    if (!updated) {
      const current = await Order.findById(order._id).select("paymentStatus cashfreePaymentId");
      return {
        applied: false,
        paymentStatus: current?.paymentStatus || null,
        cashfreePaymentId: current?.cashfreePaymentId || baseLog.cashfreePaymentId,
      };
    }
    const placed = await placePaidOnlineOrder(updated);
    void notifyOrderPlacedSafe(placed || updated);
    return {
      applied: true,
      paymentStatus: "PAID",
      cashfreePaymentId: updated.cashfreePaymentId || paymentId || null,
    };
  }

  if (outcome === "FAILED") {
    const cancelled = await cancelUnpaidOnlineOrder(order._id);
    if (cancelled) {
      return { applied: true, paymentStatus: "FAILED" };
    }
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: { $nin: ["PAID", "REFUNDED"] } },
      { paymentStatus: "FAILED" },
      { new: true }
    );
    if (!updated) {
      const current = await Order.findById(order._id).select("paymentStatus");
      return { applied: false, paymentStatus: current?.paymentStatus || null };
    }
    return { applied: true, paymentStatus: "FAILED" };
  }

  return { applied: false, paymentStatus: order.paymentStatus || "PENDING" };
}

async function verifyCashfreePayment(order) {
  if (!order.cashfreeOrderId || order.cashfreeOrderId === "LOCKED") {
    const err = new Error("Payment has not been initiated");
    err.status = 400;
    throw err;
  }

  const vendor = await loadCashfreeVendor(order);
  const client = cashfreeClient(vendor);

  let payments;
  try {
    const response = await client.PGOrderFetchPayments(order.cashfreeOrderId);
    payments = response?.data;
  } catch (err) {
    throwCashfreeRequestError(err, order.tenantId, order._id);
  }

  const classified = classifyPayments(payments);
  const result = await applyCashfreeOutcome(order, {
    outcome: classified.outcome,
    paymentId: classified.paymentId,
  });

  console.log({
    tenantId: order.tenantId,
    orderId: order._id.toString(),
    cashfreeOrderId: order.cashfreeOrderId,
    cashfreePaymentId: result.cashfreePaymentId || classified.paymentId || null,
    paymentStatus: result.paymentStatus,
    provider: "CASHFREE",
    source: "verify",
    result: result.applied ? `marked_${String(result.paymentStatus).toLowerCase()}` : "unchanged",
  });

  if (classified.outcome === "SUCCESS") {
    if (result.paymentStatus === "PAID") {
      return { success: true, status: "SUCCESS", message: "Payment verified successfully" };
    }
    return { success: false, status: "FAILED", message: "Unable to confirm payment for this order" };
  }
  if (classified.outcome === "FAILED") {
    return { success: false, status: "FAILED", message: "Payment failed" };
  }
  return { success: false, status: "PENDING", message: "Payment is pending" };
}

async function handleCashfreeWebhook({ rawBody, signature, timestamp }) {
  const receivedSignature = headerValue(signature);
  const receivedTimestamp = headerValue(timestamp);
  if (!rawBody || !receivedSignature || !receivedTimestamp) {
    return { statusCode: 400, body: { message: "Invalid webhook signature" } };
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: { message: "Invalid JSON payload" } };
  }

  const cashfreeOrderId = event?.data?.order?.order_id;
  if (!cashfreeOrderId || typeof cashfreeOrderId !== "string") {
    return { statusCode: 400, body: { message: "Missing Cashfree order id" } };
  }

  const order = await Order.findOne({ cashfreeOrderId });
  if (!order) {
    webhookLog({
      cashfreeOrderId,
      event: event?.type || null,
      result: "order_not_found",
    });
    return { statusCode: 200, body: { received: true } };
  }

  if (order.paymentProvider !== "CASHFREE") {
    webhookLog({
      tenantId: order.tenantId,
      orderId: order._id.toString(),
      cashfreeOrderId,
      event: event?.type || null,
      result: "provider_mismatch",
    });
    return { statusCode: 200, body: { received: true } };
  }

  const vendor = await Vendor.findOne({ tenantId: order.tenantId });
  if (!vendor) {
    webhookLog({
      tenantId: order.tenantId,
      orderId: order._id.toString(),
      cashfreeOrderId,
      result: "vendor_missing",
    });
    return { statusCode: 500, body: { message: "Vendor webhook secret not configured" } };
  }

  let webhookSecret;
  try {
    webhookSecret = decryptCashfreeWebhookSecret(vendor);
  } catch (err) {
    webhookLog({
      tenantId: order.tenantId,
      orderId: order._id.toString(),
      cashfreeOrderId,
      result: "webhook_secret_unavailable",
    });
    return {
      statusCode: err.status || 500,
      body: { message: "Vendor webhook secret not configured" },
    };
  }

  let signatureValid = false;
  try {
    signatureValid = verifyCashfreeSignature(
      rawBody,
      receivedSignature,
      receivedTimestamp,
      webhookSecret
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    webhookLog({
      tenantId: order.tenantId,
      orderId: order._id.toString(),
      cashfreeOrderId,
      event: event?.type || null,
      result: "invalid_signature",
    });
    return { statusCode: 400, body: { message: "Invalid webhook signature" } };
  }

  if (isCashfreeRefundEvent(event)) {
    const result = await applyCashfreeRefund(order, event.data.refund);
    webhookLog({
      tenantId: order.tenantId,
      orderId: order._id.toString(),
      cashfreeOrderId,
      cashfreeRefundId: result.cashfreeRefundId,
      event: event?.type || null,
      paymentStatus: result.paymentStatus,
      result: result.applied ? `refund_${String(result.refundStatus).toLowerCase()}` : "refund_unchanged",
    });
    return { statusCode: 200, body: { received: true } };
  }

  const paymentId = event?.data?.payment?.cf_payment_id
    ? String(event.data.payment.cf_payment_id)
    : null;
  const outcome = cashfreeWebhookOutcome(event);
  const result = await applyCashfreeOutcome(order, { outcome, paymentId });
  webhookLog({
    tenantId: order.tenantId,
    orderId: order._id.toString(),
    cashfreeOrderId,
    cashfreePaymentId: result.cashfreePaymentId || paymentId,
    event: event?.type || null,
    paymentStatus: result.paymentStatus,
    result: result.applied
      ? `marked_${String(result.paymentStatus).toLowerCase()}`
      : outcome === "PENDING"
        ? "left_pending"
        : "unchanged",
  });

  return { statusCode: 200, body: { received: true } };
}

function isCashfreeRefundEvent(event) {
  return String(event?.type || "").includes("REFUND") && Boolean(event?.data?.refund);
}

function cashfreeRefundReference(order) {
  const base = `rf${order._id.toString()}`;
  if (order.refundStatus === "FAILED") {
    return `${base}${Date.now().toString(36)}`.slice(0, 40);
  }
  return order.cashfreeRefundId || base;
}

function mapCashfreeRefund(refund, order, requestedAmount) {
  const status = refund?.refund_status;
  const refundedRupees = Number(refund?.refund_amount ?? requestedAmount);
  const isFullRefund = refundedRupees >= Number(order.totalAmount) - 0.01;
  const refundId = refund?.refund_id ? String(refund.refund_id) : null;
  if (status === "SUCCESS") {
    return {
      cashfreeRefundId: refundId,
      refundStatus: isFullRefund ? "FULL" : "PARTIAL",
      paymentStatus: "REFUNDED",
      refundAmount: refundedRupees,
      refundedAt: new Date(),
      refundFailureReason: "",
    };
  }
  if (status === "PENDING" || status === "ONHOLD") {
    return {
      cashfreeRefundId: refundId,
      refundStatus: "PENDING",
      paymentStatus: "REFUND_PENDING",
      refundAmount: refundedRupees,
      refundedAt: null,
      refundFailureReason: "",
    };
  }
  return {
    cashfreeRefundId: refundId,
    refundStatus: "FAILED",
    refundAmount: refundedRupees,
    refundFailureReason: refund?.status_description || "Cashfree refund failed",
  };
}

async function readCashfreeRefund(client, order, refundId) {
  const response = await client.PGOrderFetchRefund(order.cashfreeOrderId, refundId);
  return response?.data || {};
}

async function applyCashfreeRefund(order, refund) {
  const updates = mapCashfreeRefund(refund, order, order.refundAmount);
  if (!updates.cashfreeRefundId) return { applied: false, ...updates, paymentStatus: order.paymentStatus };
  const updated = await Order.findByIdAndUpdate(order._id, updates, { new: true });
  return {
    applied: true,
    cashfreeRefundId: updated?.cashfreeRefundId || updates.cashfreeRefundId,
    refundStatus: updated?.refundStatus || updates.refundStatus,
    paymentStatus: updated?.paymentStatus || order.paymentStatus,
  };
}

async function refundCashfreeOrder(order, { amount, reason } = {}) {
  if (!order.cashfreeOrderId || order.cashfreeOrderId === "LOCKED") {
    const err = new Error("Cashfree payment was not completed for this order");
    err.status = 422;
    throw err;
  }

  const vendor = await loadCashfreeVendor(order);
  const client = cashfreeClient(vendor);
  const refundRupees = Math.round(Number(amount) * 100) / 100;
  const refundId = cashfreeRefundReference(order);

  if (order.cashfreeRefundId && order.refundStatus === "PENDING") {
    try {
      const existing = await readCashfreeRefund(client, order, order.cashfreeRefundId);
      const updates = mapCashfreeRefund(existing, order, refundRupees);
      await Order.findByIdAndUpdate(order._id, updates);
      if (updates.refundStatus === "FAILED") {
        const err = new Error(updates.refundFailureReason || "Cashfree refund failed");
        err.status = 422;
        throw err;
      }
      return {
        success: true,
        skipped: false,
        refundId: updates.cashfreeRefundId,
        refundStatus: updates.refundStatus,
        paymentStatus: updates.paymentStatus,
      };
    } catch (err) {
      if (err.status === 422) throw err;
    }
  }

  let refund;
  try {
    const response = await client.PGOrderCreateRefund(
      order.cashfreeOrderId,
      {
        refund_amount: refundRupees,
        refund_id: refundId,
        refund_speed: "STANDARD",
        refund_note: vendor.cashfree.environment === "SANDBOX" ? "SUCCESS" : String(reason || "order_refund").slice(0, 100),
      },
      undefined,
      refundId
    );
    refund = response?.data || {};
  } catch (err) {
    const message = err?.response?.data?.message || err.message || "Cashfree refund failed";
    const duplicate = /already exist|duplicate|idempoten/i.test(message);
    if (!duplicate) {
      await Order.findByIdAndUpdate(order._id, {
        refundStatus: "FAILED",
        refundFailureReason: message,
      });
      console.error("refundCashfreeOrder failed", {
        tenantId: order.tenantId,
        orderId: order._id.toString(),
        cashfreeOrderId: order.cashfreeOrderId,
        status: err?.response?.status || null,
      });
      const error = new Error(message);
      error.status = 502;
      throw error;
    }
    refund = await readCashfreeRefund(client, order, refundId);
  }

  const updates = mapCashfreeRefund(refund, order, refundRupees);
  await Order.findByIdAndUpdate(order._id, updates);

  console.log({
    tenantId: order.tenantId,
    orderId: order._id.toString(),
    cashfreeOrderId: order.cashfreeOrderId,
    cashfreeRefundId: updates.cashfreeRefundId,
    refundStatus: updates.refundStatus,
    paymentStatus: updates.paymentStatus || order.paymentStatus,
  });

  if (updates.refundStatus === "FAILED") {
    const err = new Error(updates.refundFailureReason || "Cashfree refund failed");
    err.status = 422;
    throw err;
  }

  return {
    success: true,
    skipped: false,
    refundId: updates.cashfreeRefundId,
    refundStatus: updates.refundStatus,
    paymentStatus: updates.paymentStatus,
  };
}

module.exports = {
  createCashfreePayment,
  verifyCashfreePayment,
  handleCashfreeWebhook,
  refundCashfreeOrder,
};
