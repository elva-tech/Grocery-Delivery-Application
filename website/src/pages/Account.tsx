import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { RootState } from '../store/store';
import { updateUser } from '../store/slices/authSlice';
import { updateProfile } from '../api/authApi';
import { useToast } from '../context/ToastContext';

function formatPhone(phone?: string) {
  return String(phone || '').replace(/^\+91\s?/, '').replace(/\D/g, '').slice(-10);
}

type AccountProps = {
  onLogin: () => void;
};

const Account = ({ onLogin }: AccountProps) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { showToast } = useToast();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [alternatePhone, setAlternatePhone] = useState(
    String(user?.alternatePhone || '').replace(/\D/g, '').slice(0, 10)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      onLogin();
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate, onLogin]);

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setAlternatePhone(String(user?.alternatePhone || '').replace(/\D/g, '').slice(0, 10));
  }, [user]);

  const canSave = useMemo(() => {
    if (name.trim().length < 2) return false;
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return false;
    return true;
  }, [name, email]);

  const handleSave = async () => {
    if (!canSave) {
      showToast('error', 'Enter a valid name and email');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        alternatePhone: alternatePhone.trim(),
      };
      const res = await updateProfile(payload);
      const apiUser = res.user;
      const patch = {
        name: apiUser?.name ?? payload.name,
        email: apiUser?.email ?? payload.email,
        alternatePhone: apiUser?.alternatePhone ?? payload.alternatePhone,
      };
      dispatch(updateUser(patch));
      showToast('success', 'Account details updated');
      navigate('/profile');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="max-w-lg mx-auto pb-24 animate-in fade-in duration-300">
      <button
        type="button"
        onClick={() => navigate('/profile')}
        className="mb-6 flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-[#4b6f9e] transition-colors"
      >
        <ArrowLeft size={16} />
        Back to profile
      </button>

      <h1 className="text-3xl font-black italic tracking-tighter uppercase text-slate-900 mb-6">
        Account Details
      </h1>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Mobile Number</p>
        <p className="text-lg font-black text-slate-900">+91 {formatPhone(user?.phone) || '—'}</p>
        <p className="text-xs text-slate-400 mt-2 font-semibold">
          Mobile number is verified and cannot be edited.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <p className="text-sm font-black text-slate-900">Profile Information</p>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Enter your full name"
            className="mt-1.5 w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800 outline-none focus:border-[#4b6f9e]/40 focus:bg-white"
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1.5 w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800 outline-none focus:border-[#4b6f9e]/40 focus:bg-white"
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alternate Phone</label>
          <input
            type="tel"
            value={alternatePhone}
            onChange={(e) => setAlternatePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="Optional"
            className="mt-1.5 w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800 outline-none focus:border-[#4b6f9e]/40 focus:bg-white"
          />
        </div>

      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave || saving}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg h-14 rounded-2xl bg-[#1e293b] hover:bg-[#4b6f9e] text-white font-black text-sm uppercase tracking-widest disabled:opacity-60 flex items-center justify-center gap-2 shadow-xl"
      >
        {saving ? <Loader2 className="animate-spin" size={20} /> : 'Save Changes'}
      </button>
    </div>
  );
};

export default Account;
