import React, { useState } from 'react';
import { useAppState } from '../../context/AppStateContext';
import { useToast } from '../../context/ToastContext';
import { CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react';

const ReturnManagement = () => {
  const { showToast } = useToast();
  const { returns, processReturnRequest, appSettings } = useAppState(); // Added appSettings here
  const [adminNotes, setAdminNotes] = useState({});

  // GUARD: If disabled in backend/context, hide the entire page content
  if (!appSettings.allowRefunds) {
    return null; 
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      default: return 'bg-amber-100 text-amber-700';
    }
  };

  const handleAction = (id, decision) => {
    if (!adminNotes[id]?.trim()) {
      showToast('error', 'Please provide a reason for the customer.');
      return;
    }
    processReturnRequest(id, decision, adminNotes[id]);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-[#1A4D2E] p-8 rounded-[32px] text-white">
        <h1 className="text-3xl font-black italic">RETURN & REFUND REQUESTS</h1>
        <p className="opacity-70">Review evidence and comments submitted by customers</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {returns.map((request) => (
          <div key={request.id} className="bg-white border rounded-[24px] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="w-full lg:w-48 h-48 rounded-2xl overflow-hidden bg-gray-100 border">
                <img src={request.evidence} alt="Evidence" className="w-full h-full object-cover" />
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Order #{request.orderId}</h3>
                    <p className="text-sm text-slate-500 font-bold">{request.customerName} • {new Date(request.date).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-4 py-1 rounded-full text-xs font-black ${getStatusColor(request.status)}`}>
                    {request.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-[10px] uppercase font-black text-slate-400">Reason</p>
                    <p className="text-sm font-bold text-slate-700">{request.reason}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-[10px] uppercase font-black text-slate-400">Amount to Refund</p>
                    <p className="text-sm font-bold text-emerald-700">₹{request.amount}</p>
                  </div>
                </div>

                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                  <p className="text-[10px] uppercase font-black text-amber-600 mb-1">Customer Comment</p>
                  <p className="text-sm text-slate-600 italic">"{request.comment}"</p>
                </div>

                {request.status === 'PENDING' ? (
                  <div className="pt-2">
                    <textarea
                      placeholder="Enter resolution note for customer..."
                      className="w-full p-3 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-[#1A4D2E]"
                      value={adminNotes[request.id] || ''}
                      onChange={(e) => setAdminNotes({...adminNotes, [request.id]: e.target.value})}
                    />
                  </div>
                ) : (
                   request.adminComment && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
                      <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Your Resolution Note</p>
                      <p className="text-sm text-slate-600 font-bold">"{request.adminComment}"</p>
                    </div>
                   )
                )}
              </div>

              {request.status === 'PENDING' && (
                <div className="flex flex-row lg:flex-col gap-2 justify-center">
                  <button 
                    onClick={() => handleAction(request.id, 'APPROVE')}
                    className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700"
                  >
                    <CheckCircle size={18} /> Approve
                  </button>
                  <button 
                    onClick={() => handleAction(request.id, 'REJECT')}
                    className="flex-1 bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-100"
                  >
                    <XCircle size={18} /> Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReturnManagement;