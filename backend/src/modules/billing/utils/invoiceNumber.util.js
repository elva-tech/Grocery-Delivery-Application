const BillingInvoice = require("../models/BillingInvoice.model");

async function generateInvoiceNumber(tenantId, billingYear, billingMonth) {
  const token = String(tenantId || "TENANT")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 6) || "TENANT";
  const ym = `${billingYear}${String(billingMonth).padStart(2, "0")}`;
  const prefix = `ELVA-${token}-${ym}-`;

  const last = await BillingInvoice.findOne({
    tenant_id: tenantId,
    invoice_number: new RegExp(`^${prefix}`),
  })
    .sort({ created_at: -1 })
    .select("invoice_number")
    .lean();

  let seq = 1;
  if (last?.invoice_number) {
    const parts = last.invoice_number.split("-");
    const n = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

module.exports = { generateInvoiceNumber };
