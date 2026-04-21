const mongoose = require("mongoose");

const customerInvoiceSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    sequenceNumber: { type: Number, required: true },
    invoiceNumber: { type: String, required: true, trim: true },
    invoiceUrl: { type: String, default: "", trim: true },
    invoicePublicId: { type: String, default: "", trim: true },
    fileType: { type: String, default: "application/pdf" },
    generatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

customerInvoiceSchema.index({ tenantId: 1, sequenceNumber: 1 }, { unique: true });
customerInvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model("CustomerInvoice", customerInvoiceSchema);
