import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, Plus, ArrowLeft, Loader2, CheckCircle2, 
  Gift, User, Users, X, Phone, UserCircle, MessageSquare 
} from 'lucide-react';
import { getAddresses, createOrder } from '../api/addresses';
import { MOCK_PRODUCTS } from '../api/mockdata';
import AddressModal from '../components/layout/AddressModal';

const Addresses = ({ items, onSelect }: any) => {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // App Logic States
  const [orderMode, setOrderMode] = useState<'self' | 'others'>('self');
  const [isModalOpen, setIsModalOpen] = useState(false); 
  const [showOthersModal, setShowOthersModal] = useState(false);
  
  // EXACT INPUTS AS IN APP
  const [othersForm, setOthersForm] = useState({
    recipientName: '', 
    recipientPhone: '', 
    fullAddress: '', 
    landmark: '', 
    note: ''
  });
  const [othersConfirmed, setOthersConfirmed] = useState(false);

  // TOTAL PRICE CALCULATION (Checked for common item structures)
  const totalAmount = useMemo(() => {
  if (!items || !Array.isArray(items)) return 0;

  const subtotal = items.reduce((sum, item) => {
    const price = item.price || 0;
    const qty = item.quantity || item.qty || 1;
    return sum + (price * qty);
  }, 0);
  const deliveryCharge = subtotal === 0 || subtotal >= 500 ? 0 : 40;
  return subtotal + deliveryCharge;
}, [items]);

  const fetchAddresses = async () => {
    setLoading(true);
    const data = await getAddresses();
    setAddresses(data as any[]);
    setLoading(false);
  };

  useEffect(() => { 
    fetchAddresses(); 
    console.log("Current Items in Cart:", items); // Debugging total price issues
  }, [items]);

  const handleFinalConfirm = async () => {
    setIsSubmitting(true);
    try {
      console.log("FINAL ITEMS:", items);
      
      let deliveryAddress: any = null;
      
      if (orderMode === 'self') {
        const selected = addresses.find(a => a.id === selectedId);
        if (!selected) {
          alert("Please select a delivery address");
          setIsSubmitting(false);
          return;
        }
        
        deliveryAddress = {
          line1: selected.full || selected.address || '',
          city: 'Hassan',
          state: 'Karnataka',
          country: 'India',
          zip: '573201',
          lat: selected.coordinates?.lat || 15.3173,
          lng: selected.coordinates?.lng || 75.7139,
          phone: selected.phone || ''
        };
      } else {
        deliveryAddress = {
          line1: othersForm.fullAddress,
          landmark: othersForm.landmark || '',
          city: 'Hassan',
          state: 'Karnataka',
          country: 'India',
          zip: '573201',
          lat: 15.3173,
          lng: 75.7139,
          phone: othersForm.recipientPhone,
          recipientName: othersForm.recipientName
        };
      }

      const orderPayload = {
        items: items.map((item: any) => {
          // Map frontend id to backend _id using MOCK_PRODUCTS
          const product = MOCK_PRODUCTS.find(p => String(p.id) === String(item.id));
          const productId = product?._id;
          console.log("Item mapping:", item.id, "->", productId, "Product found:", !!product);
          
          if (!productId) {
            throw new Error(`Product ${item.id} not found in catalog or missing _id`);
          }
          
          return {
            productId: productId,
            qty: item.quantity || item.qty || 1
          };
        }),
        deliveryAddress: deliveryAddress,
        paymentMode: "COD",
        orderType: orderMode,
        total: totalAmount,
        timestamp: new Date().toISOString()
      };

      console.log("ORDER PAYLOAD TO SEND:", orderPayload);
      
      const result: any = await createOrder(orderPayload);
      
      if (result.success) {
        navigate('/success', { 
          state: { 
            orderId: result.orderId,
            total: totalAmount 
          } 
        });
      } else {
        alert(`Order failed: ${result.error || 'Unknown error'}`);
        console.error("Order creation failed:", result.error);
      }
    } catch (error) {
      console.error("Order Creation Error:", error);
      alert("An error occurred while creating your order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-40">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 mb-10 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-[#4b6f9e]">
        <ArrowLeft size={16} /> Back to Shop
      </button>

      <div className="mb-8">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900">Delivery</h1>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Select your delivery point</p>
      </div>

      {/* MODE TOGGLE */}
      <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
        <button 
          onClick={() => setOrderMode('self')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${orderMode === 'self' ? 'bg-white shadow-sm text-[#4b6f9e]' : 'text-slate-500'}`}
        >
          <User size={14} /> For Myself
        </button>
        <button 
          onClick={() => othersConfirmed ? setOrderMode('others') : setShowOthersModal(true)}
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
               <button onClick={() => setIsModalOpen(true)} className="w-10 h-10 bg-[#4b6f9e] text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-[#3a5a82] transition-colors"><Plus size={20}/></button>
            </div>
            {loading ? (
              <Loader2 className="animate-spin mx-auto mt-10 text-slate-300" />
            ) : (
              addresses.length > 0 ? (
                addresses.map((addr) => (
                  <button 
                    key={addr.id}
                    onClick={() => setSelectedId(addr.id)}
                    className={`w-full text-left bg-white p-6 rounded-[2rem] border-2 transition-all flex items-center gap-4 ${
                      selectedId === addr.id ? 'border-[#4b6f9e] shadow-xl' : 'border-slate-100'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selectedId === addr.id ? 'bg-blue-50 text-[#4b6f9e]' : 'bg-slate-50 text-slate-400'}`}>
                      <MapPin size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-sm text-slate-800 uppercase">{addr.label}</p>
                      <p className="text-slate-500 font-medium text-sm line-clamp-1">{addr.full}</p>
                      <p className="text-slate-400 text-[10px] font-black mt-1">📞 {addr.phone}</p>
                    </div>
                    {selectedId === addr.id && <CheckCircle2 size={24} className="text-[#4b6f9e]" />}
                  </button>
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
              <div className="flex-1">
                <p className="font-black text-sm text-slate-800 uppercase italic leading-none mb-1">Gift Order for {othersForm.recipientName}</p>
                <p className="text-slate-500 font-medium text-xs line-clamp-1">{othersForm.fullAddress}</p>
                <button onClick={() => setShowOthersModal(true)} className="text-[#4b6f9e] text-[10px] font-black uppercase mt-2 hover:underline">Edit Details</button>
              </div>
              <CheckCircle2 size={24} className="text-[#4b6f9e]" />
            </div>
          )
        )}
      </div>

      {/* FOOTER ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-xl border-t border-slate-100 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount to Pay</span>
            <span className="text-2xl font-black text-slate-900 italic">₹{totalAmount}</span>
          </div>
          <button 
            disabled={isSubmitting || (orderMode === 'self' && !selectedId) || (orderMode === 'others' && !othersConfirmed)}
            onClick={handleFinalConfirm}
            className={`flex-1 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
              ((orderMode === 'self' && selectedId) || (orderMode === 'others' && othersConfirmed)) && !isSubmitting
              ? 'bg-[#1e293b] text-white shadow-2xl' 
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Place Order'}
          </button>
        </div>
      </div>

      {/* MODALS */}
      <AddressModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); fetchAddresses(); }} />

      {/* OTHERS MODAL - EXACT APP INPUTS */}
      {showOthersModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">Recipient Details</h2>
                <button onClick={() => setShowOthersModal(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <UserCircle className="absolute left-4 top-4 text-slate-300" size={20} />
                <input 
                  type="text" placeholder="Recipient Name *" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:border-[#4b6f9e]"
                  value={othersForm.recipientName}
                  onChange={(e) => setOthersForm({...othersForm, recipientName: e.target.value})}
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-4 text-slate-300" size={20} />
                <input 
                  type="tel" placeholder="Mobile Number *" maxLength={10}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:border-[#4b6f9e]"
                  value={othersForm.recipientPhone}
                  onChange={(e) => setOthersForm({...othersForm, recipientPhone: e.target.value.replace(/\D/g, '')})}
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-4 top-4 text-slate-300" size={20} />
                <textarea 
                  placeholder="Full Delivery Address *" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:border-[#4b6f9e] h-24"
                  value={othersForm.fullAddress}
                  onChange={(e) => setOthersForm({...othersForm, fullAddress: e.target.value})}
                />
              </div>
              <input 
                type="text" placeholder="Landmark (Optional)" 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-[#4b6f9e]"
                value={othersForm.landmark}
                onChange={(e) => setOthersForm({...othersForm, landmark: e.target.value})}
              />
              <div className="relative">
                {/* <MessageSquare className="absolute left-4 top-4 text-slate-300" size={20} /> */}
                {/* <input 
                  type="text" placeholder="Add a note/message (Optional)" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:border-[#4b6f9e]"
                  value={othersForm.note}
                  onChange={(e) => setOthersForm({...othersForm, note: e.target.value})}
                /> */}
              </div>

              <button 
                onClick={() => {
                  if(othersForm.recipientName && othersForm.recipientPhone.length === 10 && othersForm.fullAddress) {
                    setOthersConfirmed(true);
                    setShowOthersModal(false);
                    setOrderMode('others');
                  } else {
                    alert("Please fill name, phone, and address.");
                  }
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