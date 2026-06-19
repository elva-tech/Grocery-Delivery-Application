import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTenants, updateTenantPlan, updateTenantStatus, fetchBillingOverview, markTenantInvoicePaid } from '../api/superApi';
import EditStoreModal from '../components/EditStoreModal';
import EnterprisePricingModal from '../components/EnterprisePricingModal';

const PLANS    = ['FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE'];
const STATUSES = ['ACTIVE', 'SUSPENDED', 'INACTIVE'];

const STATUS_BADGE = {
  ACTIVE:    'bg-green-100 text-green-700',
  SUSPENDED: 'bg-yellow-100 text-yellow-700',
  INACTIVE:  'bg-gray-100 text-gray-500',
};

const PLAN_BADGE = {
  FREE:       'bg-slate-100 text-slate-600',
  BASIC:      'bg-blue-100 text-blue-700',
  PREMIUM:    'bg-purple-100 text-purple-700',
  ENTERPRISE: 'bg-indigo-100 text-indigo-700',
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [tenants, setTenants]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [editingTenant, setEditingTenant] = useState(null);
  const [enterpriseTenant, setEnterpriseTenant] = useState(null);
  const [enterpriseRates, setEnterpriseRates] = useState({});
  const [successMsg, setSuccessMsg]       = useState('');

  // per-row editing state
  const [selectedPlans,    setSelectedPlans]    = useState({});
  const [planSaving,       setPlanSaving]       = useState({});
  const [statusSaving,     setStatusSaving]     = useState({});
  const [rowError,         setRowError]         = useState({});

  // billing
  const [revenueDays,   setRevenueDays]   = useState(30);
  const [billingMap,    setBillingMap]    = useState({}); // tenantId → { invoice, revenue }
  const [billingLoading, setBillingLoading] = useState(false);
  const [markingPaid,   setMarkingPaid]   = useState({}); // tenantId → bool

  // QR preview modal
  const [qrPreview, setQrPreview] = useState(null); // tenant object or null

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTenants();
      setTenants(data);
      // seed selected plans with current values
      const initial = {};
      data.forEach((t) => { initial[t._id] = t.plan; });
      setSelectedPlans(initial);
    } catch (err) {
      if (err.message.includes('401') || err.message.toLowerCase().includes('token')) {
        handleLogout();
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadBilling = async (days) => {
    setBillingLoading(true);
    try {
      const data = await fetchBillingOverview(days);
      const map = {};
      data.forEach((row) => { map[row.tenantId] = row; });
      setBillingMap(map);
    } catch {
      // non-fatal — billing overlay just shows empty
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadBilling(revenueDays); }, [revenueDays]);

  const handleLogout = () => {
    localStorage.removeItem('super_admin_token');
    navigate('/login');
  };

  const handlePlanChange = async (tenant) => {
    const id   = tenant._id;
    const plan = selectedPlans[id];
    if (plan === tenant.plan) return;

    if (plan === 'ENTERPRISE') {
      setEnterpriseTenant(tenant);
      return;
    }

    setPlanSaving((s) => ({ ...s, [id]: true }));
    setRowError((e) => ({ ...e, [id]: '' }));
    try {
      const updated = await updateTenantPlan(id, plan);
      setTenants((ts) => ts.map((t) => (t._id === id ? { ...t, plan: updated.plan } : t)));
    } catch (err) {
      setRowError((e) => ({ ...e, [id]: err.message }));
    } finally {
      setPlanSaving((s) => ({ ...s, [id]: false }));
    }
  };

  const handleEnterpriseSaved = (result) => {
    const tenant = enterpriseTenant;
    if (!tenant) return;
    setTenants((ts) =>
      ts.map((t) => (t._id === tenant._id ? { ...t, plan: 'ENTERPRISE' } : t))
    );
    setSelectedPlans((s) => ({ ...s, [tenant._id]: 'ENTERPRISE' }));
    if (result?.plan) {
      const p = result.plan;
      const summary =
        Number(p.price_per_order) > 0
          ? `₹${p.price_per_order}/order`
          : Number(p.monthly_price) > 0
            ? `₹${p.monthly_price}/mo`
            : 'configured';
      setEnterpriseRates((r) => ({ ...r, [tenant.tenantId]: summary }));
    }
    setSuccessMsg(`Enterprise pricing saved for ${tenant.name}`);
    setEnterpriseTenant(null);
  };

  const handleStatusToggle = async (tenant) => {
    const id     = tenant._id;
    const next   = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';

    setStatusSaving((s) => ({ ...s, [id]: true }));
    setRowError((e) => ({ ...e, [id]: '' }));
    try {
      const updated = await updateTenantStatus(id, next);
      setTenants((ts) =>
        ts.map((t) => (t._id === id ? { ...t, status: updated.status, isActive: updated.isActive } : t))
      );
    } catch (err) {
      setRowError((e) => ({ ...e, [id]: err.message }));
    } finally {
      setStatusSaving((s) => ({ ...s, [id]: false }));
    }
  };

  const handleMarkPaid = async (tenant) => {
    const id = tenant._id;
    setMarkingPaid((s) => ({ ...s, [tenant.tenantId]: true }));
    setRowError((e) => ({ ...e, [id]: '' }));
    try {
      const invBefore = billingMap[tenant.tenantId]?.invoice;
      const paidInvoice = await markTenantInvoicePaid(id, invBefore?._id);
      const normalized = paidInvoice
        ? {
            ...paidInvoice,
            status: 'PAID',
            invoice_status: 'PAID',
            payment_status: 'PAID',
            totalAmount: paidInvoice.totalAmount ?? paidInvoice.total_amount ?? 0,
          }
        : null;
      setBillingMap((prev) => ({
        ...prev,
        [tenant.tenantId]: {
          tenantId: tenant.tenantId,
          invoice: normalized,
          revenue:
            (prev[tenant.tenantId]?.revenue || 0) +
            (normalized?.totalAmount || 0),
        },
      }));
      await loadBilling(revenueDays);
      setSuccessMsg(`Invoice for "${tenant.name}" marked as paid`);
    } catch (err) {
      setRowError((e) => ({ ...e, [id]: err.message }));
    } finally {
      setMarkingPaid((s) => ({ ...s, [tenant.tenantId]: false }));
    }
  };

  const fmt = (iso) =>
    iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Enandi Super Admin</h1>
          <p className="text-xs text-gray-400">Tenant Management</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/plans')}
            className="text-sm bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded transition-colors"
          >
            Payment plans
          </button>
          <button
            type="button"
            onClick={() => {
              setSuccessMsg('');
              navigate('/create-store');
            }}
            className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded transition-colors"
          >
            + Create Store
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="px-6 py-6">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total Stores',   value: tenants.length, prefix: '' },
            { label: 'Active',         value: tenants.filter((t) => t.status === 'ACTIVE').length, prefix: '' },
            { label: 'Suspended',      value: tenants.filter((t) => t.status === 'SUSPENDED').length, prefix: '' },
            { label: 'Premium+',       value: tenants.filter((t) => ['PREMIUM', 'ENTERPRISE'].includes(t.plan)).length, prefix: '' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-gray-800">{loading ? '—' : s.value}</p>
            </div>
          ))}
          {/* Total Subscription Revenue card — sums paid invoices across all tenants */}
          <div className="bg-white rounded-lg border border-indigo-200 px-4 py-3">
            <p className="text-xs text-gray-500">
              Subscription Revenue {revenueDays === 0 ? '(All time)' : `(${revenueDays}d)`}
            </p>
            <p className="text-2xl font-bold text-indigo-700">
              {billingLoading
                ? '…'
                : `₹${Object.values(billingMap)
                    .reduce((sum, row) => sum + (row.revenue || 0), 0)
                    .toLocaleString('en-IN')}`}
            </p>
          </div>
        </div>        {/* Success banner */}
        {successMsg && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm flex justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-green-500 hover:text-green-700">&times;</button>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={load} className="underline ml-4">Retry</button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-gray-700">All Tenants</h2>
            <div className="flex items-center gap-3">
              {/* Revenue days filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Revenue:</span>
                {[7, 30, 90, 0].map((d) => (
                  <button
                    key={d}
                    onClick={() => setRevenueDays(d)}
                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                      revenueDays === d
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {d === 0 ? 'All' : `${d}d`}
                  </button>
                ))}
                {billingLoading && <span className="text-xs text-gray-400 ml-1">loading…</span>}
              </div>
              <button
                onClick={() => { load(); loadBilling(revenueDays); }}
                disabled={loading}
                className="text-xs text-indigo-600 hover:underline disabled:opacity-40"
              >
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              Loading tenants…
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              No tenants found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Store Name</th>
                    <th className="px-4 py-3 text-left">Tenant ID</th>
                    <th className="px-4 py-3 text-left">Owner</th>
                    <th className="px-4 py-3 text-left">Plan</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3 text-left">Store Code</th>
                    <th className="px-4 py-3 text-left">Deep Link / QR</th>
                    <th className="px-4 py-3 text-right">Sub. Revenue ({revenueDays === 0 ? 'All' : `${revenueDays}d`})</th>
                    <th className="px-4 py-3 text-right">Current Bill</th>
                    <th className="px-4 py-3 text-left">Payment</th>
                    <th className="px-4 py-3 text-left">Change Plan</th>
                    <th className="px-4 py-3 text-left">Toggle Status</th>
                    <th className="px-4 py-3 text-left">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tenants.map((tenant) => (
                    <tr key={tenant._id} className="hover:bg-gray-50 transition-colors">
                      {/* Store Name */}
                      <td className="px-4 py-3 font-medium text-gray-800">{tenant.name}</td>

                      {/* Tenant ID */}
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{tenant.tenantId}</td>

                      {/* Owner */}
                      <td className="px-4 py-3 text-gray-600">
                        <div>{tenant.ownerName || '—'}</div>
                        {tenant.phoneNumber && (
                          <div className="text-xs text-gray-400">{tenant.phoneNumber}</div>
                        )}
                      </td>

                      {/* Plan badge */}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLAN_BADGE[tenant.plan] || 'bg-gray-100 text-gray-600'}`}>
                          {tenant.plan}
                        </span>
                        {tenant.plan === 'ENTERPRISE' && enterpriseRates[tenant.tenantId] && (
                          <span className="text-[10px] text-indigo-600 block mt-0.5">
                            {enterpriseRates[tenant.tenantId]}
                          </span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[tenant.status] || 'bg-gray-100 text-gray-600'}`}>
                          {tenant.status}
                        </span>
                      </td>

                      {/* Created date */}
                      <td className="px-4 py-3 text-gray-500 text-xs">{fmt(tenant.createdAt)}</td>

                      {/* Store Code */}
                      <td className="px-4 py-3">
                        {tenant.storeCode ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm font-bold text-indigo-700 tracking-widest bg-indigo-50 px-2 py-0.5 rounded">
                              {tenant.storeCode}
                            </span>
                            <button
                              title="Copy store code"
                              onClick={() => navigator.clipboard.writeText(tenant.storeCode)}
                              className="text-gray-400 hover:text-indigo-600 transition-colors text-xs"
                            >
                              ⎘
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Deep Link + QR */}
                      <td className="px-4 py-3">
                        {tenant.deepLink ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-200 max-w-[140px] truncate" title={tenant.deepLink}>
                              {tenant.deepLink}
                            </span>
                            <button
                              title="Copy deep link"
                              onClick={() => navigator.clipboard.writeText(tenant.deepLink)}
                              className="text-gray-400 hover:text-indigo-600 transition-colors text-xs flex-shrink-0"
                            >
                              ⎘
                            </button>
                            {tenant.qrCode && (
                              <button
                                title="Preview QR code"
                                onClick={() => setQrPreview(tenant)}
                                className="text-gray-400 hover:text-indigo-600 transition-colors text-xs flex-shrink-0"
                              >
                                🔲
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Revenue */}
                      <td className="px-4 py-3 text-right text-gray-700 text-xs font-medium">
                        {billingMap[tenant.tenantId]
                          ? `₹${(billingMap[tenant.tenantId].revenue || 0).toLocaleString('en-IN')}`
                          : '—'}
                      </td>

                      {/* Current Bill */}
                      <td className="px-4 py-3 text-right text-gray-700 text-xs font-semibold">
                        {billingMap[tenant.tenantId]?.invoice
                          ? `₹${(billingMap[tenant.tenantId].invoice.totalAmount ?? billingMap[tenant.tenantId].invoice.total_amount ?? 0).toLocaleString('en-IN')}`
                          : '—'}
                      </td>

                      {/* Payment status + Mark Paid */}
                      <td className="px-4 py-3 min-w-[200px]">
                        {(() => {
                          const inv = billingMap[tenant.tenantId]?.invoice;
                          if (!inv) {
                            return (
                              <span className="text-xs text-gray-400" title="No billing invoice for this store yet">
                                No invoice
                              </span>
                            );
                          }
                          const isPaid =
                            inv.status === 'PAID' ||
                            inv.payment_status === 'PAID' ||
                            inv.invoice_status === 'PAID';
                          const statusLabel = isPaid
                            ? 'PAID'
                            : inv.invoice_status || inv.status || 'PENDING';
                          const amount = Number(inv.totalAmount ?? inv.total_amount ?? 0);
                          const canMarkPaid = !isPaid;
                          const period =
                            inv.period_label ||
                            (inv.billing_month && inv.billing_year
                              ? `${String(inv.billing_month).padStart(2, '0')}/${inv.billing_year}`
                              : '—');
                          const dueStr = inv.due_date ? fmt(inv.due_date) : '—';
                          return (
                            <div className="flex flex-col gap-1.5 text-xs">
                              <div className="text-gray-500 font-mono truncate max-w-[180px]" title={inv.invoice_number}>
                                {inv.invoice_number || '—'}
                              </div>
                              <div className="text-gray-600">
                                Period: <span className="font-semibold text-gray-800">{period}</span>
                                {inv.is_current_cycle ? ' · current' : ' · closed'}
                              </div>
                              <div className="text-gray-600">
                                Due: <span className="font-medium">{dueStr}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    isPaid
                                      ? 'bg-green-100 text-green-700'
                                      : statusLabel === 'OVERDUE'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-orange-100 text-orange-700'
                                  }`}
                                >
                                  {statusLabel}
                                </span>
                                <span className="font-bold text-gray-900">
                                  ₹{amount.toLocaleString('en-IN')}
                                </span>
                              </div>
                              {canMarkPaid && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkPaid(tenant)}
                                  disabled={markingPaid[tenant.tenantId]}
                                  className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors w-fit font-semibold"
                                >
                                  {markingPaid[tenant.tenantId]
                                    ? 'Saving…'
                                    : amount > 0
                                      ? 'Mark Paid'
                                      : 'Waive (₹0)'}
                                </button>
                              )}
                              {isPaid && inv.paidAt && (
                                <span className="text-[10px] text-green-700">Paid {fmt(inv.paidAt)}</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Change plan */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedPlans[tenant._id] || tenant.plan}
                            onChange={(e) =>
                              setSelectedPlans((s) => ({ ...s, [tenant._id]: e.target.value }))
                            }
                            className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          >
                            {PLANS.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handlePlanChange(tenant)}
                            disabled={
                              planSaving[tenant._id] ||
                              selectedPlans[tenant._id] === tenant.plan
                            }
                            className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                          >
                            {planSaving[tenant._id] ? '…' : 'Save'}
                          </button>
                          {(tenant.plan === 'ENTERPRISE' ||
                            selectedPlans[tenant._id] === 'ENTERPRISE') && (
                            <button
                              type="button"
                              onClick={() => setEnterpriseTenant(tenant)}
                              className="px-2 py-1 text-xs border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-50"
                            >
                              Rates
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Toggle status */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleStatusToggle(tenant)}
                          disabled={statusSaving[tenant._id]}
                          className={`px-3 py-1 text-xs rounded font-medium transition-colors disabled:opacity-40 ${
                            tenant.status === 'ACTIVE'
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {statusSaving[tenant._id]
                            ? '…'
                            : tenant.status === 'ACTIVE'
                            ? 'Suspend'
                            : 'Activate'}
                        </button>
                      </td>

                      {/* Edit */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setEditingTenant(tenant)}
                          className="px-3 py-1 text-xs rounded font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Row-level errors */}
              {tenants.some((t) => rowError[t._id]) && (
                <div className="px-4 py-3 border-t border-gray-100 space-y-1">
                  {tenants
                    .filter((t) => rowError[t._id])
                    .map((t) => (
                      <p key={t._id} className="text-xs text-red-600">
                        {t.name}: {rowError[t._id]}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {editingTenant && (
        <EditStoreModal
          tenant={editingTenant}
          onClose={() => setEditingTenant(null)}
          onUpdated={(updated) => {
            setTenants((ts) => ts.map((t) => (t._id === updated._id ? { ...t, ...updated } : t)));
            setSuccessMsg(`Store "${updated.name}" updated successfully`);
            setEditingTenant(null);
          }}
        />
      )}

      {enterpriseTenant && (
        <EnterprisePricingModal
          tenant={enterpriseTenant}
          onClose={() => setEnterpriseTenant(null)}
          onSaved={handleEnterpriseSaved}
        />
      )}

      {/* QR Code Preview Modal */}
      {qrPreview && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setQrPreview(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-72 flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-gray-800">{qrPreview.name}</h3>
            <img
              src={qrPreview.qrCode}
              alt={`QR for ${qrPreview.name}`}
              className="w-48 h-48"
            />
            <p className="font-mono text-xs text-gray-500 text-center break-all">{qrPreview.deepLink}</p>
            <div className="flex gap-2 w-full">
              <button
                onClick={() => navigator.clipboard.writeText(qrPreview.deepLink)}
                className="flex-1 text-xs py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Copy Link
              </button>
              <a
                href={qrPreview.qrCode}
                download={`${qrPreview.tenantId}-qr.png`}
                className="flex-1 text-xs py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-center"
              >
                Download QR
              </a>
            </div>
            <button
              onClick={() => setQrPreview(null)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
