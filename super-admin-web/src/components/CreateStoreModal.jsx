import { useState, useRef } from 'react';
import { createTenant, uploadLogo } from '../api/superApi';

const PLANS = ['FREE', 'BASIC', 'PREMIUM'];

function InputField({ label, field, type = 'text', placeholder, required, hint, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const EMPTY = {
  storeName: '',
  ownerName: '',
  phoneNumber: '',
  tenantId: '',
  storeAddress: '',
  contactEmail: '',
  plan: 'FREE',
  password: '',
  confirmPassword: '',
};

export default function CreateStoreModal({ onClose, onCreated }) {
  const [form, setForm]             = useState(EMPTY);
  const [logoFile, setLogoFile]     = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUrl, setLogoUrl]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [result, setResult]         = useState(null);
  const fileRef                     = useRef(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Logo must be an image file'); return; }
    if (file.size > 5 * 1024 * 1024)    { setError('Logo must be under 5 MB'); return; }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoUploading(true);
    setError('');
    try {
      const url = await uploadLogo(file);
      setLogoUrl(url);
    } catch (err) {
      setError('Logo upload failed: ' + err.message);
      setLogoPreview('');
      setLogoFile(null);
    } finally {
      setLogoUploading(false);
    }
  };

  const validate = () => {
    if (!form.storeName.trim())   return 'Store Name is required';
    if (!form.ownerName.trim())   return 'Owner Name is required';
    const phone = form.phoneNumber.trim();
    if (!phone)                   return 'Contact Number is required';
    if (!/^\d{10}$/.test(phone))  return 'Contact Number must be exactly 10 digits';
    if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim()))
      return 'Email format is invalid';
    if (!form.password)           return 'Password is required';
    if (form.password.length < 8) return 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) return 'Passwords do not match';
    if (form.tenantId.trim() && !/^[a-z0-9-]+$/.test(form.tenantId.trim()))
      return 'Tenant ID may only contain lowercase letters, digits and hyphens';
    if (logoFile && !logoUrl && !logoUploading)
      return 'Logo upload is still in progress, please wait';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const data = await createTenant({
        storeName:    form.storeName,
        ownerName:    form.ownerName,
        phoneNumber:  form.phoneNumber,
        tenantId:     form.tenantId,
        storeAddress: form.storeAddress,
        contactEmail: form.contactEmail,
        plan:         form.plan,
        logo:         logoUrl,
        password:     form.password,
      });
      setResult(data);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Create New Store</h2>
            <p className="text-xs text-gray-400 mt-0.5">Complete onboarding for a new tenant</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors text-xl leading-none">&times;</button>
        </div>

        {/* Success state */}
        {result ? (
          <div className="px-6 py-6 space-y-4">
            <div className="flex items-center gap-3">
              {result.logo && (
                <img src={result.logo} alt="logo" className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
              )}
              <div>
                <div className="flex items-center gap-2 text-green-700">
                  <span className="text-lg">✓</span>
                  <span className="font-semibold">Store created successfully!</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Share the details below with the store owner</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200 text-sm">
              {[
                ['Tenant ID',       result.tenantId],
                ['Customer Domain', result.customerDomain],
                ['Admin Domain',    result.adminDomain],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center px-4 py-3">
                  <span className="text-gray-500 text-xs font-medium">{label}</span>
                  <span className="font-mono text-gray-800 text-xs bg-gray-100 px-2 py-0.5 rounded">{value}</span>
                </div>
              ))}
            </div>

            <button onClick={onClose} className="w-full py-2.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* ── Logo ── */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Store Logo</label>
              <div className="flex items-center gap-4">
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors overflow-hidden bg-gray-50 flex-shrink-0"
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="logo preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl text-gray-300">🖼</span>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                    disabled={logoUploading}
                  >
                    {logoUploading ? 'Uploading…' : logoUrl ? 'Change Logo' : 'Upload Logo'}
                  </button>
                  {logoUrl && !logoUploading && (
                    <p className="mt-1 text-xs text-green-600 font-medium">✓ Uploaded</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">PNG, JPG up to 5 MB</p>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>
            </div>

            {/* ── Store Details ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Store Details</p>
              <InputField label="Store Name" field="storeName" placeholder="e.g. Fresh Mart" required value={form.storeName} onChange={set('storeName')} />
              <InputField label="Store Address" field="storeAddress" placeholder="123 Main St, City, State" value={form.storeAddress} onChange={set('storeAddress')} />
            </div>

            {/* ── Owner / Contact ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Owner &amp; Contact</p>
              <InputField label="Owner Name" field="ownerName" placeholder="e.g. Ramesh Kumar" required value={form.ownerName} onChange={set('ownerName')} />
              <InputField label="Contact Number" field="phoneNumber" type="tel" placeholder="10-digit mobile number" required value={form.phoneNumber} onChange={set('phoneNumber')} />
              <InputField label="Email Address" field="contactEmail" type="email" placeholder="store@example.com" value={form.contactEmail} onChange={set('contactEmail')} />
            </div>

            {/* ── Admin Password ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Admin Password</p>
              <InputField label="Password" field="password" type="password" placeholder="Min. 8 characters" required value={form.password} onChange={set('password')} />
              <InputField label="Confirm Password" field="confirmPassword" type="password" placeholder="Re-enter password" required value={form.confirmPassword} onChange={set('confirmPassword')} />
            </div>

            {/* ── Configuration ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Configuration</p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Pricing Plan</label>
                <select
                  value={form.plan}
                  onChange={set('plan')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <InputField
                label="Tenant ID (optional)"
                field="tenantId"
                placeholder="fresh-mart"
                hint="Leave blank to auto-generate from store name"
                value={form.tenantId}
                onChange={set('tenantId')}
              />
            </div>

            {/* ── Actions ── */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || logoUploading}
                className="flex-1 py-2.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
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

