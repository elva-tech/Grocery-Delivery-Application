const billing = require("../services/billing.service");

exports.generateMonthlyInvoices = async (req, res) => {
  try {
    const secret = process.env.BILLING_CRON_SECRET;
    if (secret && req.headers["x-billing-secret"] !== secret) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const tenantId = req.body?.tenantId || null;
    const result = await billing.generateMonthlyBilling(tenantId);
    res.json({ success: true, result });
  } catch (err) {
    console.error("[system/generateMonthlyInvoices]", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.suspendOverdueAccounts = async (req, res) => {
  try {
    const secret = process.env.BILLING_CRON_SECRET;
    if (secret && req.headers["x-billing-secret"] !== secret) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const result = await billing.processOverdueInvoices();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sendReminders = async (req, res) => {
  try {
    const secret = process.env.BILLING_CRON_SECRET;
    if (secret && req.headers["x-billing-secret"] !== secret) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const result = await billing.sendBillingReminders();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
