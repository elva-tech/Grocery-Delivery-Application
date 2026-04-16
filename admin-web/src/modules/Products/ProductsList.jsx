import React, { useState, useMemo } from 'react';
import { useAppState } from '../../context/AppStateContext';
import DataTable from '../../components/shared/DataTable';
import CustomButton from '../../components/shared/CustomButton';
import ProductForm from './ProductForm';
import CategoryForm from './CategoryForm';
import { Plus, Edit, Trash2, FolderPlus, Package, ChevronRight, Search, X } from 'lucide-react';
import Pagination from '../../components/shared/Pagination';
import usePagination from '../../hooks/usePagination';
import { APP_CONFIG } from '../../config/appConfig';
import { apiService } from '../../services/apiService';

const ProductList = () => {

  const { products, categories, addProduct, updateProduct, deleteProduct, refreshProducts, addCategory } = useAppState();

  const [showForm, setShowForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [activePillarId, setActivePillarId] = useState('All');
  const [activeSubCatId, setActiveSubCatId] = useState('All');

  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }

  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const getImageUrl = (imgData) => {
    if (!imgData) return null;
    if (Array.isArray(imgData)) return imgData[0];
    return imgData;
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter(p => {
      const matchesPillar =
        activePillarId === 'All' ||
        String(p.parentCategoryId) === String(activePillarId);
      const matchesSub =
        activeSubCatId === 'All' ||
        String(p.subCategoryId) === String(activeSubCatId);
      const matchesSearch =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.subcategory?.toLowerCase().includes(q);
      return matchesPillar && matchesSub && matchesSearch;
    });
  }, [products, activePillarId, activeSubCatId, searchQuery]);

  const {
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    paginatedItems: paginatedProducts,
  } = usePagination(filteredProducts);

  const columns = [

    {
      header: 'Product',
      accessor: 'name',
      render: (val, row) => {

        const displayImg =
          getImageUrl(row.imageUrl || row.images || row.image);

        const subCat = row.subCategoryId
          ? categories.find(c => String(c.id) === String(row.subCategoryId))
          : null;

        const pillar =
          categories.find(c => String(c.id) === String(row.parentCategoryId));

        return (

          <div className="flex items-center gap-3">

            <div className="w-12 h-12 rounded-lg bg-gray-100 border overflow-hidden flex items-center justify-center shrink-0">

              {displayImg ? (
                <img
                  src={displayImg}
                  className="w-full h-full object-cover"
                  alt={val}
                />
              ) : (
                <Package className="text-gray-400" size={20} />
              )}

            </div>

            <div className="flex flex-col">

              <span className="font-bold text-slate-800">
                {val}
              </span>

              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-600">

                <span>{pillar?.name || 'No Pillar'}</span>

                <ChevronRight size={8} />

                <span className="text-slate-400">
                  {subCat?.name || 'General'}
                </span>

              </div>

            </div>

          </div>
        );
      }
    },

    {
      header: 'Price',
      accessor: 'price',
      render: (v) => `₹${v}`
    },

    {
      header: 'Stock',
      accessor: 'stock',
      render: (v, row) => {
        const unitLabel = row.unit
          ? (String(row.unit).trim().replace(/^\d+(\.\d+)?\s*/, '').trim() || String(row.unit).trim())
          : 'units';
        const threshold = row.threshold ?? row.thresholdQty ?? 10;
        const isLow = v <= threshold;
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`font-bold ${isLow ? 'text-red-500' : 'text-slate-600'}`}>
              {v} {unitLabel}
            </span>
            {isLow && (
              <span className="text-[9px] font-black uppercase tracking-widest text-red-400">Low Stock</span>
            )}
          </div>
        );
      }
    }

  ];

  return (

    <div className="space-y-6">

      <div className="flex justify-between items-end">

        <div>
          <h1 className="text-3xl font-bold text-[#1A4D2E]">
            {APP_CONFIG.brand.name} Inventory
          </h1>
          <p className="text-slate-500">
            Live Backend Sync: {products.length} Products
            {searchQuery && (
              <span className="ml-2 text-emerald-600 font-bold">
                · {filteredProducts.length} results
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-3">

          <button
            onClick={() => setShowCatForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-emerald-700 border border-emerald-200 rounded-xl font-bold hover:bg-emerald-50 transition-all shadow-sm"
          >
            <FolderPlus size={18} /> New Category
          </button>

          <CustomButton
            onClick={() => {
              setEditingItem(null);
              setShowForm(true);
            }}
            style={{ backgroundColor: APP_CONFIG.brand.colors.primary }}
          >
            <Plus size={18} /> Add Product
          </CustomButton>

        </div>
      </div>

      {/* Search bar */}
      {!showForm && !editingItem && !showCatForm && (
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search products by name or category…"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); /* reset handled by usePagination via filteredProducts change */ }}
            className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 placeholder:text-slate-300 outline-none focus:border-emerald-300 bg-white shadow-sm transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {showCatForm && (
        <CategoryForm
          initialValues={null}
          onCancel={() => setShowCatForm(false)}
          onSubmit={(cat) => {
            addCategory(cat);
            setShowCatForm(false);
          }}
        />
      )}

      {(showForm || editingItem) && (

        <ProductForm

          initialValues={{
            ...editingItem,
            description: editingItem?.description ?? "",
            stock: editingItem?.stock ?? editingItem?.availableQty ?? 0,
            threshold: editingItem?.threshold ?? editingItem?.thresholdQty ?? 10
          }}

          onCancel={() => {
            setShowForm(false);
            setEditingItem(null);
          }}

          onSubmit={async (v) => {

            try {

              const catObj = categories.find(c => c.id === v.parentCategoryId);
              const subCatObj = categories.find(c => c.id === v.subCategoryId);

              const payload = {
                name: v.name,
                description: v.description || '',
                category: catObj?.name || v.parentCategoryId,
                subcategory: subCatObj?.name || v.subCategoryId,
                price: Number(v.price),
                unit: `${v.unitValue} ${v.unitType}`,
                stocks: Number(v.stock),
                threshold: v.threshold != null ? Number(v.threshold) : 10,
                imageUrl: Array.isArray(v.image) ? (v.image[0] || '') : (v.image || '')
              };

              if (editingItem) {

                const productId =
                  editingItem.productId ||
                  editingItem._id ||
                  editingItem.id;

                await apiService.updateProduct(productId, payload);
                await updateProduct();

              } else {

                await apiService.addProduct(payload);
                await addProduct();
                setSuccessData({
                  name: v.name,
                  price: v.price,
                  unit: `${v.unitValue} ${v.unitType}`,
                  stock: v.stock
                });

                setSuccessData({
                  name: v.name,
                  price: v.price,
                  unit: `${v.unitValue} ${v.unitType}`,
                  stock: v.stock
                });

                setShowSuccess(true);
              }

              setShowForm(false);
              setEditingItem(null);

            } catch (error) {

              console.error("Product save error:", error);

              alert(
                error.response?.data?.message ||
                "Error saving product"
              );

            }

          }}
        />
      )}

      {!showForm && !editingItem && (
        <>
          <DataTable
            columns={columns}
            data={paginatedProducts}

            actions={(row) => (

              <div className="flex gap-2">

                <button
                  onClick={() => setEditingItem(row)}
                  className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  <Edit size={18} />
                </button>

                <button
                  onClick={() => setConfirmDelete({ id: row.id, name: row.name })}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>

              </div>

            )}
          />
          <Pagination
            totalItems={filteredProducts.length}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[28px] shadow-2xl p-8 w-full max-w-sm mx-4 space-y-5">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="bg-red-100 p-4 rounded-full">
                <Trash2 size={28} className="text-red-500" />
              </div>
              <h2 className="text-xl font-black text-slate-800">Delete Product?</h2>
              <p className="text-slate-500 text-sm">
                Are you sure you want to delete{' '}
                <span className="font-bold text-slate-700">&ldquo;{confirmDelete.name}&rdquo;</span>?
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-2xl border-2 border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { deleteProduct(confirmDelete.id); setConfirmDelete(null); }}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black hover:bg-red-600 active:scale-95 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}


      {/* {Succes POP UP} */}
    {showSuccess && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
    
    <div className="bg-white rounded-[28px] shadow-2xl p-8 w-full max-w-sm mx-4 space-y-5 animate-in zoom-in-95">
      
      <div className="flex flex-col items-center text-center gap-3">
        
        <div className="bg-green-100 p-4 rounded-full">
          <Package size={28} className="text-green-600" />
        </div>

        <h2 className="text-xl font-black text-slate-800">
          Product Added
        </h2>

        <p className="text-slate-500 text-sm">
          <span className="font-bold text-slate-700">
            {successData?.name}
          </span> has been added successfully.
        </p>

        <div className="text-xs text-slate-400 space-y-1">
          <p>₹{successData?.price} • {successData?.unit}</p>
          <p>Stock: {successData?.stock}</p>
        </div>

      </div>

      <button
        onClick={() => {
          setShowSuccess(false);
          setShowForm(false);
          setEditingItem(null);
        }}
        className="w-full py-3 rounded-2xl bg-green-600 text-white font-black hover:bg-green-700 transition-all"
      >
        Done
      </button>

    </div>

  </div>
)}
    </div>
  );
};

export default ProductList;