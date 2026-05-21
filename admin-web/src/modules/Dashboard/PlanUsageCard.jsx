import React from 'react';
import { CreditCard, Zap, Package, TrendingUp, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

const PlanUsageCard = ({ subscription, usage, invoice, prepaidInvoice, loading, error, onChangePlan }) => {
  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 animate-pulse">
        <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
        <div className="h-4 w-48 bg-gray-100 rounded mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-gray-100 rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-white rounded-[32px] border border-red-100 shadow-sm p-8 flex items-center gap-3">
        <AlertCircle className="text-red-400 shrink-0" size={20} />
        <p className="text-red-600 font-semibold text-sm">{error}</p>
      </div>
    );
  }

  if (!subscription) return null;

  const plan = subscription.planId || {};
  const pricingModel =
    subscription.effective_pricing_model ||
    plan.effective_pricing_model ||
    plan.pricing_model ||
    plan.pricingType;
  const isSubscription = pricingModel === 'SUBSCRIPTION';
  const isPerOrder = pricingModel === 'PER_ORDER';
  const prepaidPaid =
    prepaidInvoice?.payment_status === 'PAID' || prepaidInvoice?.invoice_status === 'PAID';
  const prepaidDue = Number(prepaidInvoice?.totalAmount ?? prepaidInvoice?.total_amount ?? 0);
  const ordersCount   = usage?.orders_used ?? usage?.ordersCount ?? 0;
  const extraOrders   = usage?.extra_orders ?? usage?.extraOrders ?? 0;
  const includedOrders = plan.included_orders ?? plan.includedOrders ?? 0;
  const currentBill   = invoice?.totalAmount ?? invoice?.total_amount ?? 0;
  const extraCharges  = invoice?.extraCharges ?? invoice?.extra_charges ?? 0;
  const perOrderCharges = invoice?.perOrderCharges ?? invoice?.per_order_charges ?? 0;
  const invoiceStatus = invoice?.invoice_status || invoice?.status;
  const dueDate = invoice?.due_date
    ? new Date(invoice.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  // Progress bar for SUBSCRIPTION plans
  const pct = isSubscription && includedOrders > 0
    ? Math.min((ordersCount / includedOrders) * 100, 100)
    : null;

  const progressColor =
    pct === null ? 'bg-emerald-500' :
    pct >= 100   ? 'bg-red-500' :
    pct >= 80    ? 'bg-amber-500' :
    'bg-emerald-500';

  const dateOpts = { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' };
  const cycleStart = subscription.billingCycleStart
    ? new Date(subscription.billingCycleStart).toLocaleDateString('en-IN', dateOpts)
    : '—';
  const cycleEnd = subscription.billingCycleEnd
    ? new Date(subscription.billingCycleEnd).toLocaleDateString('en-IN', dateOpts)
    : '—';

  const nextPlan = subscription.nextPlanId;

  return (
    <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 space-y-6">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={18} className="text-emerald-600" />
            <h3 className="font-bold text-slate-800">Plan &amp; Usage</h3>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Billing Cycle: {cycleStart} – {cycleEnd}
          </p>
          {(plan.description || subscription?.plan_snapshot?.description) && (
            <p className="text-sm text-slate-600 mt-2 max-w-md leading-relaxed">
              {plan.description || subscription?.plan_snapshot?.description}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
            isSubscription ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {plan.name || '—'}
          </span>
          {nextPlan && (
            <span className="text-[9px] font-semibold text-amber-600 uppercase tracking-wider">
              → {nextPlan.name} next cycle
            </span>
          )}
        </div>
      </div>

      {/* ── Key Metrics ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Monthly Fee</p>
          <p className="text-lg font-black text-slate-800">
            {isSubscription ? fmt(plan.monthly_price ?? plan.monthlyPrice) : isPerOrder ? 'Pay per order' : 'Free'}
          </p>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Orders This Cycle</p>
          <p className="text-lg font-black text-slate-800">
            {ordersCount}
            {isSubscription && includedOrders > 0 && (
              <span className="text-sm font-semibold text-gray-400"> / {includedOrders}</span>
            )}
          </p>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">
            {isSubscription ? 'Extra Orders' : 'Order Charges'}
          </p>
          <p className={`text-lg font-black ${extraOrders > 0 ? 'text-red-500' : 'text-slate-800'}`}>
            {isSubscription ? extraOrders : fmt(perOrderCharges)}
          </p>
        </div>

        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">
            {isSubscription ? 'Extra usage bill' : 'Current Bill'}
          </p>
          <p className="text-lg font-black text-emerald-700">{fmt(currentBill)}</p>
        </div>

      </div>

      {/* ── Subscription usage progress bar ──────────────────── */}
      {isSubscription && includedOrders > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            <span>Included Orders Used</span>
            <span className={pct >= 100 ? 'text-red-500' : pct >= 80 ? 'text-amber-500' : 'text-emerald-600'}>
              {ordersCount} / {includedOrders}
            </span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${progressColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct >= 80 && (
            <p className={`text-[10px] font-bold ${pct >= 100 ? 'text-red-500' : 'text-amber-500'}`}>
              {pct >= 100
                ? `⚠ Over limit — extra orders charged at ${fmt(plan.pricePerExtraOrder)} each`
                : `⚡ Approaching limit — ${includedOrders - ordersCount} orders remaining`}
            </p>
          )}
        </div>
      )}

      {isSubscription && prepaidInvoice && (
        <div className="text-sm border-t border-gray-50 pt-4 flex items-center gap-2">
          <CheckCircle2 size={14} className={prepaidPaid ? 'text-emerald-600' : 'text-amber-500'} />
          <span className="text-slate-600">
            Monthly fee (prepaid):{' '}
            <span className="font-bold">{prepaidPaid ? `Paid ${fmt(prepaidDue)}` : `Due ${fmt(prepaidDue)}`}</span>
            {' · '}Extra orders billed at month-end
          </span>
        </div>
      )}

      {/* ── Due date & invoice status ───────────────────────── */}
      {(dueDate || invoiceStatus) && (
        <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wider border-t border-gray-50 pt-4">
          {dueDate && (
            <span className="text-gray-500">
              Due: <span className="text-slate-800">{dueDate}</span>
            </span>
          )}
          {invoiceStatus && (
            <span
              className={`px-2 py-0.5 rounded-full ${
                invoiceStatus === 'PAID'
                  ? 'bg-emerald-100 text-emerald-700'
                  : invoiceStatus === 'OVERDUE'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              {invoiceStatus}
            </span>
          )}
        </div>
      )}

      {/* ── PER_ORDER plan breakdown ─────────────────────────── */}
      {isPerOrder && (plan.price_per_order ?? plan.pricePerOrder) > 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-600 border-t border-gray-50 pt-4">
          <Zap size={14} className="text-blue-500 shrink-0" />
          <span>
            Charged at <span className="font-bold">{fmt(plan.price_per_order ?? plan.pricePerOrder)}</span> per order
            &nbsp;·&nbsp;
            <span className="font-bold">{ordersCount}</span> orders this cycle
          </span>
        </div>
      )}

      {/* ── Extra charges breakdown (SUBSCRIPTION) ───────────── */}
      {isSubscription && extraOrders > 0 && (
        <div className="flex items-center gap-2 text-sm border-t border-gray-50 pt-4">
          <TrendingUp size={14} className="text-red-500 shrink-0" />
          <span className="text-slate-600">
            <span className="font-bold text-red-500">{extraOrders}</span> extra orders ×{' '}
            {fmt(plan.price_per_extra_order ?? plan.pricePerExtraOrder)} = <span className="font-bold">{fmt(extraCharges)}</span>
          </span>
        </div>
      )}

      {/* ── Footer: billing cycle info + upgrade CTA ─────────── */}
      <div className="flex items-center justify-between border-t border-gray-50 pt-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          <Calendar size={12} />
          <span>Resets {cycleEnd}</span>
        </div>

        {onChangePlan && (
          <button
            onClick={onChangePlan}
            className="text-[10px] font-black uppercase tracking-wider text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            Upgrade Plan →
          </button>
        )}
      </div>

    </div>
  );
};

export default PlanUsageCard;
