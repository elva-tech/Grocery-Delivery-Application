import { Gift, Sparkles, ChevronRight } from 'lucide-react';
import { useTenantBranding } from '../../context/TenantBrandingContext';

export const FreeDeliveryToast = ({ show, onClick }: { show: boolean, onClick: () => void }) => {
  const { storeName } = useTenantBranding();
  return (
    <div className={`
      fixed bottom-10 left-0 right-0 flex justify-center px-4 z-[999] pointer-events-none transition-all duration-500
      ${show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}
    `}>
      <div 
        onClick={onClick}
        className="
          pointer-events-auto cursor-pointer
          group relative flex items-center gap-4 
          bg-white/90 backdrop-blur-md 
          pl-2 pr-6 py-2.5 rounded-[2rem] 
          border-2 border-[#4b6f9e]/10 shadow-[0_20px_50px_rgba(75,111,158,0.15)]
          hover:shadow-[0_25px_60px_rgba(75,111,158,0.25)] hover:-translate-y-1 transition-all duration-300
        "
      >
        {/* Animated Brand Icon Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-[#4b6f9e] blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
          <div className="relative w-12 h-12 bg-gradient-to-br from-[#4b6f9e] to-[#1e293b] rounded-full flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform">
            <Gift size={20} className="text-white animate-bounce" />
          </div>
        </div>

        {/* Text Content - Brand Aligned */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-[#4b6f9e] uppercase tracking-[0.2em]">
              {storeName} · Reward
            </span>
            <Sparkles size={10} className="text-yellow-500 animate-pulse" />
          </div>
          <h3 className="text-[#1e293b] font-black text-sm tracking-tight">
            Free Delivery <span className="text-[#4b6f9e] italic">Unlocked!</span>
          </h3>
        </div>

        {/* Action Button */}
        <div className="ml-2 w-8 h-8 rounded-xl bg-[#f8fafc] border border-slate-100 flex items-center justify-center group-hover:bg-[#4b6f9e] transition-all duration-300">
          <ChevronRight size={16} className="text-[#4b6f9e] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </div>
  );
};