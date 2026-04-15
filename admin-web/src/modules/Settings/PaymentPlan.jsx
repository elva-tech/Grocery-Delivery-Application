import React, { useEffect, useState } from 'react';
import { DollarSign, Layers, CheckCircle, Sparkles, TrendingUp } from 'lucide-react';

import {
  getPaymentPlan,
  savePaymentPlan,
  getRevenueDetails,
  createPayment,
  getPlanConfig
} from '../../api/paymentPlanApi';

const PaymentPlan = () => {
  const [currentPlan, setCurrentPlan] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [revenue, setRevenue] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState('');

  const [planConfig, setPlanConfig] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const [plan, rev, config] = await Promise.all([
          getPaymentPlan(),
          getRevenueDetails(),
          getPlanConfig()
        ]);

        setCurrentPlan(plan.planType);
        setSelectedPlan(plan.planType);
        setRevenue(rev);
        setPlanConfig(config);

      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!selectedPlan) return;

    const loadRevenue = async () => {
      try {
        const data = await getRevenueDetails();
        setRevenue(data);
      } catch {
        setError('Failed to update revenue');
      }
    };

    loadRevenue();
  }, [selectedPlan]);

  const handleSave = async () => {
    try {
      await savePaymentPlan({ planType: selectedPlan });

      setCurrentPlan(selectedPlan);

      const updated = await getRevenueDetails();
      setRevenue(updated);

      setShowModal(true);
    } catch {
      setError('Failed to update plan');
    }
  };

  const handlePayment = async () => {
    if (!revenue || revenue.total === 0) return;

    try {
      setIsPaying(true);

      const res = await createPayment();

      if (!res?.paymentUrl) {
        throw new Error();
      }

      window.open(res.paymentUrl, "_blank");

      // TEMP IMPLEMENTATION
// Using Razorpay demo link for now.
//
// FUTURE (REAL BACKEND):
// const res = await createPayment();
// window.location.href = res.paymentUrl;
//
// Backend will return actual Razorpay order URL.

    } catch {
      setError('Payment failed. Try again.');
    } finally {
      setIsPaying(false);
    }
  };

  // Loading guard
  if (loading || !planConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-semibold">Loading plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg flex items-center gap-3 shadow-sm">
            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">!</span>
            </div>
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* HEADER */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-black text-gray-900">Payment Plans</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 ml-11">
            <span>Current Plan:</span>
            <span className="px-3 py-1 bg-green-600 text-white rounded-full text-xs font-bold">
              {currentPlan}
            </span>
          </div>
        </div>

        {/* PLAN CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* PER ORDER */}
          <div
            onClick={() => setSelectedPlan('PER_ORDER')}
            className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-lg ${
              selectedPlan === 'PER_ORDER'
                ? 'border-green-600 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-green-300'
            }`}
          >
            {selectedPlan === 'PER_ORDER' && (
              <div className="absolute top-4 right-4 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            )}

            <div className={`inline-flex p-3 rounded-xl mb-4 ${
              selectedPlan === 'PER_ORDER' 
                ? 'bg-green-600' 
                : 'bg-gray-100'
            }`}>
              <DollarSign className={`w-6 h-6 ${
                selectedPlan === 'PER_ORDER' ? 'text-white' : 'text-gray-700'
              }`} />
            </div>

            <h3 className="font-bold text-lg text-gray-900 mb-1">Per Order</h3>
            <p className="text-sm text-gray-500 mb-4">Simple & flexible</p>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-green-600">
                ₹{planConfig.PER_ORDER.perOrderFee}
              </span>
              <span className="text-sm text-gray-500">per order</span>
            </div>
          </div>

          {/* HYBRID */}
          <div
            onClick={() => setSelectedPlan('HYBRID')}
            className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-lg ${
              selectedPlan === 'HYBRID'
                ? 'border-green-600 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-green-300'
            }`}
          >
            {selectedPlan === 'HYBRID' && (
              <div className="absolute top-4 right-4 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            )}

            <div className={`inline-flex p-3 rounded-xl mb-4 ${
              selectedPlan === 'HYBRID' 
                ? 'bg-green-600' 
                : 'bg-gray-100'
            }`}>
              <Layers className={`w-6 h-6 ${
                selectedPlan === 'HYBRID' ? 'text-white' : 'text-gray-700'
              }`} />
            </div>

            <h3 className="font-bold text-lg text-gray-900 mb-1">Hybrid</h3>
            <p className="text-sm text-gray-500 mb-4">Best for scaling</p>

            <div className="space-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-green-600">
                  ₹{planConfig.HYBRID.basePrice.toLocaleString()}
                </span>
                <span className="text-xs text-gray-500">base</span>
              </div>
              <p className="text-xs text-gray-600">
                for {planConfig.HYBRID.baseLimit} orders + ₹{planConfig.HYBRID.extraPerOrder}/order
              </p>
            </div>
          </div>

        </div>

        {/* REVENUE */}
        {revenue && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
            
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="font-bold text-lg text-gray-900">Revenue Summary</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-600">Total Orders</span>
                <span className="font-bold text-gray-900">{revenue.totalOrders}</span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-600">Plan Type</span>
                <span className="px-3 py-1 bg-green-600 text-white rounded-full text-xs font-bold">
                  {revenue.planType}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-sm text-gray-700">{revenue.breakdown}</p>
              </div>
            </div>

            <div className="border-t-2 border-gray-200 pt-4 flex justify-between items-center">
              <span className="font-bold text-gray-900">Total Payable</span>
              <span className="text-3xl font-black text-green-600">
                ₹{revenue.total.toLocaleString()}
              </span>
            </div>

          </div>
        )}

        {/* BUTTONS */}
        <div className="flex flex-col sm:flex-row gap-4">

          <button
            onClick={handleSave}
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-6 rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
          >
            Update Plan
          </button>

          <button
            onClick={handlePayment}
            disabled={!revenue || revenue.total === 0 || isPaying}
            className={`flex-1 py-3 px-6 rounded-xl font-bold shadow-md transition-all ${
              revenue?.total > 0 && !isPaying
                ? 'bg-gray-900 text-white hover:bg-black hover:shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isPaying ? 'Processing...' : 'Make Payment'}
          </button>

        </div>

        {/* MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
              
              <div className="w-16 h-16 mx-auto mb-6 bg-green-600 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>

              <h3 className="font-black text-xl text-center mb-3 text-gray-900">
                Plan Updated!
              </h3>
              
              <p className="text-center text-gray-600 mb-6">
                Your current plan is now{' '}
                <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm font-bold">
                  {currentPlan}
                </span>
              </p>

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