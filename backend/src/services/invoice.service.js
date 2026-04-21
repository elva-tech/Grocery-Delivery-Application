const os = require("os");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const http = require("http");
const PDFDocument = require("pdfkit");
const { uploadToCloudinary } = require("./cloudinary.service");

function formatDate(d) {
  return new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function buildAddressText(deliveryAddress = {}) {
  const tail = [deliveryAddress.city, deliveryAddress.state, deliveryAddress.pincode]
    .filter(Boolean)
    .join(", ");
  return [deliveryAddress.line1, deliveryAddress.line2, deliveryAddress.landmark, tail]
    .filter(Boolean)
    .join(", ");
}

async function writeInvoicePdf(doc, { order, tenant, invoiceNumber }) {
  const red = "#9f1d1d";
  const muted = "#6b7280";
  const dark = "#111827";
  const subtotal =
    (order.totalAmount || 0) -
    (order.deliveryCharge || 0) +
    (order.discount || 0) +
    (order.couponDiscount || 0);
  const customerAddress = buildAddressText(order.deliveryAddress);
  const customerPhone = String(order.customerPhone || "").trim() || "NA";
  const companyName = String(tenant?.name || order.tenantId || "Store");
  const companyAddress = String(tenant?.storeAddress || "").trim() || "Address unavailable";
  const ownerPhone = String(tenant?.phoneNumber || "").trim() || "NA";
  const ownerEmail = String(tenant?.contactEmail || "").trim() || "NA";

  doc.rect(0, 0, 612, 14).fill(red);

  // Centered header: company name + order summary title.
  doc.fillColor(dark).fontSize(20).font("Helvetica-Bold").text(companyName, 40, 34, { width: 532, align: "center" });
  doc.fillColor(muted).fontSize(12).font("Helvetica-Bold").text("ORDER SUMMARY", 40, 58, { width: 532, align: "center" });

  // Optional tenant logo (top-right)
  if (tenant?.logo) {
    try {
      const logoBuffer = await fetchBinary(String(tenant.logo));
      doc.image(logoBuffer, 520, 22, { fit: [52, 52], align: "right", valign: "top" });
    } catch (_) {
      // Skip logo rendering if format/url is unsupported.
    }
  }

  doc.fontSize(10).font("Helvetica").fillColor(muted);
  doc.text(companyAddress, 40, 92, { width: 300 });
  doc.text(`Phone: ${ownerPhone}`, 40, 118);
  doc.text(`Email: ${ownerEmail}`, 40, 132);

  // Right metadata block with consistent alignment.
  doc.fontSize(10).font("Helvetica-Bold").fillColor(muted).text("DATE", 460, 92, { width: 120, align: "right" });
  doc.font("Helvetica").fillColor(dark).text(formatDate(order.createdAt), 460, 106, { width: 120, align: "right" });
  doc.font("Helvetica-Bold").fillColor(muted).text("SUMMARY NO.", 460, 126, { width: 120, align: "right" });
  doc.font("Helvetica").fillColor(dark).text(invoiceNumber, 460, 140, { width: 120, align: "right" });

  doc.moveTo(40, 170).lineTo(572, 170).strokeColor("#d1d5db").stroke();

  doc.fillColor(muted).font("Helvetica-Bold").fontSize(10).text("BILL TO", 40, 186);
  doc.fillColor(dark).font("Helvetica").fontSize(10);
  doc.text(order.customerName || "Customer", 40, 200);
  doc.text(customerAddress || "-", 40, 214, { width: 240 });
  doc.text(`Phone: ${customerPhone}`, 40, 246, { width: 240 });

  doc.fillColor(muted).font("Helvetica-Bold").fontSize(10).text("SHIP TO", 320, 186);
  doc.fillColor(dark).font("Helvetica").fontSize(10);
  doc.text(order.customerName || "Customer", 320, 200);
  doc.text(customerAddress || "-", 320, 214, { width: 252 });
  doc.text(`Phone: ${customerPhone}`, 320, 246, { width: 252 });

  const tableTop = 285;
  doc.rect(40, tableTop, 532, 22).fill(red);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
  doc.text("DESCRIPTION", 50, tableTop + 7);
  doc.text("QTY", 360, tableTop + 7);
  doc.text("UNIT PRICE", 410, tableTop + 7);
  doc.text("TOTAL", 520, tableTop + 7);

  let y = tableTop + 28;
  doc.font("Helvetica").fontSize(10).fillColor(dark);
  for (const item of order.items || []) {
    doc.text(item.name || "Item", 50, y, { width: 290, ellipsis: true });
    doc.text(String(item.qty || 0), 366, y);
    doc.text(`Rs ${Number(item.price || 0).toFixed(2)}`, 410, y);
    doc.text(`Rs ${(Number(item.price || 0) * Number(item.qty || 0)).toFixed(2)}`, 512, y, { width: 60, align: "right" });
    y += 22;
    if (y > 630) break;
  }

  const totalsY = Math.max(y + 16, 650);
  doc.fillColor(muted).font("Helvetica").fontSize(10);
  doc.text("SUBTOTAL", 420, totalsY);
  doc.fillColor(dark).text(`Rs ${subtotal.toFixed(2)}`, 500, totalsY, { width: 72, align: "right" });
  doc.fillColor(muted).text("DELIVERY", 420, totalsY + 18);
  doc.fillColor(dark).text(`Rs ${Number(order.deliveryCharge || 0).toFixed(2)}`, 500, totalsY + 18, { width: 72, align: "right" });
  doc.fillColor(muted).text("DISCOUNT", 420, totalsY + 36);
  doc.fillColor(dark).text(`- Rs ${Number(order.discount || 0).toFixed(2)}`, 500, totalsY + 36, { width: 72, align: "right" });
  doc.fillColor(muted).text("COUPON", 420, totalsY + 54);
  doc.fillColor(dark).text(`- Rs ${Number(order.couponDiscount || 0).toFixed(2)}`, 500, totalsY + 54, { width: 72, align: "right" });

  doc.moveTo(420, totalsY + 74).lineTo(572, totalsY + 74).strokeColor("#d1d5db").stroke();
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(12).text("TOTAL", 420, totalsY + 84);
  doc.text(`Rs ${Number(order.totalAmount || 0).toFixed(2)}`, 500, totalsY + 84, { width: 72, align: "right" });
  doc.font("Helvetica").fontSize(10).fillColor(muted).text(`Payment Mode: ${order.paymentMode}`, 420, totalsY + 104);
  doc.rect(0, 778, 612, 14).fill(red);
}

function writePdfResponseHeaders(res, fileName) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
}

