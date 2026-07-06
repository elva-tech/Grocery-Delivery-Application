import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, User, Clock, Headphones, Loader2, Smartphone } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useToast } from '../../context/ToastContext';
import { useTenantBranding } from '../../context/TenantBrandingContext';

export default function StoreProfilePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { refreshTenantProfile } = useTenantBranding();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);

  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportHours, setSupportHours] = useState('');
  const [storeLat, setStoreLat] = useState('');
  const [storeLng, setStoreLng] = useState('');
  const [savingHub, setSavingHub] = useState(false);
  const [androidAppLink, setAndroidAppLink] = useState('');
  const [iosAppLink, setIosAppLink] = useState('');
  const [savingAppLinks, setSavingAppLinks] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiService
      .getStoreProfile()
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setSupportEmail((data.supportEmail || '').trim());
        setSupportPhone((data.supportPhone || '').trim());
        setSupportHours((data.supportHours || '').trim());
        setStoreLat(
          typeof data.storeLat === 'number' && Number.isFinite(data.storeLat) ? String(data.storeLat) : '',
        );
        setStoreLng(
          typeof data.storeLng === 'number' && Number.isFinite(data.storeLng) ? String(data.storeLng) : '',
        );
        setAndroidAppLink((data.androidAppLink || '').trim());
        setIosAppLink((data.iosAppLink || '').trim());
      })
      .catch((err) => {
        if (!cancelled) {
          showToast('error', err?.response?.data?.message || 'Could not load store profile');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveHub = async (e) => {
    e.preventDefault();
    const lat = parseFloat(storeLat, 10);
    const lng = parseFloat(storeLng, 10);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      showToast('error', 'Latitude must be a number between -90 and 90');
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      showToast('error', 'Longitude must be a number between -180 and 180');
      return;
    }
    setSavingHub(true);
    try {
      await apiService.updateTenantStoreLocation({ storeLat: lat, storeLng: lng });
      showToast('success', 'Delivery hub coordinates saved');
      if (typeof refreshTenantProfile === 'function') {
        await refreshTenantProfile();
      }
      const data = await apiService.getStoreProfile();
      setProfile(data);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Failed to save coordinates');
    } finally {
      setSavingHub(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const email = supportEmail.trim();
    const phone = supportPhone.replace(/\D/g, '');
    const hours = supportHours.trim();
    if (!email) {
      showToast('error', 'Support email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('error', 'Enter a valid support email');
      return;
    }
    if (phone.length < 10) {
      showToast('error', 'Support phone must have at least 10 digits');
      return;
    }
    if (hours.length < 3) {
      showToast('error', 'Support hours are required (e.g. Mon–Sat 9 AM – 6 PM)');
      return;
    }
    setSaving(true);
    try {
      await apiService.updateTenantSupportContact({
        supportEmail: email,
        supportPhone: phone.slice(-10),
        supportHours: hours,
      });
      showToast('success', 'Support details saved');
      if (typeof refreshTenantProfile === 'function') {
        await refreshTenantProfile();
      }
      const data = await apiService.getStoreProfile();
      setProfile(data);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAppLinks = async (e) => {
    e.preventDefault();
    const android = androidAppLink.trim();
    const ios = iosAppLink.trim();
    setSavingAppLinks(true);
    try {
      await apiService.updateTenantAppLinks({
        androidAppLink: android,
        iosAppLink: ios,
      });
      showToast('success', 'App store links saved');
      if (typeof refreshTenantProfile === 'function') {
        await refreshTenantProfile();
      }
      const data = await apiService.getStoreProfile();
      setProfile(data);
      setAndroidAppLink((data.androidAppLink || '').trim());
      setIosAppLink((data.iosAppLink || '').trim());
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Failed to save app links');
    } finally {
      setSavingAppLinks(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
        <Loader2 className="animate-spin" size={32} />
        <span className="text-sm font-semibold">Loading store profile…</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-emerald-700"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div>
        <h1 className="text-3xl font-black text-[#0F2C1D] tracking-tight">Store profile</h1>
        <p className="text-slate-500 text-sm mt-1">
          Store details are read-only. Update customer support contact information below.
        </p>
      </div>

      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/80 flex items-center gap-4">
          {profile?.logo ? (
            <img src={profile.logo} alt="" className="w-16 h-16 rounded-2xl object-cover border border-slate-200" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-[#0F2C1D] text-white flex items-center justify-center text-2xl font-black">
              {(profile?.storeName || 'S').charAt(0)}
            </div>
          )}
          <div>
            <p className="font-black text-lg text-slate-900">{profile?.storeName || '—'}</p>
            <p className="text-xs font-mono text-slate-400">{profile?.tenantId || ''}</p>
            {profile?.plan && (
              <span className="mt-1 inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {profile.plan}
              </span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-5 text-sm">
          <ReadRow icon={User} label="Owner" value={profile?.ownerName} />
          <ReadRow icon={Phone} label="Store phone" value={profile?.phoneNumber ? `+91 ${profile.phoneNumber}` : ''} />
          <ReadRow icon={Mail} label="Store email" value={profile?.contactEmail} />
          <ReadRow icon={MapPin} label="Store address" value={profile?.storeAddress} />
        </div>
      </div>

      <form onSubmit={handleSaveHub} className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase tracking-widest">
          <MapPin size={18} className="text-[#0F2C1D]" />
          Delivery hub (GPS)
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Used with your MapService: customer location is the origin; these coordinates are sent as the store destination
          in <code className="text-[10px] bg-slate-100 px-1 rounded">points[]</code>. Pin your storefront or warehouse.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400">Latitude *</span>
            <input
              type="text"
              inputMode="decimal"
              value={storeLat}
              onChange={(e) => setStoreLat(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0F2C1D]/20"
              placeholder="e.g. 12.9716"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400">Longitude *</span>
            <input
              type="text"
              inputMode="decimal"
              value={storeLng}
              onChange={(e) => setStoreLng(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0F2C1D]/20"
              placeholder="e.g. 77.5946"
              required
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={savingHub}
          className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black text-sm uppercase tracking-widest hover:bg-[#0F2C1D] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {savingHub ? <Loader2 className="animate-spin" size={18} /> : null}
          Save delivery hub coordinates
        </button>
      </form>

      <form onSubmit={handleSaveAppLinks} className="bg-white rounded-[28px] border border-blue-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2 text-blue-800 font-black text-sm uppercase tracking-widest">
          <Smartphone size={18} />
          Mobile app download links
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Optional. When set, your customer website shows a session popup and footer badges linking to your app.
          Leave blank to hide the promo entirely.
        </p>

        <label className="block space-y-1.5">
          <span className="text-[10px] font-black uppercase text-slate-400">Google Play Store URL</span>
          <input
            type="url"
            value={androidAppLink}
            onChange={(e) => setAndroidAppLink(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="https://play.google.com/store/apps/details?id=..."
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[10px] font-black uppercase text-slate-400">Apple App Store URL</span>
          <input
            type="url"
            value={iosAppLink}
            onChange={(e) => setIosAppLink(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="https://apps.apple.com/app/id..."
          />
        </label>

        <button
          type="submit"
          disabled={savingAppLinks}
          className="w-full py-4 rounded-2xl bg-blue-700 text-white font-black text-sm uppercase tracking-widest hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {savingAppLinks ? <Loader2 className="animate-spin" size={18} /> : null}
          Save app links
        </button>
      </form>

      <form onSubmit={handleSave} className="bg-white rounded-[28px] border border-emerald-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2 text-emerald-800 font-black text-sm uppercase tracking-widest">
          <Headphones size={18} />
          Customer support
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          These details are shown to customers on your storefront contact page. Support email and phone are required.
        </p>

        <label className="block space-y-1.5">
          <span className="text-[10px] font-black uppercase text-slate-400">Support email *</span>
          <input
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="support@yourstore.com"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[10px] font-black uppercase text-slate-400">Support phone *</span>
          <input
            type="tel"
            value={supportPhone}
            onChange={(e) => setSupportPhone(e.target.value.replace(/\D/g, '').slice(0, 12))}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="10-digit mobile"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
            <Clock size={12} /> Support hours *
          </span>
          <input
            type="text"
            value={supportHours}
            onChange={(e) => setSupportHours(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="Mon–Sat 9:00 AM – 6:00 PM"
            required
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-[#0F2C1D] text-white font-black text-sm uppercase tracking-widest hover:bg-emerald-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : null}
          Save support details
        </button>
      </form>
    </div>
  );
}

function ReadRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-slate-500" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
        <p className="font-semibold text-slate-800 leading-snug">{value}</p>
      </div>
    </div>
  );
}
