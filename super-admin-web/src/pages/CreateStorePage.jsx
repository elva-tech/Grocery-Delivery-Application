import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createTenant, uploadLogo } from '../api/superApi';
import {
  sanitizeIndianPincode,
  isValidIndianPincode,
  lookupIndianPincode,
  formatStoreAddressFromParts,
} from '../utils/indiaPincode';

const PLANS = ['FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE'];

const STEPS = [
  { n: 1, label: 'Store' },
  { n: 2, label: 'Owner & address' },
  { n: 3, label: 'Support' },
  { n: 4, label: 'Configuration' },
];

const initialForm = () => ({
  tenantId: '',
  storeName: '',
  tagline: '',
  ownerName: '',
  phoneNumber: '',
  contactEmail: '',
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  supportEmail: '',
  supportPhone: '',
  supportHours: '',
  plan: 'FREE',
  password: '',
  confirmPassword: '',
});

function InputField({ label, type = 'text', placeholder, required, hint, value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
      />
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function CreateStorePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const fileRef = useRef(null);

  const [pinLookup, setPinLookup] = useState('idle'); // idle | loading | ok | error
  const [pinMessage, setPinMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const pincode = sanitizeIndianPincode(form.pincode);

  useEffect(() => {
    if (step !== 2) return;
    if (!isValidIndianPincode(pincode)) {
      setPinLookup('idle');
      setPinMessage('');
      return;
    }
    let cancelled = false;
    setPinLookup('loading');
    setPinMessage('Looking up PIN…');
    const t = window.setTimeout(async () => {
      const r = await lookupIndianPincode(pincode);
      if (cancelled) return;
      if (r.ok) {
        setForm((f) => ({ ...f, city: r.city, state: r.state, pincode: r.pincode }));
        setPinLookup('ok');
        setPinMessage('City and state filled from PIN.');
      } else {
        setPinLookup('error');
        setPinMessage('Could not resolve this PIN. Enter city and state manually.');
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [pincode, step]);

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Logo must be an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Logo must be under 5 MB');
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoUploading(true);
    setError('');
    try {
      const tid = form.tenantId.trim();
      const sname = form.storeName.trim();
      if (!tid && !sname) {
        setError('Enter store name or tenant ID before uploading a logo (used for the Cloudinary folder).');
        setLogoPreview('');
        setLogoFile(null);
        return;
      }
      const url = await uploadLogo(file, {
        tenantId: tid || undefined,
        storeName: tid ? undefined : sname,
      });
      setLogoUrl(url);
    } catch (err) {
      setError('Logo upload failed: ' + (err.message || 'Unknown error'));
      setLogoPreview('');
      setLogoFile(null);
    } finally {
      setLogoUploading(false);
    }
  };

  const validateStep1 = () => {
    if (!form.storeName.trim()) return 'Store name is required';
    if (form.tenantId.trim() && !/^[a-z0-9-]+$/.test(form.tenantId.trim())) {
      return 'Tenant ID may only contain lowercase letters, digits and hyphens';
    }
    if (logoFile && !logoUrl && !logoUploading) return 'Wait for logo upload to finish';
    return null;
  };

  const validateStep2 = () => {
    if (!form.ownerName.trim()) return 'Owner name is required';
    const phone = form.phoneNumber.replace(/\D/g, '');
    if (phone.length !== 10) return 'Contact number must be exactly 10 digits';
    if (!form.contactEmail.trim()) return 'Owner email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) return 'Owner email format is invalid';
    if (!form.addressLine1.trim()) return 'Address line 1 is required';
    if (!isValidIndianPincode(form.pincode)) return 'Enter a valid 6-digit PIN code';
    if (!form.city.trim() || !form.state.trim()) return 'City and state are required (use a valid PIN or enter manually)';
    return null;
  };

  const validateStep3 = () => {
    const se = form.supportEmail.trim();
    const sp = form.supportPhone.replace(/\D/g, '');
    const sh = form.supportHours.trim();
    const any = se || form.supportPhone.trim() || sh;
    if (!any) return null;
    if (se && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(se)) return 'Support email format is invalid';
    if (form.supportPhone.trim() && sp.length !== 10) return 'Support phone must be exactly 10 digits';
    return null;
  };

  const validateStep4 = () => {
    if (!form.password) return 'Password is required';
    if (form.password.length < 8) return 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) return 'Passwords do not match';
    return null;
  };

  const goNext = () => {
    setError('');
    if (step === 1) {
      const e = validateStep1();
      if (e) {
        setError(e);
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const e = validateStep2();
      if (e) {
        setError(e);
        return;
      }
      setStep(3);
    } else if (step === 3) {
      const e = validateStep3();
      if (e) {
        setError(e);
        return;
      }
      setStep(4);
    }
  };

  const goSkipSupport = () => {
    setError('');
    setForm((f) => ({ ...f, supportEmail: '', supportPhone: '', supportHours: '' }));
    setStep(4);
  };

  const goBack = () => {
    setError('');
    if (step > 1) setStep((s) => s - 1);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    const e4 = validateStep4();
    if (e4) {
      setError(e4);
      return;
    }
    const e1 = validateStep1();
    const e2 = validateStep2();
    const e3 = validateStep3();
    if (e1 || e2 || e3) {
      setError(e1 || e2 || e3);
      return;
    }

    setLoading(true);
    try {
      const storeAddress = formatStoreAddressFromParts({
        line1: form.addressLine1,
        line2: form.addressLine2,
        landmark: form.landmark,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
      });
      const data = await createTenant({
        storeName: form.storeName,
        ownerName: form.ownerName,
        phoneNumber: form.phoneNumber.replace(/\D/g, '').slice(-10),
        tenantId: form.tenantId,
        storeAddress,
        contactEmail: form.contactEmail,
        plan: form.plan,
        logo: logoUrl,
        password: form.password,
        tagline: form.tagline,
        supportEmail: form.supportEmail,
        supportPhone: form.supportPhone,
        supportHours: form.supportHours,
      });
      setResult({ ...data, logo: logoUrl || data.logo });
    } catch (err) {
      setError(err.message || 'Failed to create store');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-6">
          <div className="flex items-center gap-3">
            {result.logo && (
              <img src={result.logo} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
            )}
            <div>
              <p className="text-green-700 font-semibold flex items-center gap-2">
                <span className="text-lg">✓</span> Store created successfully
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Share the details below with the store owner</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200 text-sm">
            {[
              ['Tenant ID', result.tenantId],
              ['Customer Domain', result.customerDomain],
              ['Admin Domain', result.adminDomain],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center px-4 py-3 gap-2">
                <span className="text-gray-500 text-xs font-medium shrink-0">{label}</span>
                <span className="font-mono text-gray-800 text-xs bg-gray-100 px-2 py-0.5 rounded text-right break-all">
                  {value}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full py-2.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <Link to="/" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-bold text-gray-900 mt-1">Create new store</h1>
          <p className="text-xs text-gray-400">Step {step} of 4 — complete all sections on this page</p>
        </div>
      </header>

      <main className="px-4 py-8 max-w-xl mx-auto pb-24">
        {/* Step indicator */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                step === s.n
                  ? 'bg-indigo-600 text-white'
                  : step > s.n
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className="tabular-nums">{s.n}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
          )}

          {/* Section 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Section 1 — Store information</h2>
              <InputField
                label="Tenant ID (optional)"
                placeholder="fresh-mart"
                hint="Lowercase letters, digits, hyphens only. Leave blank to auto-generate from store name."
                value={form.tenantId}
                onChange={set('tenantId')}
              />
              <InputField
                label="Store name"
                required
                placeholder="e.g. Fresh Mart"
                value={form.storeName}
                onChange={set('storeName')}
              />
              <InputField
                label="Website tagline"
                placeholder="Short line under the store name on the customer website"
                value={form.tagline}
                onChange={set('tagline')}
              />
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Store logo</label>
                <p className="text-[10px] text-gray-400 mb-2">Uses Tenant ID if filled; otherwise a slug from store name.</p>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0"
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl text-gray-300">🖼</span>
                    )}
                  </button>
                  <div>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                      disabled={logoUploading}
                    >
                      {logoUploading ? 'Uploading…' : logoUrl ? 'Change logo' : 'Upload logo'}
                    </button>
                    {logoUrl && !logoUploading && <p className="mt-1 text-xs text-green-600 font-medium">✓ Uploaded</p>}
                    <p className="mt-1 text-xs text-gray-400">PNG, JPG up to 5 MB</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={goNext}
                  className="px-6 py-2.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Section 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Section 2 — Owner & store address</h2>
              <InputField label="Owner name" required placeholder="e.g. Ramesh Kumar" value={form.ownerName} onChange={set('ownerName')} />
              <InputField
                label="Contact number"
                required
                type="tel"
                placeholder="10-digit mobile"
                value={form.phoneNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))
                }
              />
              <InputField
                label="Owner email"
                required
                type="email"
                placeholder="owner@example.com"
                value={form.contactEmail}
                onChange={set('contactEmail')}
              />
              <InputField label="Address line 1" required placeholder="Door / street / area" value={form.addressLine1} onChange={set('addressLine1')} />
              <InputField label="Address line 2" placeholder="Apartment, suite (optional)" value={form.addressLine2} onChange={set('addressLine2')} />
              <InputField label="Landmark" placeholder="Near … (optional)" value={form.landmark} onChange={set('landmark')} />
              <InputField
                label="PIN code"
                required
                type="tel"
                placeholder="6 digits"
                value={form.pincode}
                onChange={(e) => setForm((f) => ({ ...f, pincode: sanitizeIndianPincode(e.target.value) }))}
              />
              {(pinLookup === 'loading' || pinLookup === 'ok' || pinLookup === 'error') && pinMessage && (
                <p
                  className={`text-xs font-medium ${
                    pinLookup === 'ok' ? 'text-green-600' : pinLookup === 'error' ? 'text-amber-700' : 'text-gray-500'
                  }`}
                >
                  {pinMessage}
                </p>
              )}
              <InputField label="City" required placeholder="Auto-filled from PIN when possible" value={form.city} onChange={set('city')} />
              <InputField label="State" required placeholder="Auto-filled from PIN when possible" value={form.state} onChange={set('state')} />
              <div className="flex justify-between pt-2 gap-3">
                <button type="button" onClick={goBack} className="px-6 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50">
                  Back
                </button>
                <button type="button" onClick={goNext} className="px-6 py-2.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Section 3 */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Section 3 — Customer support (optional)</h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                Shown on the storefront contact page. The store owner can add or edit these later in admin. Skip if you do not have them yet.
              </p>
              <InputField label="Support email" type="email" placeholder="support@example.com" value={form.supportEmail} onChange={set('supportEmail')} />
              <InputField
                label="Support phone"
                type="tel"
                placeholder="10-digit number"
                value={form.supportPhone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, supportPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))
                }
              />
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Support hours</label>
                <textarea
                  value={form.supportHours}
                  onChange={set('supportHours')}
                  rows={3}
                  placeholder="e.g. Mon–Sat 9am–7pm"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y min-h-[80px]"
                />
              </div>
              <div className="flex flex-wrap justify-between pt-2 gap-3">
                <button type="button" onClick={goBack} className="px-6 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50">
                  Back
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={goSkipSupport}
                    className="px-5 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Skip
                  </button>
                  <button type="button" onClick={goNext} className="px-6 py-2.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 4 */}
          {step === 4 && (
            <form onSubmit={handleCreate} className="space-y-5">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Section 4 — Configuration</h2>
              <p className="text-xs text-gray-500">Pricing plan and admin password are required.</p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Pricing plan<span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={form.plan}
                  onChange={set('plan')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <InputField label="Password" required type="password" placeholder="Min. 8 characters" value={form.password} onChange={set('password')} />
              <InputField
                label="Confirm password"
                required
                type="password"
                placeholder="Re-enter password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
              />
              <div className="flex justify-between pt-2 gap-3">
                <button type="button" onClick={goBack} className="px-6 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50">
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || logoUploading}
                  className="px-6 py-2.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-medium"
                >
                  {loading ? 'Creating…' : 'Create store'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
