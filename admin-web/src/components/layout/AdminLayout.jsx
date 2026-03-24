import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import GlobalNotification from './TopBar'; 
import { useAuth } from '../../context/AuthContext';
import { LogOut, X, AlertTriangle } from 'lucide-react'; // Added icons

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false); // Modal State

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

          {/* 1. SEPARATE PROFILE BUBBLE */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-100">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-gray-900 leading-none">
                {user?.name || 'System Admin'}
              </p>
              <p className="text-[10px] font-bold text-emerald-600 uppercase">
                {user?.role || 'Administrator'}
              </p>
            </div>
            <div className="w-10 h-10 bg-[#0F2C1D] rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-900/20">
              <span className="font-black">{user?.name?.charAt(0) || 'A'}</span>
            </div>
          </div>

          {/* 2. SEPARATE LOGOUT BUTTON */}
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

      {/* 3. CUSTOM LOGOUT CONFIRMATION MODAL */}
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