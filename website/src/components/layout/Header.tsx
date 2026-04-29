import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, MapPin, ChevronDown, User, Package, Smartphone, X, LogOut } from 'lucide-react';
import { logout } from '../../store/slices/authSlice';
import { getAddressFromCoords } from '../../api/addresses';
import type { RootState } from '../../store/store';
import AddressModal from './AddressModal';
import { useTenantBranding } from '../../context/TenantBrandingContext';

import { Headset } from 'lucide-react';

function splitBrandWords(storeName: string) {
  const words = storeName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { head: 'STORE', tail: '' };
  if (words.length === 1) {
    const w = words[0].toUpperCase();
    const mid = Math.max(1, Math.floor(w.length / 2));
    return { head: w.slice(0, mid), tail: w.slice(mid) };
  }
  return {
    head: words.slice(0, -1).join(' ').toUpperCase(),
    tail: ` ${words[words.length - 1].toUpperCase()}`,
  };
}

interface HeaderProps {
  searchValue: string;
  onSearchChange: (val: string) => void;
  onCartClick: () => void;
  onLoginClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ searchValue, onSearchChange, onCartClick, onLoginClick }) => {
  const { storeName, tagline, logo, raw } = useTenantBranding();
  const { head: brandHead, tail: brandTail } = splitBrandWords(storeName);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { totalAmount } = useSelector((state: RootState) => state.cart);
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const [location, setLocation] = useState("Detecting...");
  const [isAddrModalOpen, setIsAddrModalOpen] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const addr = await getAddressFromCoords(pos.coords.latitude, pos.coords.longitude);
        const parts = addr.split(',');
        setLocation(`${parts[0]}, ${parts[1] || ''}`);
      } catch (e) { setLocation("Set Location"); }
    }, () => setLocation("Enable Location"));

    const hasSeenModal = sessionStorage.getItem('hasSeenAppModal');
    if (!hasSeenModal) {
      const timer = setTimeout(() => setShowAppModal(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const closeAppModal = () => {
    sessionStorage.setItem('hasSeenAppModal', 'true');
    setShowAppModal(false);
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    // Clear token from localStorage
    localStorage.removeItem('token');
    dispatch(logout());
    setShowLogoutConfirm(false);
  };

  return (
    <>
      {/* --- PRODUCTION APP DOWNLOAD MODAL --- */}
      {showAppModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button
              onClick={closeAppModal}
              className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-blue-50 text-[#4b6f9e] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Smartphone size={40} strokeWidth={1.5} />
              </div>

              <h2 className="text-3xl font-black text-slate-900 italic uppercase tracking-tighter mb-3 leading-none">
                Experience {storeName}.
              </h2>
              <p className="text-slate-500 font-bold text-sm mb-8 leading-relaxed">
                Download our mobile app for faster checkout, live tracking, and exclusive offers.
              </p>

              <div className="flex flex-col gap-3">
                <a
                  href="https://play.google.com/store"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:scale-[1.03] active:scale-95 transition-transform"
                >
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                    alt="Get it on Google Play"
                    className="h-14 mx-auto"
                  />
                </a>
                <a
                  href="https://apps.apple.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:scale-[1.03] active:scale-95 transition-transform"
                >
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg"
                    alt="Download on the App Store"
                    className="h-14 mx-auto"
                  />
                </a>
              </div>

              <button
                onClick={closeAppModal}
                className="mt-8 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                Continue on Web
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-[80] bg-white/90 backdrop-blur-xl border-b border-slate-100 w-full">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-3 sm:gap-8">

          {/* LOGO */}
          <div
            className="flex items-center gap-2 sm:gap-3 group cursor-pointer shrink-0 min-w-0"
            onClick={() => navigate('/')}
          >
            {logo ? (
              <img
                src={logo}
                alt=""
                className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl object-contain border border-slate-100 bg-white shrink-0"
              />
            ) : null}
            <div className="flex flex-col min-w-0">
              <span className="text-lg sm:text-2xl font-black text-[#1e293b] tracking-[-0.05em] leading-none uppercase italic truncate">
                {brandHead}
                {brandTail ? (
                  <span className="text-[#4b6f9e]">{brandTail}</span>
                ) : null}
              </span>
              <span className="hidden sm:block text-[8px] font-black text-[#4b6f9e] tracking-[0.4em] uppercase opacity-50 group-hover:opacity-100 transition-opacity truncate">
                {tagline}
              </span>
            </div>
          </div>

          {/* LOCATION (Hidden on very small screens to save space) */}
          <div onClick={() => setIsAddrModalOpen(true)} className="hidden md:flex items-center gap-3 py-2 px-3 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer border border-transparent hover:border-slate-100 shrink-0">
            <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-[#4b6f9e]">
              <MapPin size={16} strokeWidth={3} />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-800 uppercase tracking-tighter flex items-center gap-1">Deliver to <ChevronDown size={10} /></span>
              <span className="text-[11px] font-bold text-slate-400 truncate w-24">{location}</span>
            </div>
          </div>

          {/* SEARCH */}
          <div className="flex-1 max-w-md min-w-[120px]">
            <div className="relative group">
              <Search className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#4b6f9e] transition-colors" size={16} />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder='Search...'
                className="w-full bg-slate-50 border-2 border-transparent rounded-xl sm:rounded-2xl py-2 sm:py-3 pl-9 sm:pl-14 pr-4 text-xs sm:text-sm font-bold placeholder:text-slate-300 outline-none focus:bg-white focus:border-[#4b6f9e]/20 transition-all"
              />
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center gap-2 sm:gap-6 shrink-0">
            {isAuthenticated ? (
              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  onClick={() => navigate('/orders')}
                  className="flex items-center gap-2 text-slate-800 font-black text-[10px] uppercase tracking-[0.15em] hover:text-[#4b6f9e] transition-colors"
                >
                  <Package size={18} strokeWidth={2.5} /> <span className="hidden lg:inline">Orders</span>
                </button>
                <div className="hidden sm:block h-8 w-[1px] bg-slate-100" />

                {/* {PROFILE BUTTON} */}
                <button
                  onClick={() => setShowProfile(true)}
                  className="flex items-center gap-2 bg-blue-50 hover:bg-[#4b6f9e] text-[#4b6f9e] hover:text-white px-3 py-2 rounded-xl transition-all"
                >
                  <User size={16} strokeWidth={2.5} />
                  <span className="hidden sm:block text-[10px] font-black uppercase tracking-widest">
                    Profile
                  </span>
                </button>
                <button
                  onClick={handleLogoutClick}
                  className="flex items-center gap-2 text-slate-600 hover:text-red-500 font-black text-[10px] uppercase tracking-[0.15em] transition-colors p-2 hover:bg-red-50 rounded-lg"
                  title="Logout"
                >
                  <LogOut size={16} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="flex items-center gap-2 text-slate-800 font-black text-[10px] uppercase tracking-[0.15em] hover:text-[#4b6f9e] transition-colors"
              >
                <User size={18} strokeWidth={2.5} /> <span className="hidden lg:inline">Login</span>
              </button>
            )}

            {/* {SUPPORT BUTTON} */}
            <button
              onClick={() => setShowSupport(true)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-100 hover:bg-[#4b6f9e] text-slate-600 hover:text-white flex items-center justify-center transition-all"
            >
              <Headset size={18} strokeWidth={2.5} />
            </button>

            {/* FIXED CART BUTTON HEIGHT */}
            <button
              onClick={onCartClick}
              className="bg-[#1e293b] text-white h-10 sm:h-12 px-3 sm:px-5 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-4 hover:bg-[#4b6f9e] transition-all shadow-xl shadow-slate-200 active:scale-95"
            >
              <div className="flex flex-col items-start leading-tight border-r border-white/10 pr-2 sm:pr-4">
                <span className="hidden sm:block text-[8px] font-black uppercase tracking-widest opacity-50">Basket</span>
                <span className="text-xs sm:text-sm font-black italic">₹{totalAmount.toFixed(0)}</span>
              </div>
              <ShoppingCart size={18} />
            </button>
          </div>
        </div>
      </header>
      <AddressModal isOpen={isAddrModalOpen} onClose={() => setIsAddrModalOpen(false)} />

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <h2 className="text-2xl font-black text-slate-900 mb-4 text-center">
                Confirm Logout
              </h2>
              <p className="text-slate-600 text-center mb-8 font-semibold">
                Are you sure you want to logout? You'll need to login again to continue shopping.
              </p>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-900 font-black rounded-xl transition-colors"
                >
                  Stay
                </button>
                <button
                  onClick={confirmLogout}
                  className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl transition-colors"
                >
                  Yes, Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* { PROFILE MODAL} */}
      {showProfile && (
        <div
          onClick={() => setShowProfile(false)}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 w-[90%] max-w-xs shadow-2xl animate-in zoom-in-95"
          >
            <h2 className="text-lg font-black text-slate-900 mb-4 text-center">
              Profile
            </h2>

            <div className="flex flex-col gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 font-bold">NAME</p>
                <p className="text-sm font-black text-slate-800">
                  {user?.name || 'N/A'}
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 font-bold">PHONE</p>
                <p className="text-sm font-black text-slate-800">
                  {user?.phone || 'N/A'}
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 font-bold">EMAIL</p>
                <p className="text-sm font-black text-slate-800 break-all">
                  {user?.email || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* {SUPPORT BUTTON MODAL} */}


      {showSupport && (
        <div
          onClick={() => setShowSupport(false)}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 w-[90%] max-w-xs shadow-2xl animate-in zoom-in-95"
          >
            <h2 className="text-lg font-black text-slate-900 mb-4 text-center">
              Support
            </h2>

            <div className="flex flex-col gap-3 text-center">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 font-bold">EMAIL</p>
                <a
                  href={`mailto:${raw?.supportEmail}`}
                  className="text-sm font-black text-slate-800 break-all hover:text-[#4b6f9e]"
                >
                  {raw?.supportEmail || 'N/A'}
                </a>
              </div>

              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 font-bold">PHONE</p>
                <a
                  href={`tel:${raw?.supportPhone}`}
                  className="text-sm font-black text-slate-800 hover:text-[#4b6f9e]"
                >
                  {raw?.supportPhone || 'N/A'}
                </a>
              </div>

              {raw?.supportHours && (
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 font-bold">HOURS</p>
                  <p className="text-sm font-black text-slate-800">
                    {raw.supportHours}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div >
      )}
    </>
  );
};

export default Header;