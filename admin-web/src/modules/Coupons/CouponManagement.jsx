import React, { useState, useEffect } from 'react';
import {
  Tag, Plus, Pencil, ToggleLeft, ToggleRight,
  X, Loader, AlertCircle, CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useToast } from '../../context/ToastContext';

const EMPTY_FORM = {
  code: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  minOrderValue: '',
  maxDiscount: '',
  usageLimit: '',
  validFrom: '',
  validTo: '',
  firstTimeUserOnly: false,
  isActive: true,
};

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const toInputDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
};

const CouponManagement = () => {
  const { showToast } = useToast();
  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form panel
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ── Load coupons ──────────────────────────────
  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.getCoupons();
      setCoupons(data.coupons || []);
    } catch (err) {
      setError('Failed to load coupons');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Form helpers ──────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  const openEdit = (coupon) => {
    setEditingId(coupon._id);
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderValue: coupon.minOrderValue ?? '',
      maxDiscount: coupon.maxDiscount ?? '',
      usageLimit: coupon.usageLimit ?? '',
      validFrom: toInputDate(coupon.validFrom),
      validTo: toInputDate(coupon.validTo),
      firstTimeUserOnly: coupon.firstTimeUserOnly,
      isActive: coupon.isActive,
    });
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handleFieldChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFormError('');
  };

  const handleSave = async () => {
    setFormError('');
    setFormSuccess('');

    // Client-side guard
    if (!form.code.trim()) return setFormError('Coupon code is required');
    if (!form.discountValue || Number(form.discountValue) <= 0) return setFormError('Discount value must be > 0');
    if (!form.validFrom || !form.validTo) return setFormError('Valid From and Valid To are required');
    if (new Date(form.validFrom) >= new Date(form.validTo)) return setFormError('Valid To must be after Valid From');

    setIsSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderValue: form.minOrderValue !== '' ? Number(form.minOrderValue) : 0,
        maxDiscount: form.maxDiscount !== '' ? Number(form.maxDiscount) : null,
        usageLimit: form.usageLimit !== '' ? Number(form.usageLimit) : null,
        validFrom: form.validFrom,
        validTo: form.validTo,
        firstTimeUserOnly: form.firstTimeUserOnly,
        isActive: form.isActive,
      };

      if (editingId) {
        await apiService.updateCoupon(editingId, payload);
        setFormSuccess('Coupon updated');
      } else {
        await apiService.createCoupon(payload);
        setFormSuccess('Coupon created');
      }
      await load();
      setTimeout(closeForm, 900);
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Failed to save coupon');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (coupon) => {
    try {
      await apiService.updateCoupon(coupon._id, { isActive: !coupon.isActive });
      await load();
    } catch {
      showToast('error', 'Failed to update coupon status');
    }
  };

  // ── Status badge ──────────────────────────────
  const getStatus = (coupon) => {
    if (!coupon.isActive) return { label: 'Disabled', color: 'bg-gray-100 text-gray-500' };
    const now = new Date();
    if (now < new Date(coupon.validFrom)) return { label: 'Scheduled', color: 'bg-blue-100 text-blue-600' };
    if (now > new Date(coupon.validTo))   return { label: 'Expired',   color: 'bg-red-100 text-red-500' };
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit)
      return { label: 'Exhausted', color: 'bg-orange-100 text-orange-600' };
    return { label: 'Active', color: 'bg-green-100 text-green-600' };
  };

  return (
    <div className="p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-[#0F2C1D] p-2.5 rounded-xl shadow-lg shadow-green-900/20">
            <Tag size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Coupon Management</h1>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mt-0.5">
              Promo Codes &amp; Discounts
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#0F2C1D] hover:bg-[#1a4a30] text-white px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-colors"
        >
          <Plus size={16} /> New Coupon
        </button>
      </div>

      {/* Create / Edit form panel */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-8 overflow-hidden">
          <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
            <h2 className="font-black text-sm uppercase tracking-widest text-gray-700">
              {editingId ? 'Edit Coupon' : 'Create New Coupon'}
            </h2>
            <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="px-8 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Code */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Coupon Code *</label>
              <input
                value={form.code}
                onChange={e => handleFieldChange('code', e.target.value.toUpperCase())}
                placeholder="e.g. SAVE20"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0F2C1D]/20 focus:border-[#0F2C1D] uppercase"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Description</label>
              <input
                value={form.description}
                onChange={e => handleFieldChange('description', e.target.value)}
                placeholder="e.g. 20% off on your first order"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2C1D]/20 focus:border-[#0F2C1D]"
              />
            </div>

            {/* Discount Type */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Discount Type *</label>
              <select
                value={form.discountType}
                onChange={e => handleFieldChange('discountType', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F2C1D]/20 focus:border-[#0F2C1D] bg-white"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat Amount (₹)</option>
              </select>
            </div>

            {/* Discount Value */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                {form.discountType === 'PERCENTAGE' ? 'Discount (%)' : 'Discount Amount (₹)'} *
              </label>
              <input
                type="number" min="0"
                max={form.discountType === 'PERCENTAGE' ? 100 : undefined}
                value={form.discountValue}
                onChange={e => handleFieldChange('discountValue', e.target.value)}
                placeholder={form.discountType === 'PERCENTAGE' ? '10' : '50'}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F2C1D]/20 focus:border-[#0F2C1D]"
              />
            </div>

            {/* Max Discount (percentage only) */}
            {form.discountType === 'PERCENTAGE' && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Max Discount (₹)</label>
                <input
                  type="number" min="0"
                  value={form.maxDiscount}
                  onChange={e => handleFieldChange('maxDiscount', e.target.value)}
                  placeholder="e.g. 100 (leave blank = no cap)"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F2C1D]/20 focus:border-[#0F2C1D]"
                />
              </div>
            )}

            {/* Min Order Value */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Min Order Value (₹)</label>
              <input
                type="number" min="0"
                value={form.minOrderValue}
                onChange={e => handleFieldChange('minOrderValue', e.target.value)}
                placeholder="0"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F2C1D]/20 focus:border-[#0F2C1D]"
              />
            </div>

            {/* Usage Limit */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Usage Limit (blank = unlimited)</label>
              <input
                type="number" min="1"
                value={form.usageLimit}
                onChange={e => handleFieldChange('usageLimit', e.target.value)}
                placeholder="e.g. 100"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F2C1D]/20 focus:border-[#0F2C1D]"
              />
            </div>

            {/* Valid From */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Valid From *</label>
              <input
                type="date"
                value={form.validFrom}
                onChange={e => handleFieldChange('validFrom', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F2C1D]/20 focus:border-[#0F2C1D]"
              />
            </div>

            {/* Valid To */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Valid To *</label>
              <input
                type="date"
                value={form.validTo}
                onChange={e => handleFieldChange('validTo', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0F2C1D]/20 focus:border-[#0F2C1D]"
              />
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-8 sm:col-span-2 lg:col-span-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => handleFieldChange('firstTimeUserOnly', !form.firstTimeUserOnly)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.firstTimeUserOnly ? 'bg-[#0F2C1D]' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.firstTimeUserOnly ? 'left-6' : 'left-1'}`} />
                </div>
                <span className="text-xs font-bold text-gray-600">First-time users only</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => handleFieldChange('isActive', !form.isActive)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-green-500' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.isActive ? 'left-6' : 'left-1'}`} />
                </div>
                <span className="text-xs font-bold text-gray-600">Active</span>
              </label>
            </div>
          </div>

          {/* Form footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <div>
              {formError && (
                <div className="flex items-center gap-2 text-red-500 text-xs font-bold">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}
              {formSuccess && (
                <div className="flex items-center gap-2 text-green-600 text-xs font-bold">
                  <CheckCircle2 size={14} /> {formSuccess}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={closeForm} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-[#0F2C1D] hover:bg-[#1a4a30] text-white px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-60"
              >
                {isSaving ? <Loader size={14} className="animate-spin" /> : null}
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coupon list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader className="animate-spin text-gray-400" size={28} />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-500 text-sm font-bold py-8">
          <AlertCircle size={16} /> {error}
        </div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Tag size={40} className="mx-auto mb-4 opacity-30" />
          <p className="font-bold text-sm">No coupons yet</p>
          <p className="text-xs mt-1">Click "New Coupon" to create your first promo code</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Code', 'Discount', 'Min Order', 'Usage', 'Validity', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coupons.map(coupon => {
                const status = getStatus(coupon);
                return (
                  <tr key={coupon._id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Code + description */}
                    <td className="px-6 py-4">
                      <div className="font-mono font-black text-gray-900 tracking-wider">{coupon.code}</div>
                      {coupon.description && (
                        <div className="text-[10px] text-gray-400 mt-0.5 max-w-[160px] truncate">{coupon.description}</div>
                      )}
                      {coupon.firstTimeUserOnly && (
                        <span className="text-[9px] bg-purple-100 text-purple-600 font-bold px-1.5 py-0.5 rounded mt-1 inline-block">1st Order</span>
                      )}
                    </td>

                    {/* Discount */}
                    <td className="px-6 py-4">
                      <span className="font-black text-emerald-600">
                        {coupon.discountType === 'PERCENTAGE'
                          ? `${coupon.discountValue}%`
                          : `₹${coupon.discountValue}`}
                      </span>
                      {coupon.maxDiscount != null && (
                        <div className="text-[10px] text-gray-400 mt-0.5">Max ₹{coupon.maxDiscount}</div>
                      )}
                    </td>

                    {/* Min order */}
                    <td className="px-6 py-4 font-semibold text-gray-600">
                      {coupon.minOrderValue > 0 ? `₹${coupon.minOrderValue}` : '—'}
                    </td>

                    {/* Usage */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-700">
                        {coupon.usedCount} / {coupon.usageLimit ?? '∞'}
                      </div>
                      {coupon.usageLimit != null && (
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="h-full bg-[#0F2C1D] rounded-full"
                            style={{ width: `${Math.min(100, (coupon.usedCount / coupon.usageLimit) * 100)}%` }}
                          />
                        </div>
                      )}
                    </td>

                    {/* Validity */}
                    <td className="px-6 py-4 text-xs text-gray-500 font-semibold">
                      <div>{formatDate(coupon.validFrom)}</div>
                      <div className="text-gray-400">→ {formatDate(coupon.validTo)}</div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(coupon)}
                          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(coupon)}
                          className={`p-2 rounded-lg transition-colors ${
                            coupon.isActive
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-gray-400 hover:bg-gray-100'
                          }`}
                          title={coupon.isActive ? 'Disable' : 'Enable'}
                        >
                          {coupon.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CouponManagement;
