import { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store/store';
import { addToCart, removeFromCart } from '../../store/slices/cartSlice';
import { computeCartBill, getCartBillingSettings, DEFAULT_CART_BILLING_SETTINGS, type CartBillingSettings } from '../../api/ordersApi';
import { X, ShoppingBasket, Trash2, Zap, Gift, Bike } from 'lucide-react';
import confetti from 'canvas-confetti';
import { resolveImageUrl } from '../../utils/resolveImageUrl';
import { WEB_COPY } from '../../constants/copy';

const CartDrawer = ({ isOpen, onClose, onProceed }: any) => {
  const { items } = useSelector((state: RootState) => state.cart);
  const dispatch = useDispatch();
  const [billingSettings, setBillingSettings] = useState<CartBillingSettings | null>(null);
  const wasFreeRef = useRef(false);

  useEffect(() => {
    void getCartBillingSettings().then(setBillingSettings);
  }, []);

  const bill = useMemo(() => {
    if (items.length === 0) return null;
    return computeCartBill(items, billingSettings ?? DEFAULT_CART_BILLING_SETTINGS);
  }, [items, billingSettings]);

  useEffect(() => {
    if (!bill?.isFreeDelivery) {
      wasFreeRef.current = false;
      return;
    }
    if (!wasFreeRef.current && isOpen) {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { x: 0.85, y: 0.5 },
        zIndex: 1001,
        colors: ['#22c55e', '#4b6f9e', '#ffffff'],
      });
      wasFreeRef.current = true;
    }
  }, [bill?.isFreeDelivery, isOpen]);

  return (
    <div className={`fixed inset-0 z-[100] transition-all duration-500 ${isOpen ? 'visible' : 'invisible'}`}>
      <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div className={`absolute right-0 top-0 w-full max-w-md bg-[#f8fafc] h-full shadow-2xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="bg-white p-6 flex items-center justify-between border-b border-slate-100">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">{WEB_COPY.cart.myCart}</h2>
            <p className="text-[10px] font-black text-[#4b6f9e] uppercase tracking-widest">
               {items.reduce((acc, i) => acc + i.quantity, 0)} {WEB_COPY.cart.itemCountSuffix}
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl transition-colors"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {items.length > 0 ? (
            <>
              <div className={`p-6 rounded-[2.5rem] border-2 transition-all duration-500 ${bill?.isFreeDelivery ? 'bg-green-50 border-green-200 shadow-lg shadow-green-900/5' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${bill?.isFreeDelivery ? 'bg-green-500 text-white scale-110' : 'bg-slate-100 text-slate-400'}`}>
                    {bill?.isFreeDelivery ? <Gift size={18} /> : <Bike size={18} />}
                  </div>
                  <p className="text-sm font-black text-slate-700">
                    {bill?.isFreeDelivery ? WEB_COPY.cart.freeDeliveryUnlocked : WEB_COPY.cart.addMoreForFreeDelivery(bill?.amountToFree ?? 0)}
                  </p>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ease-out ${bill?.isFreeDelivery ? 'bg-green-500' : 'bg-[#4b6f9e]'}`} style={{ width: `${(bill?.progress || 0) * 100}%` }} />
                </div>
              </div>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-[2rem] border border-slate-50 flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl p-2 flex-shrink-0">
                      {resolveImageUrl(item) ? (
                        <img src={resolveImageUrl(item)} className="w-full h-full object-contain" alt={item.name} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] font-black uppercase tracking-widest text-slate-300">No Image</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-slate-800 truncate">{item.name}</h4>
                      <p className="text-sm font-black text-slate-900 mt-1">₹{item.price}</p>
                    </div>
                    <div className="flex items-center bg-slate-100 rounded-2xl p-1.5 gap-3">
                      <button onClick={() => dispatch(removeFromCart(item.id))} className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        {item.quantity === 1 ? <Trash2 size={14} /> : <span className="font-bold">-</span>}
                      </button>
                      <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                      <button onClick={() => dispatch(addToCart(item))} className="w-8 h-8 bg-[#4b6f9e] text-white rounded-xl flex items-center justify-center shadow-md">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <ShoppingBasket size={80} strokeWidth={1} />
              <p className="font-black mt-4 uppercase tracking-widest text-xs">{WEB_COPY.cart.emptyCart}</p>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="bg-white p-8 border-t border-slate-100 shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To Pay</p>
                <p className="text-4xl font-black text-slate-900 tracking-tighter">₹{bill?.grandTotal}</p>
              </div>
              {bill?.isFreeDelivery && <span className="bg-green-100 text-green-600 text-[10px] font-black px-3 py-1 rounded-full uppercase">{WEB_COPY.cart.deliveryFeeSaved}</span>}
            </div>
            <button onClick={onProceed} className="w-full bg-[#1e293b] text-white py-5 rounded-[2.5rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-[#4b6f9e] transition-all shadow-xl active:scale-95">
              Proceed <Zap size={20} fill="currentColor" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartDrawer;