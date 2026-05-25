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
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(200).json({
      tenantId: vendor.tenantId,
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
      "tenantId razorpay.onboardingStatus razorpay.accountStatus"
    );

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    return res.status(200).json({
      tenantId: vendor.tenantId,
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
