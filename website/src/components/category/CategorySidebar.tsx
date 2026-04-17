import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGetCategoriesQuery } from '../../api/apiSlice';
import { resolveImageUrl } from '../../utils/resolveImageUrl';

interface SidebarProps {
  selectedParentId: string | null;
  selectedSubId: string | null;
  onSelectParent: (id: string | null) => void;
  onSelectSub: (id: string | null) => void;
}

const CategorySidebar: React.FC<SidebarProps> = ({ selectedParentId, selectedSubId, onSelectParent, onSelectSub }) => {
  const { data: categories = [] } = useGetCategoriesQuery();
  const navigate = useNavigate();
  const location = useLocation();

  const parentCategories = useMemo(() => categories.filter((c: any) => !c.parentId), [categories]);

  const handleParentClick = (id: string) => {
    if (selectedParentId === id) {
      onSelectParent(null);
      onSelectSub(null);
    } else {
      onSelectParent(id);
      const firstSub = categories.find((c: any) => c.parentId === id);
      onSelectSub(firstSub?.id || null);
    }
    if (location.pathname !== '/browse') navigate('/browse');
  };

  return (
    <aside className="w-24 sm:w-28 md:w-36 bg-white border-r border-slate-100 h-[calc(100vh-80px)] sticky top-20 overflow-y-auto no-scrollbar flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-50 bg-slate-50/30">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 block text-center">Menu</span>
      </div>

      <div className="flex-1">
        {parentCategories.map((parent: any) => {
          const isParentActive = selectedParentId === parent.id;
          const subCats = categories.filter((c: any) => c.parentId === parent.id);

          return (
            <div key={parent.id} className="border-b border-slate-50">
              <div
                onClick={() => handleParentClick(parent.id)}
                className={`relative flex flex-col items-center py-6 cursor-pointer transition-all duration-300 group ${isParentActive ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
              >
                {isParentActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-[#4b6f9e] rounded-r-full shadow-md" />
                )}
                <div className={`w-12 h-12 rounded-[1.25rem] mb-2 flex items-center justify-center p-2 transition-all duration-500 ${isParentActive ? 'bg-white shadow-xl scale-110 rotate-2' : 'bg-[#f8fafc]'}`}>
                  {resolveImageUrl(parent) ? (
                    <img src={resolveImageUrl(parent)} className="w-full h-full object-contain" alt={parent.name} />
                  ) : (
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">No Image</span>
                  )}
                </div>
                <span className={`text-[9px] font-black text-center px-2 uppercase tracking-tighter ${isParentActive ? 'text-[#4b6f9e]' : 'text-slate-500'}`}>
                  {parent.name}
                </span>
              </div>

              {/* FIXED: Added images to Sub-Categories */}
              {isParentActive && subCats.map((sub: any) => (
                <div
                  key={sub.id}
                  onClick={() => onSelectSub(sub.id)}
                  className={`flex flex-col items-center py-4 cursor-pointer transition-all border-l-4 ${selectedSubId === sub.id ? 'border-[#4b6f9e] bg-white' : 'border-transparent bg-slate-50/20'}`}
                >
                  <div className={`w-8 h-8 rounded-lg mb-1 flex items-center justify-center overflow-hidden bg-white shadow-sm border ${selectedSubId === sub.id ? 'border-[#4b6f9e]/30' : 'border-transparent'}`}>
                    {resolveImageUrl(sub) ? (
                      <img src={resolveImageUrl(sub)} className="w-full h-full object-cover" alt={sub.name} />
                    ) : (
                      <span className="text-[7px] font-black uppercase tracking-widest text-slate-300">No</span>
                    )}
                  </div>
                  <span className={`text-[7px] font-bold text-center px-1 uppercase tracking-tight ${selectedSubId === sub.id ? 'text-[#4b6f9e]' : 'text-slate-400'}`}>
                    {sub.name}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default CategorySidebar;