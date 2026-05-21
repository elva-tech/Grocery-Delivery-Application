const PDFDocument = require("pdfkit");
const BillingInvoice = require("../models/BillingInvoice.model");
const BillingUsage = require("../models/BillingUsage.model");
const TenantSubscription = require("../models/TenantSubscription.model");
const Tenant = require("../../../models/Tenant.model");
const Store = require("../../../models/Store.model");
function storeIdFor(tenantId) {
  return tenantId;
}

const TZ = "Asia/Kolkata";
const BRAND = "KMF E Grocery — ELVA Billing";

function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtMoney(n) {
  return `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function inferPaymentMethod(paymentId, stored) {
  if (stored) return stored;
  if (!paymentId) return "—";
  const id = String(paymentId);
  if (id.startsWith("pay_")) return "Razorpay (Online)";
  if (id.startsWith("super_")) return "Super Admin (Manual)";
  if (id.startsWith("manual_")) return "Manual / Offline";
  return "Other";
}

function planLabel(snapshot) {
  if (!snapshot) return "—";
  const parts = [
    snapshot.name || snapshot.plan_code,
    snapshot.pricing_model,
    snapshot.monthly_price > 0 ? `${fmtMoney(snapshot.monthly_price)}/mo` : null,
    snapshot.included_orders ? `${snapshot.included_orders} orders incl.` : null,
    snapshot.price_per_order > 0 ? `${fmtMoney(snapshot.price_per_order)}/order` : null,
    snapshot.price_per_extra_order > 0
      ? `${fmtMoney(snapshot.price_per_extra_order)}/extra order`
      : null,
  ].filter(Boolean);
  return parts.join(" · ") || "—";
}

async function buildInvoiceAuditPayload(tenantId, invoiceId) {
  const store_id = storeIdFor(tenantId);
  const invoice = await BillingInvoice.findOne({
    _id: invoiceId,
    tenant_id: tenantId,
    store_id,
  }).lean();

  if (!invoice) return null;

  const [tenant, store, usage, subscription] = await Promise.all([
    Tenant.findOne({ tenantId }).lean(),
    Store.findOne({ tenantId }).lean(),
    BillingUsage.findOne({
      tenant_id: tenantId,
      store_id,
      billing_month: invoice.billing_month,
      billing_year: invoice.billing_year,
    }).lean(),
    TenantSubscription.findById(invoice.subscription_id).lean(),
  ]);

  const status =
    invoice.payment_status === "PAID" || invoice.invoice_status === "PAID"
      ? "PAID"
      : invoice.invoice_status;

  return {
    generatedAt: new Date(),
    brand: BRAND,
    tenant: {
      tenantId,
      name: tenant?.name || tenantId,
      ownerName: tenant?.ownerName || "—",
      phone: tenant?.phoneNumber || "—",
      email: tenant?.contactEmail || "—",
      status: tenant?.status || "—",
      plan: tenant?.plan || "—",
    },
    store: {
      storeId: store_id,
      name: store?.name || tenant?.name || "—",
    },
    invoice: {
      id: invoice._id,
      invoiceNumber: invoice.invoice_number,
      billingMonth: invoice.billing_month,
      billingYear: invoice.billing_year,
      periodLabel: `${String(invoice.billing_month).padStart(2, "0")}/${invoice.billing_year}`,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      status,
      paymentStatus: invoice.payment_status,
      isCurrentCycle: !!invoice.is_current_cycle,
      baseAmount: invoice.base_amount,
      perOrderCharges: invoice.per_order_charges,
      extraCharges: invoice.extra_charges,
      totalAmount: invoice.total_amount,
      planSnapshot: invoice.plan_snapshot,
      planLabel: planLabel(invoice.plan_snapshot),
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at,
    },
    usage: usage
      ? {
          ordersUsed: usage.orders_used,
          extraOrders: usage.extra_orders,
          subtotal: usage.subtotal,
          perOrderCharges: usage.per_order_charges,
          extraCharges: usage.extra_charges,
          totalAmount: usage.total_amount,
        }
      : null,
    subscription: subscription
      ? {
          id: subscription._id,
          status: subscription.subscription_status,
          billingStart: subscription.billing_start_date,
          billingEnd: subscription.billing_end_date,
          uniqueKey: subscription.subscription_unique_key,
        }
      : null,
    payment: {
      paidAt: invoice.paid_at,
      transactionId: invoice.payment_id || "—",
      razorpayPaymentId:
        invoice.payment_id && String(invoice.payment_id).startsWith("pay_")
          ? invoice.payment_id
          : invoice.payment_id || "—",
      razorpayOrderId: invoice.razorpay_order_id || "—",
      paymentMethod: inferPaymentMethod(invoice.payment_id, invoice.payment_method),
    },
  };
}

function drawRow(doc, label, value, y, opts = {}) {
  const { labelX = 40, valueX = 220, width = 332 } = opts;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#6b7280").text(label, labelX, y, { width: 170 });
  doc.font("Helvetica").fontSize(9).fillColor("#111827").text(String(value ?? "—"), valueX, y, {
    width,
  });
  return y + 16;
}

async function writeBillingAuditPdf(doc, audit) {
  const green = "#16a34a";
  const muted = "#6b7280";
  const dark = "#111827";

  doc.rect(0, 0, 612, 12).fill(green);
  doc.fillColor(dark).fontSize(18).font("Helvetica-Bold").text(audit.brand, 40, 28, { width: 532 });
  doc
    .fillColor(muted)
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("SUBSCRIPTION INVOICE — AUDIT RECEIPT", 40, 52);

  doc.fontSize(9).font("Helvetica").fillColor(muted);
  doc.text(`Document generated: ${fmtDateTime(audit.generatedAt)} (IST)`, 40, 72);

  let y = 98;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(green).text("Store & tenant", 40, y);
  y += 20;
  y = drawRow(doc, "Store name", audit.store.name, y);
  y = drawRow(doc, "Tenant ID", audit.tenant.tenantId, y);
  y = drawRow(doc, "Legal / display name", audit.tenant.name, y);
  y = drawRow(doc, "Owner", audit.tenant.ownerName, y);
  y = drawRow(doc, "Contact phone", audit.tenant.phone, y);
  y = drawRow(doc, "Contact email", audit.tenant.email, y);
  y = drawRow(doc, "Account status", audit.tenant.status, y);

  y += 8;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(green).text("Invoice details", 40, y);
  y += 20;
  y = drawRow(doc, "Invoice number", audit.invoice.invoiceNumber, y);
  y = drawRow(doc, "Internal invoice ID", audit.invoice.id, y);
  y = drawRow(doc, "Billing period", audit.invoice.periodLabel, y);
  y = drawRow(doc, "Invoice date", fmtDate(audit.invoice.invoiceDate), y);
  y = drawRow(doc, "Due date", fmtDate(audit.invoice.dueDate), y);
  y = drawRow(doc, "Invoice status", audit.invoice.status, y);
  y = drawRow(doc, "Payment status", audit.invoice.paymentStatus, y);
  y = drawRow(doc, "Current cycle flag", audit.invoice.isCurrentCycle ? "Yes" : "No", y);
  y = drawRow(doc, "Record created", fmtDateTime(audit.invoice.createdAt), y);
  y = drawRow(doc, "Record updated", fmtDateTime(audit.invoice.updatedAt), y);

  y += 8;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(green).text("Plan (snapshot at billing)", 40, y);
  y += 20;
  y = drawRow(doc, "Plan", audit.invoice.planLabel, y);
  if (audit.subscription) {
    y = drawRow(doc, "Subscription ID", audit.subscription.id, y);
    y = drawRow(doc, "Subscription key", audit.subscription.uniqueKey, y);
    y = drawRow(doc, "Subscription status", audit.subscription.status, y);
    y = drawRow(
      doc,
      "Cycle on subscription",
      `${fmtDate(audit.subscription.billingStart)} – ${fmtDate(audit.subscription.billingEnd)}`,
      y
    );
  }

  y += 8;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(green).text("Amount breakdown", 40, y);
  y += 20;
  y = drawRow(doc, "Base / subscription amount", fmtMoney(audit.invoice.baseAmount), y);
  y = drawRow(doc, "Per-order charges", fmtMoney(audit.invoice.perOrderCharges), y);
  y = drawRow(doc, "Extra order charges", fmtMoney(audit.invoice.extraCharges), y);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(dark);
  y = drawRow(doc, "Total amount", fmtMoney(audit.invoice.totalAmount), y);

  if (audit.usage) {
    y += 8;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(green).text("Usage for period", 40, y);
    y += 20;
    y = drawRow(doc, "Orders used", audit.usage.ordersUsed, y);
    y = drawRow(doc, "Extra orders", audit.usage.extraOrders, y);
    y = drawRow(doc, "Usage subtotal", fmtMoney(audit.usage.subtotal), y);
    y = drawRow(doc, "Usage total (running)", fmtMoney(audit.usage.totalAmount), y);
  }

  if (y > 620) {
    doc.addPage({ size: "A4", margin: 40 });
    y = 50;
  } else {
    y += 12;
  }

  doc.font("Helvetica-Bold").fontSize(11).fillColor(green).text("Payment & audit trail", 40, y);
  y += 20;
  y = drawRow(doc, "Payment method", audit.payment.paymentMethod, y);
  y = drawRow(doc, "Paid at (IST)", fmtDateTime(audit.payment.paidAt), y);
  y = drawRow(doc, "Transaction / payment ID", audit.payment.transactionId, y);
  y = drawRow(doc, "Razorpay payment ID", audit.payment.razorpayPaymentId, y);
  y = drawRow(doc, "Razorpay order ID", audit.payment.razorpayOrderId, y);

  y += 16;
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(muted)
    .text(
      "This document is generated for audit and reconciliation. Retain with your accounting records. " +
        "For Razorpay payments, verify transaction IDs in the Razorpay dashboard using the payment ID above.",
      40,
      y,
      { width: 532, align: "left" }
    );

  doc.rect(0, 778, 612, 14).fill(green);
}

function generateBillingAuditPdfBuffer(audit) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    writeBillingAuditPdf(doc, audit)
      .then(() => doc.end())
      .catch(reject);
  });
}

function buildCsvExport(rows) {
  const headers = [
    "Invoice Number",
    "Invoice ID",
    "Tenant ID",
    "Store Name",
    "Billing Period",
    "Invoice Date",
    "Due Date",
    "Status",
    "Payment Status",
    "Base Amount",
    "Per Order Charges",
    "Extra Charges",
    "Total Amount",
    "Orders Used",
    "Extra Orders",
    "Paid At (IST)",
    "Payment Method",
    "Transaction ID",
    "Razorpay Payment ID",
    "Razorpay Order ID",
    "Subscription ID",
    "Plan",
    "Created At",
    "Updated At",
  ];

  const escape = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.invoiceNumber,
        r.invoiceId,
        r.tenantId,
        r.storeName,
        r.periodLabel,
        r.invoiceDate,
        r.dueDate,
        r.status,
        r.paymentStatus,
        r.baseAmount,
        r.perOrderCharges,
        r.extraCharges,
        r.totalAmount,
        r.ordersUsed,
        r.extraOrders,
        r.paidAt,
        r.paymentMethod,
        r.transactionId,
        r.razorpayPaymentId,
        r.razorpayOrderId,
        r.subscriptionId,
        r.plan,
        r.createdAt,
        r.updatedAt,
      ]
        .map(escape)
        .join(",")
    );
  }
  return lines.join("\n");
}

async function buildCsvRowsFromInvoices(tenantId, invoices, tenant, store) {
  const store_id = storeIdFor(tenantId);
  const rows = [];

  for (const inv of invoices) {
    const usage = await BillingUsage.findOne({
      tenant_id: tenantId,
      store_id,
      billing_month: inv.billing_month,
      billing_year: inv.billing_year,
    }).lean();

    const status =
      inv.payment_status === "PAID" || inv.invoice_status === "PAID" ? "PAID" : inv.invoice_status;

    rows.push({
      invoiceNumber: inv.invoice_number,
      invoiceId: inv._id,
      tenantId,
      storeName: store?.name || tenant?.name || tenantId,
      periodLabel: `${String(inv.billing_month).padStart(2, "0")}/${inv.billing_year}`,
      invoiceDate: fmtDate(inv.invoice_date),
      dueDate: fmtDate(inv.due_date),
      status,
      paymentStatus: inv.payment_status,
      baseAmount: inv.base_amount,
      perOrderCharges: inv.per_order_charges,
      extraCharges: inv.extra_charges,
      totalAmount: inv.total_amount,
      ordersUsed: usage?.orders_used ?? "",
      extraOrders: usage?.extra_orders ?? "",
      paidAt: fmtDateTime(inv.paid_at),
      paymentMethod: inferPaymentMethod(inv.payment_id, inv.payment_method),
      transactionId: inv.payment_id || "",
      razorpayPaymentId:
        inv.payment_id && String(inv.payment_id).startsWith("pay_") ? inv.payment_id : "",
      razorpayOrderId: inv.razorpay_order_id || "",
      subscriptionId: inv.subscription_id || "",
      plan: planLabel(inv.plan_snapshot),
      createdAt: fmtDateTime(inv.created_at),
      updatedAt: fmtDateTime(inv.updated_at),
    });
  }
  return rows;
}

module.exports = {
  buildInvoiceAuditPayload,
  generateBillingAuditPdfBuffer,
  buildCsvExport,
  buildCsvRowsFromInvoices,
  fmtDateTime,
};
