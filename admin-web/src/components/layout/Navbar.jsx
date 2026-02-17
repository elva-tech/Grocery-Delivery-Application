import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { APP_CONFIG } from '../../config/appConfig';
import { LogOut, User, Bell } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();

  const handleLogout = (e) => {
    e.preventDefault();
    logout();
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider md:hidden">
          {APP_CONFIG.brand.name}
        </h2>
      </div>

      <div className="flex items-center gap-6">
        <button className="text-gray-400 hover:text-emerald-600 transition-colors">
          <Bell size={20} />
        </button>
        
        <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-gray-800">{user?.name || 'System Admin'}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role || 'Admin'}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold border border-emerald-200">
            {user?.name?.charAt(0) || 'A'}
          </div>
          <button 
            onClick={handleLogout}
            className="ml-2 p-2 text-gray-400 hover:text-red-500 transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;