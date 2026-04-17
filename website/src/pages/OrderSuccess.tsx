import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { clearCart } from '../store/slices/cartSlice';
import { Check, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';

const OrderSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [lastId, setLastId] = useState('');

  useEffect(() => {
    dispatch(clearCart());

    const id = location.state?.orderId || localStorage.getItem('@last_order_id') || '';
    if (id) {
      setLastId(id);
      localStorage.setItem('@last_order_id', String(id));
    }

    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 999 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    return () => clearInterval(interval);
  }, [dispatch]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700 px-4">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-green-100 rounded-full scale-150 animate-ping opacity-20" />
        <div className="relative w-32 h-32 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-200">
          <Check size={64} className="text-white animate-in zoom-in duration-500 delay-300" strokeWidth={3} />
        </div>
      </div>

      <div className="text-center space-y-4 mb-12">
        <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">Order Placed!</h1>
        <p className="text-slate-500 font-bold max-w-md mx-auto leading-relaxed">
          Your fresh dairy is being packed and will arrive at your doorstep soon.
        </p>
      </div>

      <div className="w-full max-w-md bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 mb-10 text-center">
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order ID</p>
         <p className="font-black text-slate-800 tracking-tight">{lastId || '#EN-LOADING'}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <button 
          onClick={() => navigate('/')}
          className="flex-1 bg-[#1e293b] text-white h-16 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-[#4b6f9e] transition-all flex items-center justify-center gap-2 group shadow-xl"
        >
          Return to Home
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default OrderSuccess;
