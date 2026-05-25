import React, { useState } from 'react';
import { useAppState } from '../../context/AppStateContext';
import { useToast } from '../../context/ToastContext';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const ReturnManagement = () => {
  const { showToast } = useToast();
  const { returns, processReturnRequest, refreshReturns, appSettings } = useAppState();
  const [listRefreshing, setListRefreshing] = useState(false);
  const [adminNotes, setAdminNotes] = useState({});
  const [refundAmounts, setRefundAmounts] = useState({});
  const [confirmState, setConfirmState] = useState(null);
  const [processing, setProcessing] = useState(false);

  if (!appSettings.allowRefunds) {
    return null;
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-100 text-emerald-700';
      case 'REJECTED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  };

  const orderTotal = (request) =>
    Number(request.orderTotal ?? request.orderId?.totalAmount ?? request.amount ?? 0);

  const orderItems = (request) => {
    const items = request.orderItems || request.orderId?.items || [];
    return Array.isArray(items) ? items : [];
  };

  const getRefundAmount = (request) => {
    const total = orderTotal(request);
    const raw = refundAmounts[request.id];
    if (raw === undefined || raw === '') return total;
    const n = Number(raw);
    return Number.isFinite(n) ? n : total;
  };

  const openApproveConfirm = (request) => {
    const note = adminNotes[request.id]?.trim();
    if (!note) {
      showToast('error', 'Please provide a resolution note for the customer.');
      return;
    }
    const amount = getRefundAmount(request);
    const total = orderTotal(request);
    if (amount <= 0 || amount > total + 0.01) {
      showToast('error', `Refund must be between ₹1 and ₹${total}`);
      return;
    }
    setConfirmState({ request, decision: 'APPROVE', amount, note });
  };

  const openRejectConfirm = (request) => {
    const note = adminNotes[request.id]?.trim();
    if (!note) {
      showToast('error', 'Please provide a reason for the customer.');
      return;
    }
    setConfirmState({ request, decision: 'REJECT', note });
  };

  const executeConfirm = async () => {
    if (!confirmState) return;
    const requestId = confirmState.request.id;
    setProcessing(true);
    try {
      await processReturnRequest(
        requestId,
        confirmState.decision,
        confirmState.note,
        confirmState.decision === 'APPROVE' ? confirmState.amount : undefined
      );
      setConfirmState(null);
      setAdminNotes((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      setRefundAmounts((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-[#1A4D2E] p-8 rounded-[32px] text-white flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic">RETURN & REFUND REQUESTS</h1>
          <p className="opacity-70">
            Review customer photos and reason. Approve to refund to their original payment method (online orders).
          </p>
        </div>
        <button
          type="button"
          disabled={listRefreshing}
          onClick={async () => {
            setListRefreshing(true);
            try {
              await refreshReturns();
            } finally {
              setListRefreshing(false);
            }
          }}
          className="px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-bold disabled:opacity-50"
        >
          {listRefreshing ? 'Refreshing…' : 'Refresh list'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {returns.length === 0 && (
          <p className="text-slate-500 font-semibold text-center py-12">No return requests yet.</p>
        )}
        {returns.map((request) => (
          <div
            key={request.id}
            className="bg-white border rounded-[24px] p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="w-full lg:w-48 h-48 rounded-2xl overflow-hidden bg-gray-100 border shrink-0">
                {request.evidence ? (
                  <a href={request.evidence} target="_blank" rel="noreferrer">
                    <img
                      key={`${request.id}-${request.status}-${request.evidence}`}
                      src={request.evidence}
                      alt="Return evidence"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </a>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                    No image
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">
                      Order #{String(request.orderId).slice(-8)}
                    </h3>
                    <p className="text-sm text-slate-500 font-bold">
                      {request.customerName} • {new Date(request.date).toLocaleDateString('en-IN')}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Payment: {request.paymentMode || '—'} • Order total: ₹{orderTotal(request)}
                    </p>
                  </div>
                  <span
                    className={`px-4 py-1 rounded-full text-xs font-black shrink-0 ${getStatusColor(request.status)}`}
                  >
                    {request.status}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-black text-slate-400 mb-2">Products</p>
                  <ul className="text-sm text-slate-700 space-y-1">
                    {orderItems(request).map((item, idx) => (
                      <li key={idx}>
                        • {item.name} × {item.qty ?? item.quantity ?? 1}{' '}
                        {item.unit ? `(${item.unit})` : ''}
                      </li>
                    ))}
                    {orderItems(request).length === 0 && (
                      <li className="text-slate-400 italic">No line items loaded</li>
                    )}
                  </ul>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-[10px] uppercase font-black text-slate-400">Customer reason</p>
                    <p className="text-sm font-bold text-slate-700">{request.reason}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-[10px] uppercase font-black text-slate-400">Order total</p>
                    <p className="text-sm font-bold text-slate-700">₹{orderTotal(request)}</p>
                  </div>
                </div>

                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                  <p className="text-[10px] uppercase font-black text-amber-600 mb-1">Customer comment</p>
                  <p className="text-sm text-slate-600 italic">
                    &quot;{request.comment || '—'}&quot;
                  </p>
                </div>

                {request.status === 'PENDING' ? (
                  <div className="pt-2 space-y-3">
                    <div>
                      <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">
                        Refund amount (₹) — default full order
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={orderTotal(request)}
                        step="0.01"
                        placeholder={String(orderTotal(request))}
                        className="w-full max-w-xs p-3 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-[#1A4D2E]"
                        value={refundAmounts[request.id] ?? ''}
                        onChange={(e) =>
                          setRefundAmounts({ ...refundAmounts, [request.id]: e.target.value })
                        }
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Leave empty to refund full ₹{orderTotal(request)}. Reduce for partial damage.
                      </p>
                    </div>
                    <textarea
                      placeholder="Resolution note for customer (required)..."
                      className="w-full p-3 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-[#1A4D2E]"
                      value={adminNotes[request.id] || ''}
                      onChange={(e) =>
                        setAdminNotes({ ...adminNotes, [request.id]: e.target.value })
                      }
                    />
                  </div>
                ) : (
                  request.adminComment && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
                      <p className="text-[10px] uppercase font-black text-slate-400 mb-1">
                        Your resolution note
                      </p>
                      <p className="text-sm text-slate-600 font-bold">
                        &quot;{request.adminComment}&quot;
                      </p>
                      {request.status === 'APPROVED' && (
                        <p className="text-xs text-emerald-700 font-bold mt-2">
                          Refunded: ₹{request.amount}
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>

              {request.status === 'PENDING' && (
                <div className="flex flex-row lg:flex-col gap-2 justify-center shrink-0">
                  <button
                    type="button"
                    onClick={() => openApproveConfirm(request)}
                    className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700"
                  >
                    <CheckCircle size={18} /> Approve refund
                  </button>
                  <button
                    type="button"
                    onClick={() => openRejectConfirm(request)}
                    className="flex-1 bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100"
                  >
                    <XCircle size={18} /> Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">
              {confirmState.decision === 'APPROVE'
                ? 'Confirm refund to customer'
                : 'Confirm rejection'}
            </h3>
            {confirmState.decision === 'APPROVE' ? (
              <div className="text-sm text-slate-600 space-y-3 mb-6 leading-relaxed">
                <p>
                  You are about to refund{' '}
                  <strong className="text-emerald-700">₹{confirmState.amount}</strong> for this return.
                  Online payments go back to the customer&apos;s original UPI/card/bank account via Razorpay.
                </p>
                <p>
                  <strong>Reason:</strong> {confirmState.request.reason}
                </p>
                <p>
                  <strong>Products:</strong>{' '}
                  {orderItems(confirmState.request)
                    .map((i) => i.name)
                    .join(', ') || '—'}
                </p>
                <p className="text-xs text-slate-500 italic border-t pt-3">
                  Admin note: &quot;{confirmState.note}&quot;
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-600 mb-6">
                Customer will see your note. No money will be refunded.
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                disabled={processing}
                className="flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirm}
                disabled={processing}
                className={`flex-1 py-3 rounded-xl font-bold text-white ${
                  confirmState.decision === 'APPROVE' ? 'bg-emerald-600' : 'bg-red-500'
                }`}
              >
                {processing ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnManagement;
