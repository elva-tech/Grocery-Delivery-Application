import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Search,
  MapPin,
  ChevronDown,
  User,
  Package,
  Smartphone,
  X,
  LogOut,
  Plus,
  Loader2,
  Headset,
} from 'lucide-react';
import { logout } from '../../store/slices/authSlice';
import { getAddressFromCoords, getAddresses } from '../../api/addresses';
import { requestPrecisePosition } from '../../utils/geolocation';
import type { RootState } from '../../store/store';
import AddressModal from './AddressModal';
import { useTenantBranding } from '../../context/TenantBrandingContext';
import { WEB_COPY } from '../../constants/copy';

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
  /** Currently chosen delivery address (drives subtitle when set). */
  selectedDeliveryAddress?: Record<string, unknown> | null;
  /** Persist selection + refresh delivery check (from App). */
  onSelectDeliveryAddress?: (addr: Record<string, unknown>) => void;
}

function deliverSubtitle(addr: Record<string, unknown> | null | undefined): string | null {
  if (!addr) return null;
  const full = String(addr.full ?? '').trim();
  const line1 = String(addr.line1 ?? '').trim();
  const landmark = String(addr.landmark ?? '').trim();
  const city = String(addr.city ?? '').trim();
  const label = String(addr.label ?? '').trim();
  const parts = [line1, landmark, city].filter(Boolean).join(', ');
  const raw = full || parts || label;
  if (!raw) return null;
  return raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;
}

