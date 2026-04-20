import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import GlobalNotification from './TopBar';
import { useAuth } from '../../context/AuthContext';
import { LogOut, X, AlertTriangle, Mail, ChevronRight, ShieldOff } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useTenantBranding } from '../../context/TenantBrandingContext';

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
  const navigate = useNavigate();
  const { logisticsLabel, storeName, logo: brandLogo } = useTenantBranding();
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [superAdminEmail, setSuperAdminEmail] = useState('');

  useEffect(() => {
    apiService
      .getAccountStatus()
      .then((data) => {
        if (data?.suspended) {
          setSuspended(true);
          setSuperAdminEmail(data.superAdminEmail || '');
        }
      })
      .catch((err) => {
        const body = err?.response?.data;
        if (body?.suspended) {
          setSuspended(true);
          setSuperAdminEmail(body.superAdminEmail || '');
        }
      });
  }, []);

  const initials =
    storeName?.charAt(0)?.toUpperCase() ||
    user?.name?.charAt(0)?.toUpperCase() ||
    'A';

  if (suspended) {
    return <SuspendedScreen superAdminEmail={superAdminEmail} onLogout={logout} />;
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAF8]">
      <Sidebar />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 px-8 flex items-center justify-end gap-4 bg-white/80 backdrop-blur-md border-b border-gray-100 shrink-0">
          <div className="mr-auto hidden md:block">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {logisticsLabel} control
            </p>
          </div>

          <GlobalNotification />

          <button
            type="button"
            onClick={() => navigate('/store-profile')}
            className="flex items-center gap-3 pl-4 border-l border-gray-100 hover:opacity-80 transition-opacity focus:outline-none"
            title="Open store profile"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-gray-900 leading-none">
                {storeName || user?.name || 'System Admin'}
              </p>
              <p className="text-[10px] font-bold text-emerald-600 uppercase">
                {user?.role || 'Administrator'}
              </p>
            </div>
            {brandLogo ? (
              <img
                src={brandLogo}
                alt="store logo"
                className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-green-900/20"
              />
            ) : (
              <div className="w-10 h-10 bg-[#0F2C1D] rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-900/20">
                <span className="font-black">{initials}</span>
              </div>
            )}
            <ChevronRight size={14} className="text-gray-400" />
          </button>

          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all duration-300 group shadow-sm"
            title="Secure Logout"
          >
            <LogOut size={20} className="group-hover:scale-110 transition-transform" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {showLogoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 relative">
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
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="py-3 px-6 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors text-sm"
                >
                  Stay Here
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="py-3 px-6 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 text-sm"
                >
                  Yes, Logout
                </button>
              </div>
            </div>

            <button
              type="button"
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
