import React, { useState, useMemo, useEffect } from 'react';
import { useAppState } from '../../context/AppStateContext';
import DataTable from '../../components/shared/DataTable';
import CustomButton from '../../components/shared/CustomButton';
import ProductForm from './ProductForm';
import CategoryForm from './CategoryForm';
import { Plus, Edit, Trash2, FolderPlus, Package, ChevronRight, Search, X, Loader, AlertCircle, AlertTriangle } from 'lucide-react';
import Pagination from '../../components/shared/Pagination';
import usePagination from '../../hooks/usePagination';
import { APP_CONFIG } from '../../config/appConfig';
import { apiService } from '../../services/apiService';
import { useToast } from '../../context/ToastContext';
import resolveImageUrl from '../../utils/resolveImageUrl';

/** Build { url, public_id }[] for API from form `image` (strings and/or { url, public_id }). */
/** Summary for success modal after save (variants-aware). */
const buildSuccessSummary = (v) => {
  const variants = Array.isArray(v.variants) ? v.variants : [];
  const def = variants.find((r) => r.isDefault) || variants[0];
  const totalStock = variants.reduce((sum, r) => sum + (Number(r.stock) || 0), 0);
  return {
    name: v.name,
    price: def?.price ?? '',
    unit: def?.label ?? '',
    stock: totalStock,
    variantCount: variants.length,
    variantsSummary: variants
      .map((r) => `${r.label}: ₹${r.price} (stock ${r.stock ?? 0})`)
      .join(' · '),
  };
};

/** Admin table: price column (single vs multiple options). */
function formatPriceCell(row) {
  const count = row.variantCount ?? row.variants?.length ?? 0;
  if (count > 1) {
    const min = row.priceMin ?? row.price;
    const max = row.priceMax ?? row.price;
    const range =
      min === max ? `₹${min}` : `₹${min} – ₹${max}`;
    return { main: range, sub: `${count} pack/size options` };
  }
  const label = row.variants?.[0]?.label || row.unit;
  return {
    main: `₹${row.price}`,
    sub: label ? `Option: ${label}` : null,
  };
}

function variantQty(v) {
  return Number(v.availableQty ?? v.stock ?? 0);
}

function variantThreshold(v) {
  const n = Number(v.thresholdQty ?? v.threshold ?? 10);
  return Number.isFinite(n) ? n : 10;
}

function variantsForStockRow(row) {
  if (Array.isArray(row.variants) && row.variants.length > 0) return row.variants;
  return [
    {
      label: row.unit || 'Standard',
      availableQty: row.stock ?? row.availableQty ?? 0,
      thresholdQty: row.thresholdQty ?? row.threshold ?? 10,
    },
  ];
}