const Header: React.FC<HeaderProps> = ({
  searchValue,
  onSearchChange,
  onCartClick,
  onLoginClick,
  selectedDeliveryAddress = null,
  onSelectDeliveryAddress,
}) => {
  const { storeName, tagline, logo } = useTenantBranding();
  const { head: brandHead, tail: brandTail } = splitBrandWords(storeName);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { totalAmount } = useSelector((state: RootState) => state.cart);
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const [location, setLocation] = useState("Detecting...");
  const [isAddrModalOpen, setIsAddrModalOpen] = useState(false);
  const [addressModalStartWithMap, setAddressModalStartWithMap] = useState(false);
  const [deliverPickerOpen, setDeliverPickerOpen] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<Record<string, unknown>[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { lat, lng } = await requestPrecisePosition({ highAccuracyTimeoutMs: 18000 });
        if (cancelled) return;
        const addr = await getAddressFromCoords(lat, lng);
        const parts = addr.split(',');
        setLocation(`${parts[0]}, ${parts[1] || ''}`);
      } catch {
        if (!cancelled) setLocation('Enable Location');
      }
    })();

    const hasSeenModal = sessionStorage.getItem('hasSeenAppModal');
    let modalTimer: ReturnType<typeof setTimeout> | undefined;
    if (!hasSeenModal) {
      modalTimer = setTimeout(() => setShowAppModal(true), 2000);
    }
    return () => {
      cancelled = true;
      if (modalTimer) clearTimeout(modalTimer);
    };
  }, []);

  useEffect(() => {
    if (!deliverPickerOpen || !isAuthenticated) return;
    let cancelled = false;
    setAddressesLoading(true);
    void getAddresses()
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setSavedAddresses(list);
      })
      .catch(() => {
        if (!cancelled) setSavedAddresses([]);
      })
      .finally(() => {
        if (!cancelled) setAddressesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deliverPickerOpen, isAuthenticated]);

  const selfSavedAddresses = useMemo(
    () => savedAddresses.filter((a) => a.isMyAddress !== false),
    [savedAddresses],
  );

  const deliverLine = deliverSubtitle(selectedDeliveryAddress) || location;

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

  const handleOpenDeliverPicker = () => {
    if (!isAuthenticated) {
      onLoginClick();
      return;
    }
    setDeliverPickerOpen(true);
  };

  const handleCloseAddressModal = () => {
    setIsAddrModalOpen(false);
    setAddressModalStartWithMap(false);
  };

  const handleSelectSavedAddress = (addr: Record<string, unknown>) => {
    setDeliverPickerOpen(false);
    onSelectDeliveryAddress?.(addr);
  };

  const handleAddNewAddressFromPicker = () => {
    setDeliverPickerOpen(false);
    setAddressModalStartWithMap(true);
    setIsAddrModalOpen(true);
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
                {WEB_COPY.header.appPromoTitlePrefix} {storeName} {WEB_COPY.header.appPromoTitleSuffix}
              </h2>
              <p className="text-slate-500 font-bold text-sm mb-8 leading-relaxed">
                {WEB_COPY.header.appPromoDescription}
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
                {WEB_COPY.header.continueOnWebsite}
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
              {tagline ? (
                <span className="hidden sm:block text-[8px] font-black text-[#4b6f9e] tracking-[0.4em] uppercase opacity-50 group-hover:opacity-100 transition-opacity truncate">
                  {tagline}
                </span>
              ) : null}
            </div>
          </div>

          {/* LOCATION (Hidden on very small screens to save space) */}
          <button
            type="button"
            onClick={handleOpenDeliverPicker}
            className="flex items-center gap-2 sm:gap-3 py-2 px-2 sm:px-3 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer border border-transparent hover:border-slate-100 shrink-0 text-left min-w-0"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-slate-100 rounded-xl flex items-center justify-center text-[#4b6f9e] shrink-0">
              <MapPin size={16} strokeWidth={3} />
            </div>
            <div className="hidden sm:flex flex-col min-w-0">
              <span className="text-[9px] font-black text-slate-800 uppercase tracking-tighter flex items-center gap-1">
                Deliver to <ChevronDown size={10} />
              </span>
              <span
                className="text-[11px] font-bold text-slate-400 truncate max-w-[5.5rem] sm:max-w-[9rem] lg:max-w-[11rem]"
                title={deliverLine}
              >
                {deliverLine}
              </span>
            </div>
          </button>

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
                <span className="hidden sm:block text-[8px] font-black uppercase tracking-widest opacity-50">{WEB_COPY.header.cartLabel}</span>
                <span className="text-xs sm:text-sm font-black italic">₹{totalAmount.toFixed(0)}</span>
              </div>
              <ShoppingCart size={18} />
            </button>
          </div>
        </div>
      </header>
      {deliverPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="deliver-picker-title"
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setDeliverPickerOpen(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <h2 id="deliver-picker-title" className="text-xl font-black text-[#1e293b] uppercase italic tracking-tight">
                Deliver to
              </h2>
              <button
                type="button"
                onClick={() => setDeliverPickerOpen(false)}
                className="p-2 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className="px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest pb-4">
              Choose a saved address or add a new one
            </p>

            <div className="max-h-[min(50vh,360px)] overflow-y-auto px-6 pb-2">
              {addressesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-[#4b6f9e]" size={28} />
                </div>
              ) : selfSavedAddresses.length === 0 ? (
                <p className="text-center py-8 text-sm font-semibold text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                  No saved addresses yet.
                </p>
              ) : (
                <ul className="space-y-2 pb-2">
                  {selfSavedAddresses.map((addr) => {
                    const id = String(addr.id ?? '');
                    const label = String(addr.label ?? 'Address');
                    const summary =
                      String(addr.full ?? '').trim() ||
                      [addr.line1, addr.city].filter(Boolean).join(', ');
                    return (
                      <li key={id || summary}>
                        <button
                          type="button"
                          onClick={() => handleSelectSavedAddress(addr)}
                          className="w-full text-left p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-[#4b6f9e]/40 hover:bg-blue-50/50 transition-all"
                        >
                          <p className="text-xs font-black text-[#1e293b] uppercase tracking-wide">{label}</p>
                          <p className="text-[11px] font-semibold text-slate-500 mt-1 line-clamp-2">{summary || 'Tap to use'}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="p-6 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleAddNewAddressFromPicker}
                className="w-full py-4 rounded-2xl bg-[#1e293b] text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#4b6f9e] transition-colors"
              >
                <Plus size={18} strokeWidth={2.5} />
                Add new address
              </button>
            </div>
          </div>
        </div>
      )}

      <AddressModal
        isOpen={isAddrModalOpen}
        onClose={handleCloseAddressModal}
        startWithMap={addressModalStartWithMap}
        onAddressSaved={(addr) => onSelectDeliveryAddress?.(addr)}
      />

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <h2 className="text-2xl font-black text-slate-900 mb-4 text-center">{WEB_COPY.header.confirmLogoutTitle}</h2>
              <p className="text-slate-600 text-center mb-8 font-semibold">
                {WEB_COPY.header.confirmLogoutDescription}
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
                  {WEB_COPY.header.confirmLogoutAction}
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
                <p className="text-sm font-black text-slate-800 break-all">
                  support@yourapp.com
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 font-bold">PHONE</p>
                <p className="text-sm font-black text-slate-800">
                  +91 9876543210
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;