function generateInvoicePdfBuffer(payload) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    writeInvoicePdf(doc, payload)
      .then(() => doc.end())
      .catch(reject);
  });
}

async function generateAndUploadInvoicePdf(payload) {
  const fileName = `order-summary-${String(payload.order._id)}.pdf`;
  const tempFilePath = path.join(os.tmpdir(), `${crypto.randomUUID()}-${fileName}`);
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const stream = fs.createWriteStream(tempFilePath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);
    writeInvoicePdf(doc, payload)
      .then(() => doc.end())
      .catch(reject);
  });
  return uploadToCloudinary(tempFilePath, payload.order.tenantId, "bills", `order-summary-${String(payload.order._id)}`);
}

function fetchBinary(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (resp) => {
        if (resp.statusCode && resp.statusCode >= 400) {
          reject(new Error(`Unable to fetch invoice file. Status ${resp.statusCode}`));
          return;
        }
        const chunks = [];
        resp.on("data", (chunk) => chunks.push(chunk));
        resp.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function streamInvoicePdfFromCloudinary(fileUrl, res, fileName) {
  const pdfBuffer = await fetchBinary(fileUrl);
  writePdfResponseHeaders(res, fileName);
  res.send(pdfBuffer);
}

async function streamGeneratedInvoicePdf(payload, res, fileName) {
  const pdfBuffer = await generateInvoicePdfBuffer(payload);
  writePdfResponseHeaders(res, fileName);
  res.send(pdfBuffer);
}

module.exports = {
  generateAndUploadInvoicePdf,
  streamInvoicePdfFromCloudinary,
  streamGeneratedInvoicePdf,
};
