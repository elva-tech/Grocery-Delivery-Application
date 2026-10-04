const Vendor = require("../models/Vendor.model");
const { encrypt } = require("../utils/encryption");

function assertAdminTenantAccess(req, tenantId) {
  if (req.user.role === "ADMIN" && req.user.tenantId !== tenantId) {
    const err = new Error("Cannot access another tenant's vendor configuration");
    err.status = 403;
    throw err;
  }
}

exports.setRazorpayConfig = async (req, res) => {
  try {
    const { tenantId, keyId, keySecret, webhookSecret } = req.body;

    if (!tenantId || !keyId || !keySecret || !webhookSecret) {
      return res.status(400).json({
        message: "tenantId, keyId, keySecret, and webhookSecret are required",
      });
    }

    assertAdminTenantAccess(req, tenantId);

    const vendor = await Vendor.findOneAndUpdate(
      { tenantId },
      {
        $set: {
          tenantId,
          "razorpay.keyId": keyId,
          "razorpay.encryptedKeySecret": encrypt(keySecret),
          "razorpay.encryptedWebhookSecret": encrypt(webhookSecret),
          "razorpay.onboardingStatus": "ACTIVE",
          "razorpay.accountStatus": "ACTIVE",
          paymentGateway: "RAZORPAY",
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(200).json({
      tenantId: vendor.tenantId,
      paymentGateway: vendor.paymentGateway,
      onboardingStatus: vendor.razorpay.onboardingStatus,
      accountStatus: vendor.razorpay.accountStatus,
    });
  } catch (err) {
    console.error("setRazorpayConfig error:", err.message);
    const status = err.status || 500;
    return res.status(status).json({
      message: err.message || "Failed to save Razorpay configuration",
    });
  }
};

exports.getRazorpayStatus = async (req, res) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ message: "tenantId is required" });
    }

    assertAdminTenantAccess(req, tenantId);

    const vendor = await Vendor.findOne({ tenantId }).select(
      "tenantId paymentGateway razorpay.onboardingStatus razorpay.accountStatus"
    );

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    return res.status(200).json({
      tenantId: vendor.tenantId,
      paymentGateway:
        vendor.paymentGateway === "RAZORPAY" || vendor.paymentGateway === "CASHFREE"
          ? vendor.paymentGateway
          : null,
      onboardingStatus: vendor.razorpay?.onboardingStatus ?? "PENDING",
      accountStatus: vendor.razorpay?.accountStatus ?? "ACTIVE",
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      message: err.message || "Failed to fetch Razorpay status",
    });
  }
};

async function saveCashfreeConfig(req, res, environment) {
  try {
    const { tenantId, appId, secretKey, webhookSecret } = req.body;

    if (!tenantId || !appId || !secretKey || !webhookSecret) {
      return res.status(400).json({
        message: "tenantId, appId, secretKey, and webhookSecret are required",
      });
    }

    assertAdminTenantAccess(req, tenantId);

    const vendor = await Vendor.findOneAndUpdate(
      { tenantId },
      {
        $set: {
          tenantId,
          paymentGateway: "CASHFREE",
          "cashfree.appId": appId,
          "cashfree.encryptedSecretKey": encrypt(secretKey),
          "cashfree.encryptedWebhookSecret": encrypt(webhookSecret),
          "cashfree.environment": environment,
          "cashfree.onboardingStatus": "ACTIVE",
          "cashfree.accountStatus": "ACTIVE",
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(200).json({
      tenantId: vendor.tenantId,
      paymentGateway: vendor.paymentGateway,
      environment: vendor.cashfree.environment,
      onboardingStatus: vendor.cashfree.onboardingStatus,
      accountStatus: vendor.cashfree.accountStatus,
      webhookSecretConfigured: Boolean(vendor.cashfree.encryptedWebhookSecret),
    });
  } catch (err) {
    console.error("saveCashfreeConfig error:", err.message);
    const status = err.status || 500;
    return res.status(status).json({
      message: err.message || "Failed to save Cashfree configuration",
    });
  }
}

exports.setCashfreeSandboxConfig = (req, res) => saveCashfreeConfig(req, res, "SANDBOX");

exports.setCashfreeProductionConfig = (req, res) =>
  saveCashfreeConfig(req, res, "PRODUCTION");

exports.getCashfreeStatus = async (req, res) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ message: "tenantId is required" });
    }

    assertAdminTenantAccess(req, tenantId);

    const vendor = await Vendor.findOne({ tenantId }).select(
      "tenantId paymentGateway cashfree.environment cashfree.onboardingStatus cashfree.accountStatus cashfree.appId cashfree.encryptedSecretKey cashfree.encryptedWebhookSecret"
    );

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    return res.status(200).json({
      tenantId: vendor.tenantId,
      paymentGateway:
        vendor.paymentGateway === "RAZORPAY" || vendor.paymentGateway === "CASHFREE"
          ? vendor.paymentGateway
          : null,
      environment: vendor.cashfree?.environment || null,
      onboardingStatus: vendor.cashfree?.onboardingStatus ?? "PENDING",
      accountStatus: vendor.cashfree?.accountStatus ?? "ACTIVE",
      appIdConfigured: Boolean(vendor.cashfree?.appId),
      secretKeyConfigured: Boolean(vendor.cashfree?.encryptedSecretKey),
      webhookSecretConfigured: Boolean(vendor.cashfree?.encryptedWebhookSecret),
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      message: err.message || "Failed to fetch Cashfree status",
    });
  }
};
