import { useState } from 'react';
import { createTenant } from '../api/superApi';

const EMPTY = { storeName: '', ownerName: '', phoneNumber: '', tenantId: '' };

export default function CreateStoreModal({ onClose, onCreated }) {
  const [form, setForm]       = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [result, setResult]   = useState(null); // holds success payload

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    if (!form.storeName.trim())  return 'Store Name is required';
    if (!form.ownerName.trim())  return 'Owner Name is required';
    const phone = form.phoneNumber.trim();
    if (!phone)                  return 'Phone Number is required';
    if (!/^\d{10}$/.test(phone)) return 'Phone Number must be exactly 10 digits';
    if (form.tenantId.trim() && !/^[a-z0-9-]+$/.test(form.tenantId.trim()))
      return 'Tenant ID may only contain lowercase letters, digits and hyphens';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const data = await createTenant(form);
      setResult(data);
      onCreated(); // refresh tenant list in parent
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Create New Store</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Success state */}
        {result ? (
          <div className="px-6 py-6 space-y-4">
            <div className="flex items-center gap-2 text-green-700">
              <span className="text-2xl">✓</span>
              <span className="font-medium">Store created successfully</span>
            </div>

            <div className="bg-gray-50 rounded border border-gray-200 divide-y divide-gray-200 text-sm">
              {[
                ['Tenant ID',       result.tenantId],
                ['Customer Domain', result.customerDomain],
                ['Admin Domain',    result.adminDomain],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between px-3 py-2">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-mono text-gray-800 text-xs">{value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-full py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                {error}
              </div>
            )}

            {[
              { label: 'Store Name',          field: 'storeName',   placeholder: 'Fresh Mart',        required: true  },
              { label: 'Owner Name',          field: 'ownerName',   placeholder: 'Ramesh Kumar',       required: true  },
              { label: 'Phone Number',        field: 'phoneNumber', placeholder: '9876543210',         required: true  },
              { label: 'Tenant ID (optional)',field: 'tenantId',    placeholder: 'fresh-mart',         required: false },
            ].map(({ label, field, placeholder, required }) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {label}
                  {required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <input
                  type={field === 'phoneNumber' ? 'tel' : 'text'}
                  value={form[field]}
                  onChange={set(field)}
                  placeholder={placeholder}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {field === 'tenantId' && (
                  <p className="mt-0.5 text-xs text-gray-400">
                    Leave blank to auto-generate from store name
                  </p>
                )}
              </div>
            ))}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating…' : 'Create Store'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
