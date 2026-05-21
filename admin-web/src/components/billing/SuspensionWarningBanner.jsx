import React from 'react';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

const SuspensionWarningBanner = ({ invoice, subscription }) => {
  if (!invoice) return null;

  const status = invoice.invoice_status || invoice.status;
  const paymentStatus = invoice.payment_status;
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
  const now = new Date();
  const daysUntilDue = dueDate
    ? Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24))
    : null;

  let message = null;
  let tone = 'amber';

  if (status === 'OVERDUE' || paymentStatus === 'UNPAID' && daysUntilDue !== null && daysUntilDue < 0) {
    message = 'Payment is overdue. Your store may be suspended if not paid immediately.';
    tone = 'red';
  } else if (daysUntilDue === 3) {
    message = 'Your invoice is due in 3 days.';
  } else if (daysUntilDue === 1) {
    message = 'Your invoice is due tomorrow.';
    tone = 'orange';
  } else if (subscription?.subscription_status === 'SUSPENDED') {
    message = 'Account suspended due to billing. Pay your invoice to restore access.';
    tone = 'red';
  }

  if (!message) return null;

  const styles =
    tone === 'red'
      ? 'bg-red-50 border-red-200 text-red-800'
      : tone === 'orange'
        ? 'bg-orange-50 border-orange-200 text-orange-800'
        : 'bg-amber-50 border-amber-200 text-amber-800';

  return (
    <div className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${styles}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle size={18} className="shrink-0" />
        <span>{message}</span>
      </div>
      <Link
        to="/settings/payment-plan"
        className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider hover:underline"
      >
        <CreditCard size={14} />
        Manage billing
      </Link>
    </div>
  );
};

export default SuspensionWarningBanner;
