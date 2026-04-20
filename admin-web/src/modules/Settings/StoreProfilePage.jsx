import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, User, Clock, Headphones, Loader2 } from 'lucide-react';
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
