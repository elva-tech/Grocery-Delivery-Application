const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const billingInvoiceSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    tenant_id: { type: String, required: true, index: true },
    store_id: { type: String, required: true, index: true },
    subscription_id: { type: String, ref: "TenantSubscription", required: true },
    invoice_number: { type: String, required: true, unique: true },
    billing_month: { type: Number, required: true },
    billing_year: { type: Number, required: true },
    invoice_type: {
      type: String,
      enum: ["MONTHLY_SUBSCRIPTION", "EXTRA_USAGE", "PER_ORDER"],
      default: "PER_ORDER",
      index: true,
    },
    invoice_date: { type: Date, required: true },
    due_date: { type: Date, required: true },
    base_amount: { type: Number, default: 0 },
    extra_charges: { type: Number, default: 0 },
    per_order_charges: { type: Number, default: 0 },
    total_amount: { type: Number, default: 0 },
    invoice_status: {
      type: String,
      enum: ["PENDING", "PAID", "OVERDUE", "CANCELLED"],
      default: "PENDING",
    },
    payment_status: {
      type: String,
      enum: ["UNPAID", "PAID", "FAILED"],
      default: "UNPAID",
    },
    generated_pdf_url: { type: String, default: null },
    plan_snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    paid_at: { type: Date, default: null },
    payment_id: { type: String, default: null },
    payment_method: { type: String, default: null },
    razorpay_order_id: { type: String, default: null },
    is_current_cycle: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "billing_invoices",
  }
);

billingInvoiceSchema.index({ tenant_id: 1, store_id: 1, invoice_status: 1 });
billingInvoiceSchema.index({ tenant_id: 1, billing_year: 1, billing_month: 1 });
billingInvoiceSchema.index({ due_date: 1, payment_status: 1 });

module.exports = mongoose.model("BillingInvoice", billingInvoiceSchema);
