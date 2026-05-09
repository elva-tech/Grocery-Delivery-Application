import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Plus, ArrowLeft, Loader2, CheckCircle2,
  Gift, User, Users, X, Phone, UserCircle, Pencil,
} from 'lucide-react';
import { addAddress, getAddresses } from '../api/addresses';
import AddressModal from '../components/layout/AddressModal';
import { useToast } from '../context/ToastContext';
import {
  formatAddressSummary,
  geocodeApproxFromIndianPincode,
  isValidIndianPincode,
  lookupIndianPincode,
  sanitizeIndianPincode,
} from '../utils/indiaPincode';

const Addresses = ({ items, onSelect }: any) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderMode, setOrderMode] = useState<'self' | 'others'>('self');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any | null>(null);
  const [showOthersModal, setShowOthersModal] = useState(false);
  const [othersPinLoading, setOthersPinLoading] = useState(false);

  const [othersForm, setOthersForm] = useState({
    recipientName: '',
    recipientPhone: '',
    line1: '',
    line2: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    note: '',
  });
  const [othersConfirmed, setOthersConfirmed] = useState(false);
  const [savedOthersAddress, setSavedOthersAddress] = useState<any | null>(null);
  const selfAddresses = useMemo(
    () => addresses.filter((addr) => addr.isMyAddress !== false),
    [addresses]
  );

  const totalAmount = useMemo(() => {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
      const price = item.price || 0;
      const qty = item.quantity || item.qty || 1;
      return sum + (price * qty);
    }, 0);
  }, [items]);

  const fetchAddresses = async () => {
    setLoading(true);
    const data = await getAddresses() as any[];
    setAddresses(data);
    if (data.length > 0 && !selectedId) {
      const firstSelf = data.find((addr: any) => addr.isMyAddress !== false);
      setSelectedId((firstSelf || data[0]).id);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAddresses();
  }, [items]);

  const applyOthersPin = async (pinRaw: string) => {
    const p = sanitizeIndianPincode(pinRaw);
    if (p.length !== 6) return;
    if (!isValidIndianPincode(p)) {
      showToast('error', 'Invalid Indian PIN code.');
      return;
    }
    setOthersPinLoading(true);
    const r = await lookupIndianPincode(p);
    setOthersPinLoading(false);
    if (!r.ok) {
      showToast('error', 'PIN code not found. Enter a valid Indian PIN.');
      return;
    }
    setOthersForm(prev => ({ ...prev, pincode: r.pincode, city: r.city, state: r.state }));
  };

  const handleFinalConfirm = () => {
    if (orderMode === 'self') {
      const selected = selfAddresses.find(a => a.id === selectedId);
      if (!selected) return;
      onSelect(selected);
    } else {
      onSelect(
        savedOthersAddress || {
          id: 'others',
          label: `For ${othersForm.recipientName}`,
          isMyAddress: false,
          recipientName: othersForm.recipientName,
          recipientPhone: othersForm.recipientPhone,
          line1: othersForm.line1,
          line2: othersForm.line2,
          landmark: othersForm.landmark,
          city: othersForm.city,
          state: othersForm.state,
          pincode: othersForm.pincode,
          full: formatAddressSummary(othersForm),
          phone: othersForm.recipientPhone,
          lat: 0,
          lng: 0,
        },
      );
    }
    navigate('/checkout');
  };

  const othersSummaryText = formatAddressSummary(othersForm);

  return (
    <div className="max-w-2xl mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-40">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 mb-10 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-[#4b6f9e]">
        <ArrowLeft size={16} /> Back to Shop
      </button>

      <div className="mb-8">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900">Delivery</h1>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Select your delivery point</p>
      </div>

      <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
        <button
          type="button"
          onClick={() => setOrderMode('self')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${orderMode === 'self' ? 'bg-white shadow-sm text-[#4b6f9e]' : 'text-slate-500'}`}
        >
          <User size={14} /> For Myself
        </button>
        <button
          type="button"
          onClick={() => (othersConfirmed ? setOrderMode('others') : setShowOthersModal(true))}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${orderMode === 'others' ? 'bg-white shadow-sm text-[#4b6f9e]' : 'text-slate-500'}`}
        >
          <Users size={14} /> For Someone Else
        </button>
      </div>

      <div className="space-y-4">
        {orderMode === 'self' ? (
          <>
            <div className="flex justify-between items-center px-2 mb-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Saved Addresses</span>
              <button
                type="button"
                onClick={() => {
                  setEditingAddress(null);
                  setIsModalOpen(true);
                }}
                className="w-10 h-10 bg-[#4b6f9e] text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-[#3a5a82] transition-colors"
                title="Add address"
              >
                <Plus size={20}/>
              </button>
            </div>
            {loading ? (
              <Loader2 className="animate-spin mx-auto mt-10 text-slate-300" />
            ) : (
              selfAddresses.length > 0 ? (
                selfAddresses.map((addr) => (
                  <div
                    key={addr.id}
                    className={`w-full bg-white p-4 sm:p-6 rounded-[2rem] border-2 transition-all flex items-stretch gap-2 sm:gap-4 ${
                      selectedId === addr.id ? 'border-[#4b6f9e] shadow-xl' : 'border-slate-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(addr.id)}
                      className="flex-1 min-w-0 flex items-center gap-4 text-left"
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${selectedId === addr.id ? 'bg-blue-50 text-[#4b6f9e]' : 'bg-slate-50 text-slate-400'}`}>
                        <MapPin size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-slate-800 uppercase">{addr.label}</p>
                        <p className="text-slate-500 font-medium text-sm line-clamp-2">{formatAddressSummary(addr)}</p>
                        <p className="text-slate-400 text-[10px] font-black mt-1">📞 {addr.phone}</p>
                      </div>
                      {selectedId === addr.id && <CheckCircle2 size={24} className="text-[#4b6f9e] shrink-0 self-center" />}
                    </button>
                    <button
                      type="button"
                      title="Edit address"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingAddress(addr);
                        setIsModalOpen(true);
                      }}
                      className="shrink-0 self-center p-3 rounded-2xl border-2 border-slate-100 text-[#4b6f9e] hover:bg-blue-50 hover:border-[#4b6f9e]/30 transition-colors"
                    >
                      <Pencil size={18} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-400 font-bold text-xs uppercase">No saved addresses found</div>
              )
            )}
          </>
        ) : (
          othersConfirmed && (
            <div className="w-full bg-white p-6 rounded-[2rem] border-2 border-[#4b6f9e] shadow-xl flex items-center gap-4 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#4b6f9e] flex items-center justify-center">
                <Gift size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-slate-800 uppercase italic leading-none mb-1">Gift Order for {othersForm.recipientName}</p>
                <p className="text-slate-500 font-medium text-xs line-clamp-2">{othersSummaryText}</p>
                <button type="button" onClick={() => setShowOthersModal(true)} className="text-[#4b6f9e] text-[10px] font-black uppercase mt-2 hover:underline">Edit Details</button>
              </div>
              <CheckCircle2 size={24} className="text-[#4b6f9e] shrink-0" />
            </div>
          )
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-xl border-t border-slate-100 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount to Pay</span>
            <span className="text-2xl font-black text-slate-900 italic">₹{totalAmount}</span>
          </div>
          <button
            type="button"
            disabled={(orderMode === 'self' && !selectedId) || (orderMode === 'others' && !othersConfirmed)}
            onClick={handleFinalConfirm}
            className={`flex-1 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
              (orderMode === 'self' && selectedId) || (orderMode === 'others' && othersConfirmed)
                ? 'bg-[#1e293b] text-white shadow-2xl'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            Continue to Checkout
          </button>
        </div>
      </div>

      <AddressModal
        isOpen={isModalOpen}
        editAddress={editingAddress}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAddress(null);
          fetchAddresses();
        }}
      />

      {showOthersModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">Recipient Details</h2>
              <button type="button" onClick={() => setShowOthersModal(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <UserCircle className="absolute left-4 top-4 text-slate-300" size={20} />
                <input
                  type="text"
                  placeholder="Recipient Name *"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:border-[#4b6f9e]"
                  value={othersForm.recipientName}
                  onChange={(e) => setOthersForm({ ...othersForm, recipientName: e.target.value })}
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-4 text-slate-300" size={20} />
                <input
                  type="tel"
                  placeholder="Mobile Number *"
                  maxLength={10}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:border-[#4b6f9e]"
                  value={othersForm.recipientPhone}
                  onChange={(e) => setOthersForm({ ...othersForm, recipientPhone: e.target.value.replace(/\D/g, '') })}
                />
              </div>

              <div className="relative">
                <MapPin className="absolute left-4 top-4 text-slate-300" size={20} />
                <input
                  type="text"
                  placeholder="Address line 1 *"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:border-[#4b6f9e]"
                  value={othersForm.line1}
                  onChange={(e) => setOthersForm({ ...othersForm, line1: e.target.value })}
                />
              </div>
              <input
                type="text"
                placeholder="Address line 2 (optional)"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-[#4b6f9e]"
                value={othersForm.line2}
                onChange={(e) => setOthersForm({ ...othersForm, line2: e.target.value })}
              />
              <input
                type="text"
                placeholder="Landmark *"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-[#4b6f9e]"
                value={othersForm.landmark}
                onChange={(e) => setOthersForm({ ...othersForm, landmark: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="City (from PIN)"
                  readOnly
                  className="w-full bg-slate-100 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-600"
                  value={othersForm.city}
                />
                <input
                  type="text"
                  placeholder="State (from PIN)"
                  readOnly
                  className="w-full bg-slate-100 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-600"
                  value={othersForm.state}
                />
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="PIN code *"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pr-12 text-sm font-bold outline-none focus:border-[#4b6f9e]"
                  value={othersForm.pincode}
                  onChange={(e) => setOthersForm({ ...othersForm, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  onBlur={() => applyOthersPin(othersForm.pincode)}
                />
                {othersPinLoading && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[#4b6f9e]" size={20} />
                )}
              </div>
              <p className="text-[10px] font-bold text-slate-400 -mt-2">City and state fill from a valid PIN.</p>

              <button
                type="button"
                onClick={async () => {
                  if (!othersForm.recipientName || othersForm.recipientPhone.length !== 10) {
                    showToast('error', 'Please enter recipient name and a valid 10-digit phone.');
                    return;
                  }
                  if (!othersForm.line1.trim() || !othersForm.landmark.trim()) {
                    showToast('error', 'Address line 1 and landmark are required.');
                    return;
                  }
                  const p = sanitizeIndianPincode(othersForm.pincode);
                  if (!isValidIndianPincode(p)) {
                    showToast('error', 'Enter a valid 6-digit Indian PIN code.');
                    return;
                  }
                  setOthersPinLoading(true);
                  const r = await lookupIndianPincode(p);
                  setOthersPinLoading(false);
                  if (!r.ok) {
                    showToast('error', 'PIN code not found.');
                    return;
                  }
                  setOthersForm(prev => ({ ...prev, pincode: r.pincode, city: r.city, state: r.state }));
                  const geo = await geocodeApproxFromIndianPincode(r.pincode);
                  const persisted = await addAddress({
                    label: `For ${othersForm.recipientName}`,
                    isMyAddress: false,
                    recipientName: othersForm.recipientName,
                    recipientPhone: othersForm.recipientPhone,
                    phone: othersForm.recipientPhone,
                    line1: othersForm.line1,
                    line2: othersForm.line2,
                    landmark: othersForm.landmark,
                    city: r.city,
                    state: r.state,
                    pincode: r.pincode,
                    full: formatAddressSummary({
                      line1: othersForm.line1,
                      line2: othersForm.line2,
                      landmark: othersForm.landmark,
                      city: r.city,
                      state: r.state,
                      pincode: r.pincode,
                    }),
                    lat: geo?.lat ?? 0,
                    lng: geo?.lng ?? 0,
                  });
                  setSavedOthersAddress(persisted);
                  setOthersConfirmed(true);
                  setShowOthersModal(false);
                  setOrderMode('others');
                }}
                className="w-full py-5 bg-[#1e293b] text-white rounded-[2rem] font-black text-sm uppercase shadow-xl mt-2 active:scale-95 transition-all"
              >
                Save Recipient Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Addresses;
