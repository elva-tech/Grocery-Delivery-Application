const Tenant = require("../../../models/Tenant.model");
const TenantSubscription = require("../models/TenantSubscription.model");
const BillingInvoice = require("../models/BillingInvoice.model");

async function assertCanPlaceOrder(tenantId, storeId = tenantId) {
  const tenant = await Tenant.findOne({ tenantId }).select("status").lean();
  if (tenant?.status === "SUSPENDED") {
    const err = new Error("Store account is suspended. Orders cannot be placed.");
    err.code = "TENANT_SUSPENDED";
    err.status = 403;
    throw err;
  }

  const sub = await TenantSubscription.findOne({
    tenant_id: tenantId,
    store_id: storeId,
    subscription_status: "ACTIVE",
  }).lean();

  if (sub?.subscription_status === "SUSPENDED") {
    const err = new Error("Billing subscription suspended. Orders cannot be placed.");
    err.code = "SUBSCRIPTION_SUSPENDED";
    err.status = 403;
    throw err;
  }

  const overdue = await BillingInvoice.findOne({
    tenant_id: tenantId,
    store_id: storeId,
    invoice_status: "OVERDUE",
    payment_status: "UNPAID",
  }).lean();

  if (overdue) {
    const err = new Error(
      "Payment overdue on platform invoice. Please pay your subscription bill to resume orders."
    );
    err.code = "BILLING_OVERDUE";
    err.status = 402;
    throw err;
  }

  return true;
}

module.exports = { assertCanPlaceOrder };
