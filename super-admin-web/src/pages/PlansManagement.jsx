import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchPaymentPlans,
  createPaymentPlan,
  updatePaymentPlan,
  disablePaymentPlan,
} from '../api/superApi';

const emptyForm = {
  plan_code: '',
  name: '',
  description: '',
  pricing_model: 'PER_ORDER',
  monthly_price: 0,
  included_orders: '',
  price_per_order: 0,
  price_per_extra_order: 0,
  is_custom_plan: false,
};

export default function PlansManagement() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchPaymentPlans();
      setPlans(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        monthly_price: Number(form.monthly_price) || 0,
        price_per_order: Number(form.price_per_order) || 0,
        price_per_extra_order: Number(form.price_per_extra_order) || 0,
        included_orders: form.included_orders === '' ? null : Number(form.included_orders),
      };
      if (editingId) {
        await updatePaymentPlan(editingId, payload);
      } else {
        await createPaymentPlan(payload);
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (plan) => {
    setEditingId(plan._id || plan.id);
    setForm({
      plan_code: plan.plan_code,
      name: plan.name,
      description: plan.description || '',
      pricing_model: plan.pricing_model,
      monthly_price: plan.monthly_price,
      included_orders: plan.included_orders ?? '',
      price_per_order: plan.price_per_order,
      price_per_extra_order: plan.price_per_extra_order,
      is_custom_plan: plan.is_custom_plan,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-slate-400 hover:text-white text-sm font-semibold">
            ← Back
          </Link>
          <h1 className="text-2xl font-black">Payment plans</h1>
        </div>

        <p className="text-slate-400 text-sm">
          Configure SaaS pricing dynamically. No code deploy required to add or change plans.
        </p>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <h2 className="md:col-span-2 font-bold">
            {editingId ? 'Edit plan' : '+ Create plan'}
          </h2>
          {[
            ['plan_code', 'Plan code', !editingId],
            ['name', 'Name', true],
            ['description', 'Description', true],
          ].map(([key, label, editable]) => (
            <label key={key} className="block text-sm">
              <span className="text-slate-400">{label}</span>
              <input
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
                value={form[key]}
                disabled={!editable && editingId}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                required={key !== 'description'}
              />
            </label>
          ))}
          <label className="block text-sm">
            <span className="text-slate-400">Pricing model</span>
            <select
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
              value={form.pricing_model}
              onChange={(e) => setForm((f) => ({ ...f, pricing_model: e.target.value }))}
            >
              <option value="PER_ORDER">PER_ORDER</option>
              <option value="SUBSCRIPTION">SUBSCRIPTION</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </select>
          </label>
          {['monthly_price', 'included_orders', 'price_per_order', 'price_per_extra_order'].map((key) => (
            <label key={key} className="block text-sm">
              <span className="text-slate-400">{key.replace(/_/g, ' ')}</span>
              <input
                type="number"
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={form.is_custom_plan}
              onChange={(e) => setForm((f) => ({ ...f, is_custom_plan: e.target.checked }))}
            />
            Custom / enterprise plan
          </label>
          <button
            type="submit"
            disabled={saving}
            className="md:col-span-2 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold disabled:opacity-50"
          >
            {saving ? 'Saving...' : editingId ? 'Update plan' : 'Create plan'}
          </button>
        </form>

        {loading ? (
          <div className="flex justify-center py-12 text-slate-400 text-sm">Loading plans…</div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left p-4">Code</th>
                  <th className="text-left p-4">Model</th>
                  <th className="text-right p-4">Monthly</th>
                  <th className="text-right p-4">Per order</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p._id} className="border-t border-slate-800">
                    <td className="p-4 font-mono">{p.plan_code}</td>
                    <td className="p-4">{p.pricing_model}</td>
                    <td className="p-4 text-right">₹{p.monthly_price}</td>
                    <td className="p-4 text-right">₹{p.price_per_order}</td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        type="button"
                        className="text-emerald-400 hover:underline"
                        onClick={() => startEdit(p)}
                      >
                        Edit
                      </button>
                      {p.is_active && (
                        <button
                          type="button"
                          className="text-red-400 hover:underline"
                          onClick={async () => {
                            await disablePaymentPlan(p._id);
                            load();
                          }}
                        >
                          Disable
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
