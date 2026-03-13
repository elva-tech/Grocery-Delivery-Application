import React, { useState, useMemo } from 'react';
import { useAppState } from '../../context/AppStateContext';
import DataTable from '../../components/shared/DataTable';
import CustomButton from '../../components/shared/CustomButton';
import ProductForm from './ProductForm';
import CategoryForm from './CategoryForm';
import { Plus, Edit, Trash2, FolderPlus, Package, ChevronRight } from 'lucide-react';
import { APP_CONFIG } from '../../config/appConfig';
import { apiService } from '../../services/apiService';

const ProductList = () => {

  const { products, categories, addProduct, updateProduct, deleteProduct } = useAppState();

  const [showForm, setShowForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [activePillarId, setActivePillarId] = useState('All');
  const [activeSubCatId, setActiveSubCatId] = useState('All');

  const getImageUrl = (imgData) => {
    if (!imgData) return null;
    if (Array.isArray(imgData)) return imgData[0];
    return imgData;
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {

      const matchesPillar =
        activePillarId === 'All' ||
        String(p.parentCategoryId) === String(activePillarId);

      const matchesSub =
        activeSubCatId === 'All' ||
        String(p.subCategoryId) === String(activeSubCatId);

      return matchesPillar && matchesSub;

    });
  }, [products, activePillarId, activeSubCatId]);

  const columns = [

    {
      header: 'Product',
      accessor: 'name',
      render: (val, row) => {

        const displayImg =
          getImageUrl(row.imageUrl || row.images || row.image);

        const subCat =
          categories.find(c => String(c.id) === String(row.subCategoryId));

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
          <h1 className="text-3xl font-bold text-[#1A4D2E]">
            {APP_CONFIG.brand.name} Inventory
          </h1>
          <p className="text-slate-500">
            Live Backend Sync: {products.length} Products
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

      {(showForm || editingItem) && (

        <ProductForm

          initialValues={{
            ...editingItem,
            description: editingItem?.description ?? "",
            stock: editingItem?.stock ?? editingItem?.availableQty ?? 0
          }}

          onCancel={() => {
            setShowForm(false);
            setEditingItem(null);
          }}

          onSubmit={async (v) => {

            try {

              const payload = {
                name: v.name,
                category: v.subCategoryId,
                price: Number(v.price),
                unit: v.unit,
                stocks: Number(v.stock),
                imageUrl: ""
              };

              if (editingItem) {

                const productId =
                  editingItem.productId ||
                  editingItem._id ||
                  editingItem.id;

                await apiService.updateProduct(productId, payload);

                // important: pass editingItem.id to context
                updateProduct(editingItem.id, {

                  ...editingItem,

                  name: v.name,
                  price: Number(v.price),
                  stock: Number(v.stock),
                  description: v.description,

                  parentCategoryId: v.parentCategoryId,
                  subCategoryId: v.subCategoryId

                });

              } else {

                const response =
                  await apiService.addProduct(payload);

                const newProduct =
                  response.product || response;

                addProduct({

                  ...newProduct,

                  name: v.name,
                  price: Number(v.price),
                  stock: Number(v.stock),
                  description: v.description,

                  unit: v.unit,

                  parentCategoryId: v.parentCategoryId,
                  subCategoryId: v.subCategoryId

                });

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

        <DataTable
          columns={columns}
          data={filteredProducts}

          actions={(row) => (

            <div className="flex gap-2">

              <button
                onClick={() => setEditingItem(row)}
                className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
              >
                <Edit size={18} />
              </button>

              <button
                onClick={() =>
                  deleteProduct(row.id)
                }
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>

            </div>

          )}
        />

      )}

    </div>
  );
};

export default ProductList;