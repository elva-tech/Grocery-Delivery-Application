const Vendor = require("../models/Vendor.model");

const PAYMENT_PROVIDERS = new Set(["RAZORPAY", "CASHFREE"]);

function gatewayConfigError(reason, tenantId, orderId) {
  console.error({
    tenantId: tenantId || null,
    orderId: orderId ? String(orderId) : null,
    reason,
  });
  const err = new Error("Payment gateway is not configured");
  err.status = 400;
  err.code = "PAYMENT_GATEWAY_NOT_CONFIGURED";
  return err;
}

function explicitVendorGateway(vendor, tenantId, orderId) {
  if (!vendor) {
    throw gatewayConfigError("vendor missing", tenantId, orderId);
  }
  const gateway = vendor.paymentGateway;
  if (typeof gateway !== "string" || !gateway.trim()) {
    throw gatewayConfigError("paymentGateway missing", tenantId, orderId);
  }
  if (!PAYMENT_PROVIDERS.has(gateway)) {
    throw gatewayConfigError("paymentGateway invalid", tenantId, orderId);
  }
  return gateway;
}

async function resolvePaymentProvider(order) {
  if (order.paymentProvider === "RAZORPAY" || order.paymentProvider === "CASHFREE") {
    return order.paymentProvider;
  }
  if (order.paymentProvider) {
    throw gatewayConfigError("paymentProvider invalid", order.tenantId, order._id);
  }
  const vendor = await Vendor.findOne({ tenantId: order.tenantId }).select(
    "tenantId paymentGateway"
  );
  return explicitVendorGateway(vendor, order.tenantId, order._id);
}

module.exports = {
  PAYMENT_PROVIDERS,
  gatewayConfigError,
  explicitVendorGateway,
  resolvePaymentProvider,
};
