import React, { useState, useMemo } from 'react';
import { useAppState } from '../../context/AppStateContext';
import DataTable from '../../components/shared/DataTable';
import CustomButton from '../../components/shared/CustomButton';
import ProductForm from './ProductForm';
import CategoryForm from './CategoryForm';
import { Plus, Edit, Trash2, Search, FolderPlus, Package, ChevronRight } from 'lucide-react';
import { APP_CONFIG } from '../../config/appConfig';

const ProductList = () => {
  const { products, categories, addProduct, updateProduct, deleteProduct, addCategory } = useAppState();
  const [showForm, setShowForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Drill-down states
  const [activePillarId, setActivePillarId] = useState('All');
  const [activeSubCatId, setActiveSubCatId] = useState('All');

  // Logic: 1. Main Pillars, 2. SubCategories of the active Pillar
  const mainPillars = useMemo(() => categories.filter(c => !c.parentId), [categories]);
  const subCategories = useMemo(() => 
    categories.filter(c => c.parentId === activePillarId), 
    [categories, activePillarId]
  );

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filter by Pillar
      const matchesPillar = activePillarId === 'All' || p.parentCategoryId === activePillarId;
      
      // Filter by SubCategory
      const matchesSub = activeSubCatId === 'All' || p.subCategoryId === activeSubCatId;

      return matchesSearch && matchesPillar && matchesSub;
    });
  }, [products, searchTerm, activePillarId, activeSubCatId]);

  const columns = [
    { 
      header: 'Product', 
      accessor: 'name',
      render: (val, row) => {
        const imgList = row.images || row.image || [];
        const displayImg = Array.isArray(imgList) ? imgList[0] : imgList;
        const subCat = categories.find(c => String(c.id) === String(row.subCategoryId));
        const pillar = categories.find(c => String(c.id) === String(row.parentCategoryId));

        return (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-50 border overflow-hidden flex items-center justify-center">
              {displayImg ? (
                <img src={displayImg} className="w-full h-full object-cover" alt="" />
              ) : (
                <Package className="text-gray-300" size={20} />
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-800">{val}</span>
              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                <span>{pillar?.name || 'No Pillar'}</span>
                <ChevronRight size={8} />
                <span className="text-slate-400">{subCat?.name || 'General'}</span>
              </div>
            </div>
          </div>
        );
      }
    },
    { header: 'Price', accessor: 'price', render: (v) => `₹${v}` },
    { 
      header: 'Stock', 
      accessor: 'stock', 
      render: (v) => (
        <span className={`font-bold ${v < 10 ? 'text-red-500' : 'text-slate-600'}`}>
          {v} units
        </span>
      ) 
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-[#1A4D2E]">Enandi Inventory</h1>
          <p className="text-slate-500">Live Backend Sync: {products.length} Products</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowCatForm(true)} 
            className="flex items-center gap-2 px-4 py-2 bg-white text-emerald-700 border border-emerald-200 rounded-xl font-bold hover:bg-emerald-50 transition-all shadow-sm"
          >
            <FolderPlus size={18} /> New Category
          </button>
          <CustomButton 
            onClick={() => { setEditingItem(null); setShowForm(true); }}
            style={{ backgroundColor: APP_CONFIG.brand.colors.primary }}
          >
            <Plus size={18} /> Add Product
          </CustomButton>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search products..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-2.5 bg-white border rounded-xl outline-none shadow-sm" 
          />
        </div>
        
        {/* 1. PILLAR SELECTOR (Only Parent Categories) */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Please Select category</label>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button 
              onClick={() => { setActivePillarId('All'); setActiveSubCatId('All'); }} 
              className={`px-6 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all uppercase border ${activePillarId === 'All' ? 'bg-[#1A4D2E] text-white border-[#1A4D2E]' : 'bg-white text-slate-400 border-slate-100'}`}
            >
              All Products
            </button>
            {mainPillars.map(cat => (
              <button 
                key={cat.id} 
                onClick={() => { setActivePillarId(cat.id); setActiveSubCatId('All'); }} 
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black border whitespace-nowrap transition-all uppercase ${String(activePillarId) === String(cat.id) ? 'bg-[#1A4D2E] text-white border-[#1A4D2E]' : 'bg-white text-slate-500 border-slate-100'}`}
              >
                {cat.image?.[0] && <img src={cat.image[0]} className="w-10 h-10 rounded-full object-cover" alt="" />}
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* 2. SUB-CATEGORY SELECTOR (Only shows if a Pillar is selected) */}
        {activePillarId !== 'All' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Please Select Sub-Category</label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button 
                onClick={() => setActiveSubCatId('All')} 
                className={`px-6 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all uppercase border ${activeSubCatId === 'All' ? 'bg-[#1A4D2E] text-white border-[#1A4D2E]' : 'bg-white text-slate-400 border-slate-100'}`}
              >
                All {categories.find(c => c.id === activePillarId)?.name}
              </button>
              {subCategories.map(sub => (
                <button 
                  key={sub.id} 
                  onClick={() => setActiveSubCatId(sub.id)} 
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black border whitespace-nowrap transition-all uppercase  ${String(activeSubCatId) === String(sub.id) ? 'bg-[#1A4D2E] text-white border-[#1A4D2E]' : 'bg-white text-slate-500 border-slate-100'}`}
                >
                  {sub.image?.[0] && <img src={sub.image[0]} className="w-4 h-4 rounded-full object-cover" alt="" />}
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCatForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <CategoryForm onCancel={() => setShowCatForm(false)} onSubmit={(v) => { addCategory(v); setShowCatForm(false); }} />
        </div>
      )}

      {(showForm || editingItem) ? (
        <ProductForm 
          initialValues={editingItem} 
          onCancel={() => { setShowForm(false); setEditingItem(null); }} 
          onSubmit={(v) => {
            editingItem ? updateProduct(editingItem.id, v) : addProduct(v);
            setShowForm(false);
            setEditingItem(null);
          }} 
        />
      ) : (
        <DataTable 
          columns={columns} 
          data={filteredProducts} 
          actions={(row) => (
            <div className="flex gap-2">
              <button onClick={() => setEditingItem(row)} className="p-2 text-slate-400 hover:text-emerald-600"><Edit size={18}/></button>
              <button onClick={() => deleteProduct(row.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>
            </div>
          )} 
        />
      )}
    </div>
  );
};

export default ProductList;