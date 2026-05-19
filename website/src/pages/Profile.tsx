import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  User,
  ShoppingCart,
  Package,
  MapPin,
  Headset,
  FileText,
  Shield,
  RefreshCw,
  HelpCircle,
  Info,
  LogOut,
  ChevronRight,
  Pencil,
  ShieldCheck,
} from 'lucide-react';
import type { RootState } from '../store/store';
import { logout } from '../store/slices/authSlice';
import { clearCart } from '../store/slices/cartSlice';
import { useTenantBranding } from '../context/TenantBrandingContext';

function formatPhone(phone?: string) {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  return digits || '—';
}

type MenuItem = {
  icon: React.ElementType;
  label: string;
  subtitle?: string;
  badge?: number;
  onClick: () => void;
};

type ProfileProps = {
  openCart: () => void;
  onLogin: () => void;
};

const Profile = ({ openCart, onLogin }: ProfileProps) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const { items } = useSelector((state: RootState) => state.cart);
  const { storeName, raw } = useTenantBranding();

  const supportEmail = raw?.supportEmail?.trim() || raw?.contactEmail?.trim() || '';
  const supportPhone = raw?.supportPhone?.trim() || raw?.phoneNumber?.trim() || '';

  useEffect(() => {
    if (!isAuthenticated) {
      onLogin();
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate, onLogin]);

  if (!isAuthenticated) return null;

  const handleLogout = () => {
    dispatch(logout());
    dispatch(clearCart());
    navigate('/', { replace: true });
  };

  const menuItems: MenuItem[] = [
    {
      icon: User,
      label: 'Account Details',
      subtitle: user?.email || `+91 ${formatPhone(user?.phone)}`,
      onClick: () => navigate('/account'),
    },
    {
      icon: ShoppingCart,
      label: 'Cart',
      badge: items?.length || 0,
      onClick: openCart,
    },
    {
      icon: Package,
      label: 'Order History',
      onClick: () => navigate('/orders'),
    },
    {
      icon: MapPin,
      label: 'Saved Addresses',
      onClick: () => navigate('/saved-addresses'),
    },
    {
      icon: Headset,
      label: 'Customer Support',
      subtitle: supportEmail || supportPhone || undefined,
      onClick: () => navigate('/contact'),
    },
    { icon: FileText, label: 'Terms & Conditions', onClick: () => navigate('/terms') },
    { icon: Shield, label: 'Privacy Policy', onClick: () => navigate('/privacy') },
    { icon: RefreshCw, label: 'Refund Policy', onClick: () => navigate('/refund') },
    { icon: HelpCircle, label: 'FAQs', onClick: () => navigate('/faqs') },
    { icon: Info, label: 'About Us', onClick: () => navigate('/about') },
  ];

  return (
    <div className="max-w-lg mx-auto pb-16 animate-in fade-in duration-300">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-6 flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-[#4b6f9e] transition-colors"
      >
        ← Back to shop
      </button>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 mb-5 text-center">
        <div className="w-24 h-24 mx-auto rounded-full bg-[#4b6f9e] flex items-center justify-center text-white text-3xl font-black">
          {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <h1 className="text-2xl font-black text-slate-900">{user?.name || 'Guest User'}</h1>
          <button
            type="button"
            onClick={() => navigate('/account')}
            className="p-1.5 rounded-lg text-[#4b6f9e] hover:bg-blue-50"
            aria-label="Edit account"
          >
            <Pencil size={16} />
          </button>
        </div>

        <p className="text-slate-500 font-semibold mt-1">+91 {formatPhone(user?.phone)}</p>

        <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full bg-blue-50 text-[#4b6f9e] text-xs font-bold">
          <ShieldCheck size={14} />
          Verified Member
        </div>

        <button
          type="button"
          onClick={() => navigate('/account')}
          className="mt-5 w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:border-[#4b6f9e]/30 transition-colors text-left"
        >
          <User size={16} className="text-[#4b6f9e] shrink-0" />
          <span className="text-sm font-semibold text-slate-700 flex-1">View & edit account details</span>
          <ChevronRight size={16} className="text-slate-400" />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-5">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={`w-full flex items-center justify-between px-4 py-4 hover:bg-slate-50 transition-colors text-left ${
                index < menuItems.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Icon size={20} className="text-[#4b6f9e]" />
                </div>
                <div className="min-w-0 pt-1">
                  <p className="text-sm font-bold text-slate-800">{item.label}</p>
                  {item.subtitle && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-2">
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="min-w-[24px] h-6 px-2 rounded-full bg-[#4b6f9e] text-white text-xs font-black flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
                <ChevronRight size={18} className="text-slate-300" />
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 font-black text-sm hover:bg-red-100 transition-colors"
      >
        <LogOut size={20} />
        Logout
      </button>

      <div className="text-center mt-10 space-y-1">
        <p className="text-sm font-semibold text-slate-500">{storeName}</p>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} {storeName}</p>
      </div>
    </div>
  );
};

export default Profile;
