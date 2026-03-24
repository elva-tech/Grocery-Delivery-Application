import React from 'react';

const LeafBanner = () => {
  return (
    <div className="relative bg-[#f0f9ff] rounded-[2.5rem] p-8 mb-12 flex flex-col md:flex-row items-center justify-between overflow-hidden border border-blue-50">
      {/* Interactive Background Elements */}
      <div className="absolute -right-10 -top-10 text-9xl opacity-5 rotate-12 select-none">🍃</div>
      <div className="absolute left-1/4 bottom-0 text-6xl opacity-5 -rotate-12 select-none">🥦</div>

      <div className="relative z-10 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-[#4b6f9e] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
            Farm to Home
          </span>
        </div>
        <h2 className="text-3xl font-black text-[#1e293b] leading-tight mb-2">
          Freshness that <span className="text-[#4b6f9e]">Talks.</span>
        </h2>
        <p className="text-[#64748b] font-medium max-w-md">
          Organically grown vegetables and fruits delivered within 15 minutes. 
          No preservatives, just pure nature.
        </p>
      </div>

      <div className="relative z-10 mt-6 md:mt-0 flex gap-4">
        <div className="bg-white p-4 rounded-3xl shadow-xl shadow-blue-900/5 flex flex-col items-center">
          <span className="text-2xl mb-1">⏰</span>
          <span className="text-[10px] font-black text-gray-400 uppercase">15 Mins</span>
        </div>
        <div className="bg-white p-4 rounded-3xl shadow-xl shadow-blue-900/5 flex flex-col items-center">
          <span className="text-2xl mb-1">🚜</span>
          <span className="text-[10px] font-black text-gray-400 uppercase">Organic</span>
        </div>
      </div>
    </div>
  );
};

export default LeafBanner;