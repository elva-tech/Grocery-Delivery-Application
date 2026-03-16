import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, MapPin, ArrowLeft, Phone, Map, Loader2 } from 'lucide-react';
import type { RootState } from '../store/store';
import { clearCart } from '../store/slices/cartSlice';
import { useCalculateCartMutation } from '../api/apiSlice';
import { saveNewOrder } from '../api/ordersApi'; // Fixed: Import the API

const Checkout = ({ address }: any) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { items } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [bill, setBill] = useState({
    subtotal: 0,
    deliveryCharge: 0,
    grandTotal: 0,
    isFreeDelivery: false
  });

  const [getCalculation] = useCalculateCartMutation();

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const response = await getCalculation(items).unwrap();
        setBill(response);
      } catch (error) {
        console.error("Backend calculation failed", error);
      }
    };
    if (items.length > 0) fetchBill();
  }, [items, getCalculation]);

 // ... previous imports

const handlePlaceOrder = async () => {
  if (items.length === 0) return;

  setIsProcessing(true);

  try {
    const orderPayload = {
      userId: user?.id || 'user-123',
      items: [...items],
      totalAmount: bill.grandTotal,
      address: address?.full || 'Default Address',
      deliverySlot: '7-10 AM',
    };

    const response = await saveNewOrder(orderPayload);

    const orderId =
      response?.order?._id ||
      response?.orderId ||
      `EN-${Date.now()}`;

    navigate('/success', {
      state: {
        fromCheckout: true,
        orderItems: items,
        orderId: orderId
      }
    });

    dispatch(clearCart());

  } catch (error) {
    console.error("Order placement failed", error);
  } finally {
    setIsProcessing(false);
  }
};

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 animate-in fade-in duration-500">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 mb-10 transition-colors">
          <ArrowLeft size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Checkout.</h1>
            
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-[#4b6f9e] rounded-xl"><MapPin size={20} /></div>
                <h3 className="font-black text-sm uppercase tracking-widest text-slate-800">Delivery Address</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{address?.label || 'Home'}</p>
                  <p className="text-slate-700 font-bold text-lg leading-tight">{address?.full || 'No address selected'}</p>
                </div>
                
                {address?.landmark && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Map size={14} />
                    <p className="text-xs font-bold">Landmark: {address.landmark}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 pt-2">
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl text-slate-600">
                    <Phone size={14} />
                    <span className="text-xs font-black">{address?.phone || '+91 0000000000'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl sticky top-10">
              <h3 className="font-black text-sm uppercase tracking-widest text-slate-800 mb-8 text-center">Summary</h3>
              <div className="space-y-4 mb-8 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">{item.quantity}x {item.name}</span>
                    <span className="text-xs font-black text-slate-800">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-slate-100 pt-6 space-y-3 mb-8">
                <div className="flex justify-between text-xs font-bold text-slate-400">
                  <span>Subtotal</span>
                  <span>₹{bill.subtotal}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-green-500">
                  <span>Delivery</span>
                  <span>{bill.isFreeDelivery ? 'FREE' : `₹${bill.deliveryCharge}`}</span>
                </div>
                <div className="flex justify-between items-baseline pt-4">
                  <span className="font-black text-slate-900 uppercase text-xs">Total</span>
                  <span className="text-3xl font-black text-slate-900 tracking-tighter">₹{bill.grandTotal}</span>
                </div>
              </div>

              <button 
                onClick={handlePlaceOrder} 
                disabled={isProcessing || items.length === 0} 
                className="w-full bg-[#1e293b] hover:bg-[#4b6f9e] text-white h-16 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 disabled:bg-slate-200 disabled:cursor-not-allowed"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={20} /> : "Confirm Order"}
              </button>
              
              <div className="mt-6 flex items-center justify-center gap-2 text-[#94a3b8]">
                <ShieldCheck size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">Encrypted Payment</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;