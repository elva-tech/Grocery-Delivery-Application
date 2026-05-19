import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowLeft, Loader2, MapPin, Plus } from 'lucide-react';
import type { RootState } from '../store/store';
import { getAddresses } from '../api/addresses';
import AddressModal from '../components/layout/AddressModal';
import { formatAddressSummary } from '../utils/indiaPincode';

type SavedAddressesProps = {
  onLogin: () => void;
};

const SavedAddresses = ({ onLogin }: SavedAddressesProps) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [addresses, setAddresses] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = (await getAddresses()) as Record<string, unknown>[];
      setAddresses(Array.isArray(data) ? data.filter((a) => a.isMyAddress !== false) : []);
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      onLogin();
      navigate('/', { replace: true });
      return;
    }
    void load();
  }, [isAuthenticated, navigate, onLogin]);

  if (!isAuthenticated) return null;

  return (
    <div className="max-w-lg mx-auto pb-16 animate-in fade-in duration-300">
      <button
        type="button"
        onClick={() => navigate('/profile')}
        className="mb-6 flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-[#4b6f9e] transition-colors"
      >
        <ArrowLeft size={16} />
        Back to profile
      </button>

      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase text-slate-900">
            Saved Addresses
          </h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
            Manage delivery locations
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1e293b] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#4b6f9e] transition-colors"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="animate-spin text-[#4b6f9e]" size={32} />
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <MapPin className="mx-auto text-slate-300 mb-3" size={32} />
          <p className="text-sm font-bold text-slate-500">No saved addresses yet</p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="mt-4 text-[#4b6f9e] font-black text-xs uppercase tracking-widest hover:underline"
          >
            Add your first address
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {addresses.map((addr) => {
            const id = String(addr.id ?? '');
            const label = String(addr.label ?? 'Address');
            const summary =
              String(addr.full ?? '').trim() ||
              formatAddressSummary(addr as Parameters<typeof formatAddressSummary>[0]) ||
              [addr.line1, addr.city].filter(Boolean).join(', ');
            return (
              <li
                key={id || summary}
                className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm"
              >
                <p className="text-xs font-black text-slate-800 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-semibold text-slate-500 mt-1 leading-snug">{summary || '—'}</p>
              </li>
            );
          })}
        </ul>
      )}

      <AddressModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddressSaved={() => {
          setIsModalOpen(false);
          void load();
        }}
      />
    </div>
  );
};

export default SavedAddresses;
