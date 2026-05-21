import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IndianRupee, Layers, CheckCircle, Sparkles, TrendingUp, AlertCircle, Loader, Calendar, CreditCard, FileText } from "lucide-react";
import { apiService } from "../../services/apiService";
import { useTenantBranding } from "../../context/TenantBrandingContext";
import SuspensionWarningBanner from "../../components/billing/SuspensionWarningBanner";
import BillingNotificationsPanel from "../../components/billing/BillingNotificationsPanel";
import UpgradePlanModal from "../../components/billing/UpgradePlanModal";

const fmt = (n) => `Rs. ${(n || 0).toLocaleString("en-IN")}`;

const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_SaHmJpDs42QvIp";

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (document.getElementById("rzp-script")) { resolve(true); return; }
    const s = document.createElement("script");
    s.id = "rzp-script";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

const PaymentPlan = () => {
  const { storeName } = useTenantBranding();
  const [plans, setPlans]               = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage]               = useState(null);
  const [invoice, setInvoice]           = useState(null);
  const [prepaidInvoice, setPrepaidInvoice] = useState(null);

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [activating, setActivating]         = useState(false);
  const [paying, setPaying]                 = useState(false);
  const [showModal, setShowModal]           = useState(false);
  const [upgradeModal, setUpgradeModal]     = useState(false);
  const [activatedPlanName, setActivatedPlanName] = useState("");
  const [error, setError]                   = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [plansRes, subRes, usageRes, invoiceRes] = await Promise.all([
          apiService.getPlans(),
          apiService.getSubscription(),
          apiService.getUsage(),
          apiService.getCurrentInvoice(),
        ]);

        const planList    = plansRes.data    || [];
        const sub         = subRes.data      || null;
        const usageData   = usageRes.data    || null;
        const invoiceData = invoiceRes.data  || null;
        const prepaidData = invoiceRes.prepaidInvoice || null;

        setPlans(planList);
        setSubscription(sub);
        setUsage(usageData);
        setInvoice(invoiceData);
        setPrepaidInvoice(prepaidData);

  // Pre-select current plan (not nextPlan) so user sees what's active
        const activePlanId = sub?.planId?._id || sub?.planId;
        setSelectedPlanId(String(activePlanId || ""));
      } catch (err) {
        console.error("PaymentPlan load error:", err);
        setError("Failed to load billing data. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Pay & Activate Now (immediate plan switch with payment) ──
  const handleActivateNow = async () => {
    if (!selectedPlanId) return;
    try {
      setActivating(true);
      setError("");
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Razorpay SDK failed to load.");

      const initRes = await apiService.initiatePlanPayment(selectedPlanId);
      const { order, plan, amount, merchantName } = initRes.data || {};

      const options = {
        key: RAZORPAY_KEY,
        amount: order.amount,
        currency: order.currency,
        name: merchantName || storeName || "Store",
        description: `Monthly subscription (prorated) — ${fmt(amount ?? order.amount / 100)}`,
        description: `Activate ${plan.name} Plan`,
        order_id: order.id,
        handler: async (response) => {
          try {
            await apiService.activatePlanNow({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              planId: selectedPlanId,
            });
            // Refresh all data
            const [subRes, usageRes, invoiceRes] = await Promise.all([
              apiService.getSubscription(),
              apiService.getUsage(),
              apiService.getCurrentInvoice(),
            ]);
            setSubscription(subRes.data || null);
            setUsage(usageRes.data || null);
            setInvoice(invoiceRes.data || null);
            setPrepaidInvoice(invoiceRes.prepaidInvoice || null);
            setActivatedPlanName(plan.name);
            setShowModal("activated");
          } catch {
            setError("Payment verification failed. Please contact support.");
          }
        },
        prefill: { name: "Admin", email: "admin@kmfgrocery.com" },
        theme: { color: "#16a34a" },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => setError("Payment failed. Please try again."));
      rzp.open();
    } catch (err) {
      setError(err.message || "Could not initiate payment.");
    } finally {
      setActivating(false);
    }
  };

  // ── Schedule plan change for next cycle (free / deferred) ───
  const handleSchedule = async () => {
    if (!selectedPlanId) return;
    try {
      setSaving(true);
      setError("");
      await apiService.changePlan(selectedPlanId);
      const subRes = await apiService.getSubscription();
      setSubscription(subRes.data || null);
      setShowModal("scheduled");
    } catch (err) {
      setError(err.message || "Failed to schedule plan change.");
    } finally {
      setSaving(false);
    }
  };

  const refreshBilling = async () => {
    const [subRes, usageRes, invoiceRes] = await Promise.all([
      apiService.getSubscription(),
      apiService.getUsage(),
      apiService.getCurrentInvoice(),
    ]);
    setSubscription(subRes.data || null);
    setUsage(usageRes.data || null);
    setInvoice(invoiceRes.data || null);
    setPrepaidInvoice(invoiceRes.prepaidInvoice || null);
  };

  const handlePayInvoiceById = async (targetInvoice, label) => {
    const amount = Number(targetInvoice?.totalAmount ?? targetInvoice?.total_amount ?? 0);
    if (!targetInvoice || amount <= 0) {
      setError("No pending amount to pay.");
      return;
    }
    try {
      setPaying(true);
      setError("");
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Razorpay SDK failed to load.");

      const orderRes = await apiService.createInvoicePayment(targetInvoice._id);
      const payload = orderRes.data || {};
      const rzpOrder = payload.order || payload;
      const payAmount = payload.amount;
      const merchantName = payload.merchantName || storeName || "Store";

      const options = {
        key: RAZORPAY_KEY,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: merchantName,
        description:
          label ||
          `Invoice ${targetInvoice.invoice_number || ""}${
            payAmount ? ` — ${fmt(payAmount)}` : ""
          }`,
        order_id: rzpOrder.id,
        handler: async (response) => {
          try {
            await apiService.verifyInvoicePayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              invoiceId: targetInvoice._id,
            });
            await refreshBilling();
          } catch {
            setError("Payment verification failed. Please contact support.");
          }
        },
        prefill: { name: "Admin", email: "admin@kmfgrocery.com" },
        theme: { color: "#16a34a" },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => setError("Payment failed. Please try again."));
      rzp.open();
    } catch (err) {
      setError(err.message || "Payment initiation failed.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Loading plans...</p>
        </div>
      </div>
    );
  }

  const currentPlan    = subscription?.planId;
  const nextPlan       = subscription?.nextPlanId;
  const effectiveModel =
    subscription?.effective_pricing_model ||
    currentPlan?.effective_pricing_model ||
    currentPlan?.pricing_model;
  const isSubStyle = effectiveModel === "SUBSCRIPTION";
  const prepaidAmount = Number(
    prepaidInvoice?.totalAmount ?? prepaidInvoice?.total_amount ?? 0
  );
  const prepaidPending =
    prepaidInvoice &&
    prepaidInvoice.payment_status !== "PAID" &&
    prepaidInvoice.invoice_status !== "PAID" &&
    prepaidAmount > 0;
  const usageInvoiceType = invoice?.invoice_type;
  const isUsageInvoice =
    usageInvoiceType === "EXTRA_USAGE" || usageInvoiceType === "PER_ORDER";
  const extraCharges = Number(
    usage?.extra_charges ?? usage?.extraCharges ?? invoice?.extra_charges ?? invoice?.extraCharges ?? 0
  );
  const usageBill = isUsageInvoice
    ? Number(invoice?.totalAmount ?? invoice?.total_amount ?? 0)
    : 0;
  const currentBill = isSubStyle ? extraCharges : usageBill;
  const ordersCount    = usage?.ordersCount ?? usage?.orders_used ?? 0;
  const extraOrders    = usage?.extraOrders ?? usage?.extra_orders ?? 0;
  const includedOrders = currentPlan?.includedOrders ?? currentPlan?.included_orders ?? null;
  const usagePending =
    isUsageInvoice &&
    isSubStyle &&
    extraOrders > 0 &&
    usageBill > 0 &&
    invoice.payment_status !== "PAID" &&
    invoice.invoice_status !== "PAID";
  const perOrderPending =
    isUsageInvoice &&
    !isSubStyle &&
    usageBill > 0 &&
    invoice.payment_status !== "PAID" &&
    invoice.invoice_status !== "PAID";
  const isPending = prepaidPending || usagePending || perOrderPending;

  const currentPlanId   = String(currentPlan?._id || "");
  const isChangingPlan  = selectedPlanId && selectedPlanId !== currentPlanId;
  const selectedPlan    = plans.find((p) => String(p._id) === selectedPlanId);
  const selectedPricing = selectedPlan?.pricing_model || selectedPlan?.pricingType;
  const requiresPayment =
    isChangingPlan &&
    (selectedPricing === "SUBSCRIPTION" || selectedPricing === "ENTERPRISE") &&
    (selectedPlan?.monthly_price ?? selectedPlan?.monthlyPrice ?? 0) > 0;

  const fmtDate = (d) => {
    if (!d) return "--";
    const date = new Date(d);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  };

  const cycleStart = fmtDate(subscription?.billingCycleStart);
  const cycleEnd   = fmtDate(subscription?.billingCycleEnd);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        <SuspensionWarningBanner invoice={invoice} subscription={subscription} />
        <BillingNotificationsPanel />

        <div className="flex justify-end">
          <Link
            to="/settings/invoices"
            className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800"
          >
            <FileText size={16} />
            Invoice history
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg flex items-center gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* HEADER */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-black text-gray-900">Payment Plans</h1>
          </div>
          <div className="ml-11 space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span>Active Plan:</span>
              <span className="px-3 py-1 bg-green-600 text-white rounded-full text-xs font-bold">
                {currentPlan?.name || "--"}
              </span>
              {nextPlan && (
                <>
                  <span className="text-gray-400">{">"}</span>
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                    {nextPlan?.name || nextPlan} next cycle
                  </span>
                </>
              )}
              <span className="flex items-center gap-1 text-gray-400 text-xs sm:ml-auto">
                <Calendar size={12} /> {cycleStart} to {cycleEnd}
              </span>
            </div>
            {(currentPlan?.description || subscription?.plan_snapshot?.description) && (
              <p className="text-sm text-gray-600 leading-relaxed">
                {currentPlan?.description || subscription?.plan_snapshot?.description}
              </p>
            )}
          </div>
        </div>

        {/* PLAN CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const isSelected     = selectedPlanId === String(plan._id);
            const pm = plan.pricing_model || plan.pricingType;
            const effectivePm = plan.effective_pricing_model || pm;
            const isSubscription = effectivePm === "SUBSCRIPTION";
            const isEnterprise = pm === "ENTERPRISE";
            return (
              <div
                key={plan._id}
                onClick={() => setSelectedPlanId(String(plan._id))}
                className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-lg ${
                  isSelected
                    ? "border-green-600 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md"
                    : "border-gray-200 bg-white hover:border-green-300"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}

                <div className={`inline-flex p-3 rounded-xl mb-4 ${isSelected ? "bg-green-600" : "bg-gray-100"}`}>
                  {isSubscription
                    ? <Layers className={`w-6 h-6 ${isSelected ? "text-white" : "text-gray-700"}`} />
                    : <IndianRupee className={`w-6 h-6 ${isSelected ? "text-white" : "text-gray-700"}`} />
                  }
                </div>

                <h3 className="font-bold text-lg text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">{pm}</p>
                {plan.description ? (
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed min-h-[2.5rem]">
                    {plan.description}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 mb-4 italic">No description provided.</p>
                )}

                {isSubscription ? (
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-green-600">{fmt(plan.monthly_price ?? plan.monthlyPrice)}</span>
                      <span className="text-xs text-gray-500">/month</span>
                    </div>
                    {(plan.included_orders ?? plan.includedOrders) > 0 && (
                      <p className="text-xs text-gray-600">
                        {plan.included_orders ?? plan.includedOrders} orders included &bull; {fmt(plan.price_per_extra_order ?? plan.pricePerExtraOrder)}/extra
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-green-600">
                        {(plan.price_per_order ?? plan.pricePerOrder) > 0 ? fmt(plan.price_per_order ?? plan.pricePerOrder) : "Free"}
                      </span>
                      {(plan.price_per_order ?? plan.pricePerOrder) > 0 && (
                        <span className="text-xs text-gray-500">per order</span>
                      )}
                    </div>
                    {isEnterprise && (
                      <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wide">
                        Custom rate for your store
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CURRENT CYCLE SUMMARY */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-lg text-gray-900">Current Cycle Summary</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-gray-50">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Orders</p>
              <p className="text-xl font-black text-gray-900">
                {ordersCount}
                {includedOrders && <span className="text-sm text-gray-400"> / {includedOrders}</span>}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gray-50">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Extra Orders</p>
              <p className={`text-xl font-black ${extraOrders > 0 ? "text-red-500" : "text-gray-900"}`}>{extraOrders}</p>
            </div>
            <div className="p-3 rounded-xl bg-gray-50">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Extra Charges</p>
              <p className="text-xl font-black text-gray-900">{fmt(extraCharges)}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">
                {isSubStyle ? "Extra usage (postpaid)" : "Current Bill"}
              </p>
              <p className="text-xl font-black text-emerald-700">{fmt(currentBill)}</p>
            </div>
          </div>

          {isSubStyle && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-800 font-bold">
                Monthly fee (prepaid):{" "}
                {prepaidInvoice?.payment_status === "PAID" || prepaidInvoice?.invoice_status === "PAID"
                  ? `Paid ${fmt(prepaidAmount)}`
                  : `Due ${fmt(prepaidAmount)}`}
              </span>
            </div>
          )}

          {isPending && (
            <div className="flex items-center gap-2 text-amber-600 text-xs font-semibold bg-amber-50 rounded-lg px-3 py-2">
              <AlertCircle size={13} />
              {prepaidPending && (usagePending || perOrderPending)
                ? "Monthly fee and usage charges are due"
                : prepaidPending
                  ? "Monthly subscription fee due (prepaid, prorated for days left this month)"
                  : usagePending
                    ? "Extra usage above your plan limit — pay now or at month-end"
                    : perOrderPending
                      ? "Per-order charges due for this cycle"
                      : null}
            </div>
          )}
        </div>

        {/* ACTION BUTTONS */}
        <div className="space-y-3">

          {/* Plan change actions — only show when a different plan is selected */}
          {isChangingPlan && (
            <button
              type="button"
              onClick={() => setUpgradeModal(true)}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-6 rounded-xl font-bold shadow-md"
            >
              Review plan change — {selectedPlan?.name}
            </button>
          )}

          {isChangingPlan && upgradeModal && (
            <UpgradePlanModal
              open={upgradeModal}
              mode="choose"
              planName={selectedPlan?.name}
              planDescription={selectedPlan?.description}
              amount={selectedPlan?.monthly_price ?? selectedPlan?.monthlyPrice ?? 0}
              onClose={() => setUpgradeModal(false)}
              onPayNow={async () => {
                setUpgradeModal(false);
                await handleActivateNow();
              }}
              onSchedule={async () => {
                setUpgradeModal(false);
                await handleSchedule();
              }}
              paying={activating}
              scheduling={saving}
            />
          )}

              {prepaidPending && (
            <button
              type="button"
              onClick={() =>
                handlePayInvoiceById(
                  prepaidInvoice,
                  `Monthly subscription (prorated) — ${prepaidInvoice.invoice_number || ""}`
                )
              }
              disabled={paying}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold shadow-md bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              {paying
                ? "Processing..."
                : `Pay monthly fee (prorated) · ${fmt(prepaidAmount)}`}
            </button>
          )}
          {usagePending && (
            <button
              type="button"
              onClick={() =>
                handlePayInvoiceById(
                  invoice,
                  `Extra usage — ${invoice.invoice_number || ""}`
                )
              }
              disabled={paying}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold shadow-md bg-gray-900 text-white hover:bg-black disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              {paying ? "Processing..." : `Pay extra usage · ${fmt(usageBill)}`}
            </button>
          )}
          {perOrderPending && (
            <button
              type="button"
              onClick={() =>
                handlePayInvoiceById(
                  invoice,
                  `Order charges — ${invoice.invoice_number || ""}`
                )
              }
              disabled={paying}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold shadow-md bg-gray-900 text-white hover:bg-black disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              {paying ? "Processing..." : `Pay order charges · ${fmt(usageBill)}`}
            </button>
          )}
          {!prepaidPending && !usagePending && !perOrderPending && (
            <button
              type="button"
              disabled
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold bg-gray-100 text-gray-400 cursor-not-allowed"
            >
              <CreditCard className="w-4 h-4" />
              No payment due
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
          BASIC: monthly fee is prepaid when you join or each new month starts; extra orders above your
          limit are billed at month-end. FREE: per-order charges billed at month-end. Plan changes
          apply next cycle unless you activate now with payment.
        </p>

        {/* SUCCESS MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
              <div className="w-16 h-16 mx-auto mb-6 bg-green-600 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              {showModal === "activated" ? (
                <>
                  <h3 className="font-black text-xl text-center mb-3 text-gray-900">Plan Activated!</h3>
                  <p className="text-center text-gray-600 mb-6 text-sm">
                    <span className="font-bold text-green-600">{activatedPlanName}</span> is now your active plan. Your new billing cycle starts today.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-black text-xl text-center mb-3 text-gray-900">Plan Change Scheduled!</h3>
                  <p className="text-center text-gray-600 mb-6 text-sm">
                    Your plan will switch at the start of the next billing cycle ({cycleEnd}).
                  </p>
                </>
              )}
              <button
                onClick={() => setShowModal(false)}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default PaymentPlan;