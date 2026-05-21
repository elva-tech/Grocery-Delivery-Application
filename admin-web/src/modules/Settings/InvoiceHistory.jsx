import React, { useEffect, useState } from 'react';
import { FileText, Loader, ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiService } from '../../services/apiService';

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
    : '—';

const statusClass = (s) => {
  if (s === 'PAID') return 'bg-emerald-100 text-emerald-700';
  if (s === 'OVERDUE') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
};

const triggerBlobDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const InvoiceHistory = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiService
      .getInvoiceHistory()
      .then((res) => setInvoices(res.data || []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDownloadPdf = async (inv) => {
    try {
      setDownloadingId(inv._id);
      setError('');
      const blob = await apiService.downloadBillingInvoicePdf(inv._id);
      const name = `${(inv.invoice_number || 'invoice').replace(/[^\w.-]+/g, '_')}-audit.pdf`;
      triggerBlobDownload(blob, name);
    } catch {
      setError('Could not download invoice PDF. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      setError('');
      const blob = await apiService.exportBillingInvoicesCsv();
      triggerBlobDownload(blob, 'billing-invoices-audit.csv');
    } catch {
      setError('Could not export CSV. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/settings/payment-plan" className="text-gray-500 hover:text-gray-800">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-2">
              <FileText className="text-emerald-600" />
              <h1 className="text-2xl font-black text-gray-900">Invoice history</h1>
            </div>
          </div>
          {invoices.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-emerald-200 text-emerald-800 text-sm font-bold hover:bg-emerald-50 disabled:opacity-50 shadow-sm"
            >
              {exportingCsv ? (
                <Loader className="animate-spin" size={16} />
              ) : (
                <FileSpreadsheet size={16} />
              )}
              Export all (CSV)
            </button>
          )}
        </div>

        <p className="text-sm text-gray-600 -mt-2">
          Download PDF receipts include transaction IDs, Razorpay references, plan snapshot, usage, and
          timestamps for audit and accounting.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader className="animate-spin text-emerald-600" size={32} />
          </div>
        ) : invoices.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-100">
            No invoices yet. Paid bills and closed monthly invoices appear here after payment or month-end billing.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3">Invoice</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Period</th>
                  <th className="text-left px-4 py-3">Due</th>
                  <th className="text-left px-4 py-3">Paid on</th>
                  <th className="text-left px-4 py-3">Transaction</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv) => {
                  const txn = inv.payment_id || inv.paymentId;
                  const isPaid =
                    inv.payment_status === 'PAID' || inv.invoice_status === 'PAID';
                  return (
                    <tr key={inv._id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {(inv.invoice_type || '—').replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3">
                        {inv.period_label || `${inv.billing_month}/${inv.billing_year}`}
                      </td>
                      <td className="px-4 py-3">{fmtDate(inv.due_date)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {inv.paid_at || inv.paidAt ? fmtDate(inv.paid_at || inv.paidAt) : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-gray-500 max-w-[140px] truncate" title={txn || ''}>
                        {txn || '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {fmt(inv.total_amount ?? inv.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${statusClass(
                            isPaid ? 'PAID' : inv.invoice_status || inv.status
                          )}`}
                        >
                          {isPaid ? 'PAID' : inv.invoice_status || inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(inv)}
                          disabled={downloadingId === inv._id}
                          title="Download audit PDF with full payment and billing details"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {downloadingId === inv._id ? (
                            <Loader className="animate-spin" size={14} />
                          ) : (
                            <Download size={14} />
                          )}
                          PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceHistory;
