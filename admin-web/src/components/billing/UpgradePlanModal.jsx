import React from 'react';
import { CheckCircle, CreditCard, Loader, X } from 'lucide-react';

const fmt = (n) => `Rs. ${(n || 0).toLocaleString('en-IN')}`;

const UpgradePlanModal = ({
  open,
  mode,
  planName,
  planDescription,
  amount,
  onClose,
  onPayNow,
  onSchedule,
  paying,
  scheduling,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        {mode === 'success' ? (
          <>
            <div className="w-14 h-14 mx-auto mb-4 bg-green-600 rounded-full flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-white" />
            </div>
            <h3 className="font-black text-xl text-center text-gray-900 mb-2">Plan updated</h3>
            <p className="text-center text-gray-600 text-sm mb-6">
              <span className="font-bold text-green-600">{planName}</span> is now active or scheduled.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-bold"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <h3 className="font-black text-lg text-gray-900 mb-1">Switch to {planName}</h3>
            {planDescription && (
              <p className="text-sm text-gray-600 mb-3 leading-relaxed">{planDescription}</p>
            )}
            <p className="text-sm text-gray-500 mb-6">
              Upgrade takes effect next billing cycle, or pay now to activate immediately
              {amount > 0 ? ` (${fmt(amount)})` : ''}.
            </p>
            <div className="flex flex-col gap-2">
              {amount > 0 && (
                <button
                  onClick={onPayNow}
                  disabled={paying}
                  className="flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-bold disabled:opacity-50"
                >
                  <CreditCard size={16} />
                  {paying ? 'Opening payment...' : 'Pay & activate now'}
                </button>
              )}
              <button
                onClick={onSchedule}
                disabled={scheduling}
                className="py-3 rounded-xl font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {scheduling ? 'Scheduling...' : 'Apply next billing cycle'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UpgradePlanModal;
