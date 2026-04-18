import React, { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import GlobalNotification from './TopBar'; 
import { useAuth } from '../../context/AuthContext';
import { LogOut, X, AlertTriangle, Store, Phone, Mail, MapPin, ChevronRight, ShieldOff } from 'lucide-react';
import { apiService } from '../../services/apiService';

const PLAN_COLORS = {
  FREE:       'bg-gray-100 text-gray-600',
  BASIC:      'bg-blue-100 text-blue-700',
  PREMIUM:    'bg-purple-100 text-purple-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
};

/* ── Full-page suspended screen ── */
const SuspendedScreen = ({ superAdminEmail, onLogout }) => (
  <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center p-6">
    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
      <div className="bg-gradient-to-r from-red-500 to-rose-600 px-8 py-10 text-center">
        <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldOff size={40} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-white">Account Suspended</h1>
        <p className="text-red-100 text-sm mt-1">Your store has been temporarily suspended</p>
      </div>
      <div className="px-8 py-8 space-y-5 text-center">
        <p className="text-gray-600 text-sm leading-relaxed">
          Access to your admin dashboard has been restricted by the super administrator.
          Please contact support to resolve this issue and restore your account.
        </p>
        {superAdminEmail && (
          <a
            href={`mailto:${superAdminEmail}`}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold text-sm hover:bg-red-100 transition-colors"
          >
            <Mail size={16} />
            Contact Super Admin: {superAdminEmail}
          </a>
        )}
        <p className="text-xs text-gray-400">
          If you believe this is a mistake, email us with your Store ID and we'll investigate promptly.
        </p>
        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50 transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </div>
  </div>
);

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal]   = useState(false);
  const [showProfile, setShowProfile]           = useState(false);
  const [storeProfile, setStoreProfile]         = useState(null);
  const [profileLoading, setProfileLoading]     = useState(false);
  const [suspended, setSuspended]               = useState(false);
  const [superAdminEmail, setSuperAdminEmail]   = useState('');
  const panelRef = useRef(null);

  // Check account suspension on mount
  useEffect(() => {
    apiService.getAccountStatus()
      .then((data) => {
        if (data?.suspended) {
          setSuspended(true);
          setSuperAdminEmail(data.superAdminEmail || '');
        }
      })
      .catch((err) => {
        // axios error: check response body for suspended flag
        const body = err?.response?.data;
        if (body?.suspended) {
          setSuspended(true);
          setSuperAdminEmail(body.superAdminEmail || '');
        }
      });
  }, []);

  // Fetch store profile when panel opens
  useEffect(() => {
    if (!showProfile) return;
    setProfileLoading(true);
    apiService.getStoreProfile()
      .then((data) => setStoreProfile(data))
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [showProfile]);

  // Close panel on outside click
  useEffect(() => {
    if (!showProfile) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProfile]);

  const initials = storeProfile?.storeName?.charAt(0)?.toUpperCase()
    || user?.name?.charAt(0)?.toUpperCase()
    || 'A';

  // Show suspended screen instead of the dashboard
  if (suspended) {
    return <SuspendedScreen superAdminEmail={superAdminEmail} onLogout={logout} />;
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAF8]">
      <Sidebar />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* TOP BAR */}
        <header className="h-20 px-8 flex items-center justify-end gap-4 bg-white/80 backdrop-blur-md border-b border-gray-100 shrink-0">
          
          <div className="mr-auto hidden md:block">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">FreshRoot Logistics Control</p>
          </div>

          <GlobalNotification />

          {/* PROFILE BUBBLE — clickable */}
          <button
            onClick={() => setShowProfile((v) => !v)}
            className="flex items-center gap-3 pl-4 border-l border-gray-100 hover:opacity-80 transition-opacity focus:outline-none"
            title="View store profile"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-gray-900 leading-none">
                {storeProfile?.storeName || user?.name || 'System Admin'}
              </p>
              <p className="text-[10px] font-bold text-emerald-600 uppercase">
                {user?.role || 'Administrator'}
              </p>
            </div>
            {storeProfile?.logo ? (
              <img
                src={storeProfile.logo}
                alt="store logo"
                className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-green-900/20"
              />
            ) : (
              <div className="w-10 h-10 bg-[#0F2C1D] rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-900/20">
                <span className="font-black">{initials}</span>
              </div>
            )}
            <ChevronRight size={14} className={`text-gray-400 transition-transform duration-200 ${showProfile ? 'rotate-90' : ''}`} />
          </button>

          {/* LOGOUT BUTTON */}
          <button 
            onClick={() => setShowLogoutModal(true)}
            className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all duration-300 group shadow-sm"
            title="Secure Logout"
          >
            <LogOut size={20} className="group-hover:scale-110 transition-transform" />
          </button>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── STORE PROFILE PANEL ── */}
      {showProfile && (
        <div
          ref={panelRef}
          className="fixed top-20 right-4 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <Store size={15} className="text-emerald-600" />
              Store Profile
            </div>
            <button onClick={() => setShowProfile(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
              <X size={15} />
            </button>
          </div>

          {profileLoading ? (
            <div className="py-10 flex flex-col items-center gap-2 text-gray-400">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : storeProfile ? (
            <div className="p-4 space-y-4">
              {/* Logo + name */}
              <div className="flex items-center gap-3">
                {storeProfile.logo ? (
                  <img src={storeProfile.logo} alt="logo" className="w-14 h-14 rounded-xl object-cover border border-gray-100" />
                ) : (
                  <div className="w-14 h-14 bg-[#0F2C1D] rounded-xl flex items-center justify-center text-white text-xl font-black">
                    {storeProfile.storeName?.charAt(0) || 'S'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 text-sm truncate">{storeProfile.storeName || '—'}</p>
                  <p className="text-xs text-gray-400 font-mono truncate">{storeProfile.tenantId}</p>
                  <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${PLAN_COLORS[storeProfile.plan] || PLAN_COLORS.FREE}`}>
                    {storeProfile.plan || 'FREE'}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2.5 text-sm">
                {storeProfile.ownerName && (
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Store size={13} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">Owner</p>
                      <p className="text-gray-800 font-semibold">{storeProfile.ownerName}</p>
                    </div>
                  </div>
                )}
                {storeProfile.phoneNumber && (
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Phone size={13} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">Phone</p>
                      <p className="text-gray-800 font-semibold">{storeProfile.phoneNumber}</p>
                    </div>
                  </div>
                )}
                {storeProfile.contactEmail && (
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail size={13} className="text-purple-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">Email</p>
                      <p className="text-gray-800 font-semibold break-all">{storeProfile.contactEmail}</p>
                    </div>
                  </div>
                )}
                {storeProfile.storeAddress && (
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin size={13} className="text-amber-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">Address</p>
                      <p className="text-gray-800 font-semibold leading-snug">{storeProfile.storeAddress}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Divider + admin user info */}
              <div className="pt-3 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
                <span>Logged in as <span className="font-bold text-gray-600">{user?.role || 'Admin'}</span></span>
                <span className="font-mono">{user?.phoneNumber || ''}</span>
              </div>
            </div>
          ) : (
            <div className="py-8 px-4 text-center text-xs text-gray-400">
              Could not load store details.
            </div>
          )}
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Confirm Logout</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                Are you sure you want to end your session? You will need to login again to access the dashboard.
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setShowLogoutModal(false)}
                  className="py-3 px-6 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors text-sm"
                >
                  Stay Here
                </button>
                <button 
                  onClick={logout}
                  className="py-3 px-6 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 text-sm"
                >
                  Yes, Logout
                </button>
              </div>
            </div>
            
            <button 
              onClick={() => setShowLogoutModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLayout;