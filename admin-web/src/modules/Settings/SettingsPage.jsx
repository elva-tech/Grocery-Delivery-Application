import React, { useState, useEffect } from 'react';
import { Settings, Save, Loader, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiService } from '../../services/apiService';

const DISCOUNT_TYPES = [
  { value: 'NONE', label: 'No Discount' },
  { value: 'PERCENTAGE', label: 'Percentage (%)' },
  { value: 'FLAT', label: 'Flat Amount (₹)' },
];

const SettingsPage = () => {
  const [form, setForm] = useState({
    deliveryCharge: 40,
    freeDeliveryAbove: 500,
    discountType: 'NONE',
    discountValue: 0,
    thresholdDistance: 10,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'error' | null

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiService.getSettings();
        setForm({
          deliveryCharge: data.deliveryCharge ?? 40,
          freeDeliveryAbove: data.freeDeliveryAbove ?? 500,
          discountType: data.discountType ?? 'NONE',
          discountValue: data.discountValue ?? 0,
          thresholdDistance: data.thresholdDistance ?? 10,
        });
      } catch (err) {
        console.error('Failed to load settings:', err);
        setStatus('error');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setStatus(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatus(null);
    try {
      await apiService.updateSettings({
        deliveryCharge: Number(form.deliveryCharge),
        freeDeliveryAbove: Number(form.freeDeliveryAbove),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        thresholdDistance: Number(form.thresholdDistance),
      });
      setStatus('success');
    } catch (err) {
      console.error('Failed to save settings:', err);
      setStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-[#0F2C1D] p-2.5 rounded-xl shadow-lg shadow-green-900/20">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Store Settings</h1>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mt-0.5">
            Delivery &amp; Pricing Configuration
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* DELIVERY SECTION */}
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-5">
            Delivery Charges
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">
                Delivery Charge (₹)
              </label>
              <input
                type="number"
                min="0"
                value={form.deliveryCharge}
                onChange={e => handleChange('deliveryCharge', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F2C1D]/20 focus:border-[#0F2C1D]"
                placeholder="e.g. 40"
              />
              <p className="text-[10px] text-gray-400 mt-1.5">
                Applied when order is below the free delivery threshold
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">
                Free Delivery Above (₹)
              </label>
              <input
                type="number"
                min="0"
                value={form.freeDeliveryAbove}
                onChange={e => handleChange('freeDeliveryAbove', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F2C1D]/20 focus:border-[#0F2C1D]"
                placeholder="e.g. 500"
              />
              <p className="text-[10px] text-gray-400 mt-1.5">
                Orders at or above this amount get free delivery
              </p>
            </div>
          </div>
        </div>

        {/* THRESHOLD DISTANCE SECTION */}
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-5">
            Delivery Radius
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">
                Threshold Distance (km)
              </label>
              <input
                type="number"
                min="0"
                value={form.thresholdDistance}
                onChange={e => handleChange('thresholdDistance', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F2C1D]/20 focus:border-[#0F2C1D]"
                placeholder="e.g. 10"
              />
              <p className="text-[10px] text-gray-400 mt-1.5">
                Maximum delivery radius from the store (in kilometres)
              </p>
            </div>
          </div>
        </div>

        {/* DISCOUNT SECTION */}
        <div className="px-8 py-6">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-5">
            Discount
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">
                Discount Type
              </label>
              <select
                value={form.discountType}
                onChange={e => handleChange('discountType', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F2C1D]/20 focus:border-[#0F2C1D] bg-white"
              >
                {DISCOUNT_TYPES.map(dt => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
            </div>

            {form.discountType !== 'NONE' && (
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">
                  {form.discountType === 'PERCENTAGE' ? 'Discount (%)' : 'Discount Amount (₹)'}
                </label>
                <input
                  type="number"
                  min="0"
                  max={form.discountType === 'PERCENTAGE' ? 100 : undefined}
                  value={form.discountValue}
                  onChange={e => handleChange('discountValue', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F2C1D]/20 focus:border-[#0F2C1D]"
                  placeholder={form.discountType === 'PERCENTAGE' ? 'e.g. 10' : 'e.g. 50'}
                />
              </div>
            )}
          </div>

          {/* Preview */}
          {form.discountType !== 'NONE' && Number(form.discountValue) > 0 && (
            <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-xs font-bold text-emerald-700">
                Preview: Customers will receive{' '}
                {form.discountType === 'PERCENTAGE'
                  ? `${form.discountValue}% off their subtotal`
                  : `₹${form.discountValue} off their order`}
              </p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-4">
          {status === 'success' && (
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
              <CheckCircle2 size={16} />
              Settings saved successfully
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-red-500 text-xs font-bold">
              <AlertCircle size={16} />
              Failed to save. Please try again.
            </div>
          )}
          {!status && <div />}

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-[#0F2C1D] hover:bg-[#1a4a30] text-white px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