/** Admin table: stock — alert when any size/pack is at or below its own threshold. */
function formatStockCell(row) {
  const variants = variantsForStockRow(row);
  const total = variants.reduce((sum, v) => sum + variantQty(v), 0);
  const lowVariants = variants.filter((v) => variantQty(v) <= variantThreshold(v));
  const isLow = lowVariants.length > 0;

  const breakdown = variants
    .map((v) => {
      const qty = variantQty(v);
      const low = qty <= variantThreshold(v);
      return low ? `${v.label}: ${qty} units (low)` : `${v.label}: ${qty} units`;
    })
    .join(' · ');

  const tooltip = isLow
    ? [
        'Low stock — reorder this size/pack:',
        ...lowVariants.map(
          (v) =>
            `• ${v.label}: ${variantQty(v)} left (alert when ≤ ${variantThreshold(v)})`
        ),
        variants.length > 1 ? `Total across all options: ${total} units` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : variants.length > 1
      ? `Total: ${total} units · ${variants.length} options`
      : `${total} units in stock`;

  const optionLabel = variants.length === 1 ? variants[0]?.label || row.unit : null;

  return {
    main: `${total} units in stock`,
    sub: variants.length > 1 ? breakdown : optionLabel ? `Option: ${optionLabel}` : null,
    isLow,
    tooltip,
    lowLabels: lowVariants.map((v) => v.label).join(', '),
  };
}

const buildImagesPayload = (imageField) => {
  if (!Array.isArray(imageField)) return [];
  return imageField
    .map((entry) => {
      if (typeof entry === 'string') {
        const url = entry.trim();
        return url ? { url, public_id: '' } : null;
      }
      if (entry && typeof entry === 'object' && typeof entry.url === 'string') {
        const url = entry.url.trim();
        if (!url) return null;
        return {
          url,
          public_id: typeof entry.public_id === 'string' ? entry.public_id.trim() : '',
        };
      }
      return null;
    })
    .filter(Boolean);
};

const ProductList = () => {
  const { showToast } = useToast();
  const {
    products,
    categories,
    productsLoading,
    productsError,
    addProduct,
    updateProduct,
    deleteProduct,
    refreshProducts,
    addCategory,
  } = useAppState();

  const [showForm, setShowForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [activePillarId, setActivePillarId] = useState('All');
  const [activeSubCatId, setActiveSubCatId] = useState('All');

  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }

  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('jwtToken');
    if (token) {
      refreshProducts();
    }
  }, [refreshProducts]);

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

        const displayImg = resolveImageUrl({
          imageUrl: row.imageUrl,
          image: row.images ?? row.image,
        });

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
      render: (_v, row) => {
        const { main, sub } = formatPriceCell(row);
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-slate-800">{main}</span>
            {sub && (
              <span className="text-[10px] text-slate-400 font-medium">{sub}</span>
            )}
          </div>
        );
      },
    },

    {
      header: 'Stock',
      accessor: 'stock',
      render: (_v, row) => {
        const { main, sub, isLow, tooltip, lowLabels } = formatStockCell(row);
        return (
          <div
            className={`flex flex-col gap-0.5 max-w-[240px] rounded-lg -m-1 p-1 cursor-help ${
              isLow ? 'bg-red-50/80 ring-1 ring-red-200' : ''
            }`}
            title={tooltip}
          >
            <div className="flex items-center gap-1.5">
              {isLow && <AlertTriangle size={14} className="text-red-500 shrink-0" aria-hidden />}
              <span className={`font-bold ${isLow ? 'text-red-500' : 'text-slate-600'}`}>
                {main}
              </span>
            </div>
            {sub && (
              <span className="text-[10px] text-slate-400 leading-snug">{sub}</span>
            )}
            {isLow && (
              <span className="text-[9px] font-black uppercase tracking-widest text-red-500">
                Low: {lowLabels}
              </span>
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
            Inventory
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
          onImagesPersisted={refreshProducts}
          saving={isSaving}

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
            if (isSaving) return;
            setIsSaving(true);
            try {

              const catObj = categories.find(c => c.id === v.parentCategoryId);
              const subCatObj = categories.find(c => c.id === v.subCategoryId);
              const freeCat =
                typeof v.freeCategoryName === 'string' ? v.freeCategoryName.trim() : '';
              const freeSub =
                typeof v.freeSubcategoryName === 'string' ? v.freeSubcategoryName.trim() : '';

              const imagesPayload = buildImagesPayload(v.image);
              const variantsPayload = (v.variants || []).map((row, idx) => ({
                label: String(row.label || '').trim(),
                price: Number(row.price),
                stock: Math.max(0, Math.floor(Number(row.stock) || 0)),
                isDefault: Boolean(row.isDefault),
                sortOrder: idx,
                variantId: row.variantId || undefined,
                threshold: row.threshold != null ? Number(row.threshold) : 10,
              }));

              const def = variantsPayload.find((r) => r.isDefault) || variantsPayload[0];

              const payload = {
                name: v.name,
                description: v.description || '',
                category: catObj?.name || freeCat || v.parentCategoryId,
                subcategory: subCatObj?.name || freeSub || v.subCategoryId || '',
                variants: variantsPayload,
                price: def?.price,
                unit: def?.label,
                stocks: def?.stock,
                threshold: def?.threshold ?? 10,
                images: imagesPayload,
                imageUrl: imagesPayload[0]?.url || '',
                returnAllowed: v.returnAllowed !== false,
              };

              if (editingItem) {

                const productId =
                  editingItem.productId ||
                  editingItem._id ||
                  editingItem.id;

                await apiService.updateProduct(productId, payload);
                await updateProduct();
                setSuccessData({
                  mode: 'edit',
                  ...buildSuccessSummary(v),
                });
                setShowSuccess(true);

              } else {

                await apiService.addProduct(payload);
                await addProduct();
                setSuccessData({
                  mode: 'add',
                  ...buildSuccessSummary(v),
                });

                setShowSuccess(true);
              }

              setShowForm(false);
              setEditingItem(null);

            } catch (error) {

              console.error("Product save error:", error);

              showToast(
                'error',
                error.response?.data?.message || 'Error saving product'
              );
            } finally {
              setIsSaving(false);
            }
          }}
        />
      )}

      {!showForm && !editingItem && productsLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading inventory...</p>
        </div>
      ) : !showForm && !editingItem && productsError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertCircle className="text-red-600 mt-0.5" size={18} />
          <div className="space-y-3">
            <p className="text-sm font-bold text-red-700">{productsError}</p>
            <button
              onClick={() => refreshProducts()}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest"
            >
              Retry
            </button>
          </div>
        </div>
      ) : !showForm && !editingItem && (
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


      {isSaving && (showForm || editingItem) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-sm font-bold text-slate-700">Saving product…</p>
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
          {successData?.mode === 'edit' ? 'Product Updated' : 'Product Added'}
        </h2>

        <p className="text-slate-500 text-sm">
          <span className="font-bold text-slate-700">
            {successData?.name}
          </span>{' '}
          {successData?.mode === 'edit'
            ? 'has been saved successfully.'
            : 'has been added successfully.'}
        </p>

        <div className="text-xs text-slate-400 space-y-1">
          {successData?.variantCount > 1 ? (
            <>
              <p className="font-semibold text-slate-500">
                {successData.variantCount} options saved
              </p>
              <p className="text-[10px] leading-relaxed break-words">
                {successData.variantsSummary}
              </p>
              <p>Total stock: {successData.stock}</p>
            </>
          ) : (
            <>
              <p>₹{successData?.price} • {successData?.unit}</p>
              <p>Stock: {successData?.stock}</p>
            </>
          )}
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