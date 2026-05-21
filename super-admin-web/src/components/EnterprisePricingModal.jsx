import { useEffect, useState } from 'react';
import { fetchTenantEnterprisePlan, updateTenantEnterprisePlan } from '../api/superApi';

const empty = {
  description: '',
  price_per_order: '',
  monthly_price: '',
  included_orders: '',
  price_per_extra_order: '',
};

export default function EnterprisePricingModal({ tenant, onClose, onSaved }) {
  const [form, setForm] = useState(empty);
  const [effectiveModel, setEffectiveModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    setError('');
    fetchTenantEnterprisePlan(tenant._id)
      .then((data) => {
        setForm({
          description: data.description || '',
          price_per_order: data.price_per_order ?? '',
          monthly_price: data.monthly_price ?? '',
          included_orders: data.included_orders ?? '',
          price_per_extra_order: data.price_per_extra_order ?? '',
        });
        setEffectiveModel(data.effective_pricing_model || '');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenant]);

  if (!tenant) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await updateTenantEnterprisePlan(tenant._id, {
        description: form.description,
        price_per_order: form.price_per_order === '' ? 0 : Number(form.price_per_order),
        monthly_price: form.monthly_price === '' ? 0 : Number(form.monthly_price),
        included_orders: form.included_orders === '' ? null : Number(form.included_orders),
        price_per_extra_order:
          form.price_per_extra_order === '' ? 0 : Number(form.price_per_extra_order),
        assign_now: true,
      });
      onSaved?.(result);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Enterprise pricing</h2>
          <p className="text-sm text-gray-500 mt-1">
            {tenant.name} ({tenant.tenantId}) — rates apply only to this store.
          </p>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2 leading-relaxed">
              <strong>Per-order only:</strong> set price per order (e.g. Cust A = ₹6, Cust B = ₹7) and leave
              monthly fee and included orders empty.
              <br />
              <strong>Subscription-style:</strong> set monthly fee + included orders + extra order rate instead.
            </p>

            <label className="block text-sm">
              <span className="text-gray-600">Description (shown in store admin)</span>
              <textarea
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>

            <label className="block text-sm">
              <span className="text-gray-600 font-semibold">Price per order (₹)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="e.g. 6 for Cust A, 7 for Cust B"
                value={form.price_per_order}
                onChange={(e) => setForm((f) => ({ ...f, price_per_order: e.target.value }))}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-gray-600">Monthly fee (₹)</span>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={form.monthly_price}
                  onChange={(e) => setForm((f) => ({ ...f, monthly_price: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">Included orders / month</span>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={form.included_orders}
                  onChange={(e) => setForm((f) => ({ ...f, included_orders: e.target.value }))}
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-gray-600">Extra order charge (₹)</span>
              <input
                type="number"
                min="0"
                className="mt-1 w-full border rounded-lg px-3 py-2"
                value={form.price_per_extra_order}
                onChange={(e) => setForm((f) => ({ ...f, price_per_extra_order: e.target.value }))}
              />
            </label>

            {effectiveModel && (
              <p className="text-xs text-gray-500">
                Billing mode for this store: <strong>{effectiveModel}</strong>
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save & apply'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
