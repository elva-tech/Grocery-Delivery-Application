import React, { useMemo } from 'react';
import { useGetCategoriesQuery } from '../../api/apiSlice';

interface CategoryStripProps {
  selectedId: string | null;      // Parent Pillar ID
  selectedSubId: string | null;   // Active Sub-Category ID
  onSelect: (parentId: string | null) => void;
  onSelectSub: (subId: string | null) => void;
  onSeeAll: () => void;
}

const CategoryStrip: React.FC<CategoryStripProps> = ({ 
  selectedId, 
  selectedSubId, 
  onSelect, 
  onSelectSub, 
  onSeeAll 
}) => {
  const { data: categories = [] } = useGetCategoriesQuery();

  // 1. Get Main Pillars
  const mainPillars = useMemo(() => 
    categories.filter((cat: any) => !cat.parentId).slice(0, 6), 
  [categories]);

  // 2. Get Sub-Categories for the selected Pillar
  const subCategories = useMemo(() => 
    categories.filter((cat: any) => cat.parentId === selectedId), 
  [categories, selectedId]);

  return (
    <div className="mb-10">
      <div className="flex justify-between items-center mb-6 px-1">
        <h3 className="font-black text-xl tracking-tight text-[#1e293b] uppercase italic">Browse Categories</h3>
        <button 
          onClick={onSeeAll} 
          className="bg-blue-50 text-[#4b6f9e] px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-wider hover:bg-[#4b6f9e] hover:text-white transition-all shadow-sm"
        >
          See All →
        </button>
      </div>

      {/* PILLARS ROW */}
      <div className="flex gap-5 overflow-x-auto no-scrollbar pb-4 -mx-2 px-2">
        {mainPillars.map((cat: any) => {
          const isActive = String(selectedId) === String(cat.id);
          return (
            <div 
              key={cat.id} 
              onClick={() => {
                onSelect(isActive ? null : cat.id);
                onSelectSub(null); // Reset sub when changing pillars
              }}
              className="flex flex-col items-center min-w-[85px] cursor-pointer group"
            >
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center p-4 transition-all duration-300 shadow-sm
                ${isActive 
                  ? 'bg-white border-2 border-[#4b6f9e] shadow-xl scale-110 rotate-3' 
                  : 'bg-white border border-gray-100 group-hover:bg-gray-50 group-hover:-translate-y-1'}`}
              >
                <img 
                  src={Array.isArray(cat.image) ? cat.image[0] : cat.image} 
                  className="w-full h-full object-contain mix-blend-multiply" 
                  alt={cat.name}
                />
              </div>
              <span className={`text-[11px] mt-3 font-black transition-colors uppercase tracking-tighter text-center
                ${isActive ? 'text-[#4b6f9e]' : 'text-[#94a3b8] group-hover:text-slate-800'}`}>
                {cat.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* SUB-CATEGORIES ROW (Only shows when a Pillar is selected) */}
      {selectedId && subCategories.length > 0 && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar py-4 mt-2 animate-in fade-in slide-in-from-top-2">
          {subCategories.map((sub: any) => {
            const isSubActive = String(selectedSubId) === String(sub.id);
            return (
              <button
                key={sub.id}
                onClick={() => onSelectSub(isSubActive ? null : sub.id)}
                className={`flex items-center gap-3 px-4 py-2 rounded-2xl whitespace-nowrap transition-all border
                  ${isSubActive 
                    ? 'bg-[#4b6f9e] border-[#4b6f9e] text-white shadow-lg shadow-blue-100' 
                    : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}
              >
                <img 
                  src={Array.isArray(sub.image) ? sub.image[0] : sub.image} 
                  className="w-6 h-6 object-contain rounded-md" 
                  alt={sub.name} 
                />
                <span className="text-[10px] font-bold uppercase tracking-wide">{sub.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CategoryStrip;