import { useState, useRef } from 'react';
import { updateTenantDetails, uploadLogo } from '../api/superApi';
import StoreHubMapPicker from './StoreHubMapPicker';

const PLANS = ['FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE'];

/** Fill structured parts from multiline storeAddress + hub PIN when DB parts were empty. */
function deriveStoreAddressParts(storeAddressText, hubPinDigits, seedParts) {
  const lines = String(storeAddressText || '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const pinFromHub = String(hubPinDigits || '').replace(/\D/g, '').slice(0, 6);

  let line1 = String(seedParts?.line1 || '').trim();
  let line2 = String(seedParts?.line2 || '').trim();
  let landmark = String(seedParts?.landmark || '').trim();
  let city = String(seedParts?.city || '').trim();
  let state = String(seedParts?.state || '').trim();

  if (!line1 && lines[0]) line1 = lines[0];

  const tailLine = lines[1] || '';
  if (tailLine) {
    const segs = tailLine.split(',').map((s) => s.trim()).filter(Boolean);
    if (segs.length > 0) {
      const last = segs[segs.length - 1];
      const pinInTail = /^[1-9]\d{5}$/.test(last) ? last : '';
      const regionSegs = pinInTail ? segs.slice(0, -1) : segs;
      if (!city && regionSegs[0]) city = regionSegs[0];
      if (!state && regionSegs[1]) state = regionSegs[1];
      const pincode = pinFromHub.length === 6 ? pinFromHub : pinInTail;
      return {
        line1,
        line2,
        landmark,
        city,
        state,
        pincode: pincode || pinFromHub,
      };
    }
  }

  const pinFromAnywhere = (String(storeAddressText || '').match(/\b([1-9]\d{5})\b/) || [])[1] || '';
  const pincode = pinFromHub.length === 6 ? pinFromHub : pinFromAnywhere;

  return { line1, line2, landmark, city, state, pincode };
}

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

export default function EditStoreModal({ tenant, onClose, onUpdated }) {
  const [form, setForm] = useState({
    storeName:    tenant.name         || '',
    ownerName:    tenant.ownerName    || '',
    phoneNumber:  tenant.phoneNumber  || '',
    storeAddress: tenant.storeAddress || '',
    contactEmail: tenant.contactEmail || '',
    tagline:      tenant.tagline      || '',
    heroBadge:    tenant.heroBadge    || '',
    heroTitle:    tenant.heroTitle    || '',
    heroSubtitle: tenant.heroSubtitle || '',
    newPassword:  '',
    confirmPassword: '',
  });
  const [logoPreview, setLogoPreview] = useState(tenant.logo || '');
  const [logoUrl, setLogoUrl]         = useState(tenant.logo || '');
  const [logoUploading, setLogoUploading] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const fileRef                       = useRef(null);
  const [storeLat, setStoreLat]       = useState(
    typeof tenant.storeLat === 'number' && Number.isFinite(tenant.storeLat) ? tenant.storeLat : null,
  );
  const [storeLng, setStoreLng]       = useState(
    typeof tenant.storeLng === 'number' && Number.isFinite(tenant.storeLng) ? tenant.storeLng : null,
  );
  const parts                         = tenant.storeAddressParts || {};
  const [hubPincode, setHubPincode]   = useState(() =>
    String(parts.pincode || '').replace(/\D/g, '').slice(0, 6),
  );

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Logo must be an image file'); return; }
    if (file.size > 5 * 1024 * 1024)    { setError('Logo must be under 5 MB'); return; }
    setLogoPreview(URL.createObjectURL(file));
    setLogoUploading(true);
    setError('');
    try {
      const url = await uploadLogo(file, { tenantId: tenant.tenantId });
      setLogoUrl(url);
    } catch (err) {
      setError('Logo upload failed: ' + err.message);
      setLogoPreview(tenant.logo || '');
    } finally {
      setLogoUploading(false);
    }
  };

  const validate = () => {
    if (!form.storeName.trim())   return 'Store Name is required';
    if (!form.ownerName.trim() || form.ownerName.trim().length < 2) return 'Owner Name must be at least 2 characters';
    if (!/^\d{10}$/.test(form.phoneNumber.trim())) return 'Contact Number must be exactly 10 digits';
    if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim()))
      return 'Email format is invalid';
    if (form.newPassword && form.newPassword.length < 8) return 'New password must be at least 8 characters';
    if (form.newPassword && form.newPassword !== form.confirmPassword) return 'Passwords do not match';
    if (logoUploading) return 'Logo upload is still in progress, please wait';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const payload = {
        storeName:    form.storeName,
        ownerName:    form.ownerName,
        phoneNumber:  form.phoneNumber,
        storeAddress: form.storeAddress,
        contactEmail: form.contactEmail,
        logo:         logoUrl,
        newPassword:  form.newPassword || undefined,
        tagline:      form.tagline,
        heroBadge:    form.heroBadge,
        heroTitle:    form.heroTitle,
        heroSubtitle: form.heroSubtitle,
      };
      if (typeof storeLat === 'number' && typeof storeLng === 'number') {
        payload.storeLat = storeLat;
        payload.storeLng = storeLng;
      }
      const hubPin = hubPincode.replace(/\D/g, '').slice(0, 6);
      payload.storeAddressParts = deriveStoreAddressParts(form.storeAddress, hubPin, parts);

      const updated = await updateTenantDetails(tenant._id, payload);
      onUpdated(updated);
      onClose();
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
            <h2 className="text-base font-bold text-gray-900">Edit Store</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{tenant.tenantId}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors text-xl leading-none">&times;</button>
        </div>

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
                  <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-gray-300">🖼</span>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={logoUploading}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {logoUploading ? 'Uploading…' : 'Change Logo'}
                </button>
                {logoUrl && !logoUploading && (
                  <p className="mt-1 text-xs text-green-600 font-medium">✓ Saved</p>
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
            <InputField label="Home Page Tagline (optional)" field="tagline" placeholder="Short line shown on customer home page" value={form.tagline} onChange={set('tagline')} />
            <InputField label="Hero badge (optional)" field="heroBadge" placeholder="e.g. Shop local" value={form.heroBadge} onChange={set('heroBadge')} />
            <InputField label="Hero title (optional)" field="heroTitle" placeholder="Homepage headline" value={form.heroTitle} onChange={set('heroTitle')} />
            <InputField label="Hero subtitle (optional)" field="heroSubtitle" placeholder="Supporting line" value={form.heroSubtitle} onChange={set('heroSubtitle')} />
            <InputField label="Store Address" field="storeAddress" placeholder="123 Main St, City, State" value={form.storeAddress} onChange={set('storeAddress')} />
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Delivery hub (map)</p>
              <p className="text-[11px] text-gray-500">
                Drag the pin or use PIN lookup — OpenStreetMap only; coordinates sync to tenant hub for customer radius.
              </p>
              <label className="block text-xs font-semibold text-gray-600 mb-1">PIN for “Centre from PIN” (optional)</label>
              <input
                type="tel"
                value={hubPincode}
                onChange={(e) => setHubPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit PIN"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[140px]"
              />
              <StoreHubMapPicker
                lat={typeof storeLat === 'number' ? storeLat : undefined}
                lng={typeof storeLng === 'number' ? storeLng : undefined}
                pincode={hubPincode}
                onChange={({ lat, lng }) => {
                  setStoreLat(lat);
                  setStoreLng(lng);
                }}
              />
            </div>
          </div>

          {/* ── Owner / Contact ── */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Owner &amp; Contact</p>
            <InputField label="Owner Name" field="ownerName" placeholder="e.g. Ramesh Kumar" required value={form.ownerName} onChange={set('ownerName')} />
            <InputField label="Contact Number" field="phoneNumber" type="tel" placeholder="10-digit mobile number" required value={form.phoneNumber} onChange={set('phoneNumber')} />
            <InputField label="Email Address" field="contactEmail" type="email" placeholder="store@example.com" value={form.contactEmail} onChange={set('contactEmail')} />
          </div>

          {/* ── Change Password (optional) ── */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Change Admin Password <span className="normal-case text-gray-300">(leave blank to keep current)</span></p>
            <InputField label="New Password" field="newPassword" type="password" placeholder="Min. 8 characters" value={form.newPassword} onChange={set('newPassword')} />
            <InputField label="Confirm New Password" field="confirmPassword" type="password" placeholder="Re-enter new password" value={form.confirmPassword} onChange={set('confirmPassword')} />
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
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
