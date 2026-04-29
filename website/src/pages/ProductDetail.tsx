import { useState, useMemo, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ShoppingBag, ShieldCheck,
  Leaf, ThermometerSnowflake, Plus, Minus, CheckCircle2,
} from 'lucide-react';

import { addToCart, removeFromCart } from '../store/slices/cartSlice';
import { useGetProductsQuery } from '../api/apiSlice';
import { getTenantId } from '../utils/getTenantId';
import type { RootState } from '../store/store';
import ProductCard from '../components/products/ProductCard';
import { resolveImageGallery } from '../utils/resolveImageUrl';

const ProductDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [activeImg, setActiveImg] = useState(0);

  const { data: allProducts = [] } = useGetProductsQuery(getTenantId());

  // Auto-scroll to top when product changes
  useEffect(() => {
    window.scrollTo(0, 0);
    setActiveImg(0);
  }, [productId]);

  // 1. Logic: Find Current Product
  const product = useMemo(() => allProducts.find(p => p.id === productId), [productId, allProducts]);
  const isOutOfStock = product?.stock === 0;

  // 2. Logic: Dynamic Related Products (same parent category)
  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return allProducts
      .filter(p => p.parentCategoryId === product.parentCategoryId && p.id !== productId)
      .slice(0, 4);
  }, [product, productId, allProducts]);

  const cartItem = useSelector((state: RootState) =>
    state.cart.items.find(item => item.id === productId)
  );

  if (!product) return <div className="p-20 text-center font-black uppercase tracking-tighter text-slate-400">Product Not Found</div>;

  const images = resolveImageGallery(product);

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 animate-in fade-in duration-500">
      {/* Navigation */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <button
          onClick={() => navigate(-1)}
          className="group flex items-center gap-2 text-slate-500 hover:text-[#4b6f9e] transition-all font-black uppercase text-xs tracking-widest"
        >
          <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Back to Shop
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">

          {/* LEFT: Image Gallery */}
          <div className="flex flex-col gap-6 overflow-hidden">
            {/* Main Image: Fixed Aspect Ratio */}
            <div className="aspect-square w-full bg-white rounded-[2.5rem] md:rounded-[3rem] overflow-hidden shadow-xl shadow-blue-900/5 border border-slate-100 relative group flex items-center justify-center">
              {images[activeImg] ? (
                <img
                  src={images[activeImg]}
                  alt={product.name}
                  className="w-full h-full object-contain p-8 md:p-12 transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">No Image Available</span>
              )}
              <div className="absolute top-6 left-6 md:top-8 md:left-8 z-20">
                <span
                  className={`text-white text-[8px] px-2 py-0.5 rounded-md font-bold ${product.stock === 0
                      ? 'bg-red-500'
                      : product.stock <= 10
                        ? 'bg-orange-400'
                        : 'hidden'
                    }`}
                >
                  {product.stock === 0
                    ? 'OUT OF STOCK'
                    : product.stock > 10
                      ? 'IN STOCK'
                      : `LOW STOCK`}
                </span>
              </div>
            </div>

            {/* Thumbnails: Horizontal Scroll with Snap */}
            {images.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-4 px-2 snap-x snap-mandatory scrollbar-hide lg:justify-start">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImg(idx)}
                    className={`flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-2xl border-2 transition-all p-2 bg-white snap-center ${activeImg === idx ? 'border-[#4b6f9e] shadow-lg scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    {img ? (
                      <img src={img} className="w-full h-full object-contain" alt={`${product.name} thumbnail ${idx}`} />
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">No Image</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Product Details */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-6 w-1 bg-[#4b6f9e] rounded-full"></div>
              <span className="text-[#4b6f9e] font-black text-xs uppercase tracking-widest">Premium Choice</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight mb-2 tracking-tight">
              {product.name}
            </h1>
            <p className="text-lg md:text-xl text-slate-400 font-bold mb-8">{product.unit} • Freshly Packaged</p>

            <div className="flex items-baseline gap-2 mb-8 md:mb-10">
              <span className="text-5xl md:text-6xl font-black text-[#1e293b]">₹{product.price}</span>
              <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">Incl. Taxes</span>
            </div>

            {/* Feature Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-[#4b6f9e] rounded-lg"><Leaf size={18} /></div>
                <span className="text-[10px] font-black text-slate-700 uppercase">100% Organic</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-[#4b6f9e] rounded-lg"><ShieldCheck size={18} /></div>
                <span className="text-[10px] font-black text-slate-700 uppercase">Quality Seal</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-[#4b6f9e] rounded-lg"><ThermometerSnowflake size={18} /></div>
                <span className="text-[10px] font-black text-slate-700 uppercase">Cold Chain</span>
              </div>
            </div>

            {/* Content Filler: Product Description Section */}

            <div className="mb-10 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
              <h4 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Product Description</h4>
              <p className="text-slate-600 text-sm leading-relaxed font-medium">
                {/* REPLACE THE HARDCODED TEXT WITH THIS */}
                {product.description || `Freshly sourced ${product.name}. Undergoes rigorous quality checks to ensure you receive only the best produce.`}
              </p>
            </div>
            {/* Info Table */}
            {/* <div className="grid grid-cols-3 gap-2 mb-8 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-slate-400"><Clock size={14}/> <span className="text-[9px] font-black uppercase tracking-widest">Shelf Life</span></div>
                <p className="text-xs font-bold text-slate-700">5-7 Days</p>
              </div>
              <div className="flex flex-col gap-1 border-x border-slate-200 px-4">
                <div className="flex items-center gap-1.5 text-slate-400"><Globe size={14}/> <span className="text-[9px] font-black uppercase tracking-widest">Origin</span></div>
                <p className="text-xs font-bold text-slate-700">Local Farms</p>
              </div>
              <div className="flex flex-col gap-1 pl-4">
                <div className="flex items-center gap-1.5 text-slate-400"><Info size={14}/> <span className="text-[9px] font-black uppercase tracking-widest">Storage</span></div>
                <p className="text-xs font-bold text-slate-700">Refrigerate</p>
              </div>
            </div> */}

            {/* Nutritional Dropdown */}
            {/* <div className="mb-10">
                <button 
                 onClick={() => setShowNutrients(!showNutrients)}
                 className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  <span className="font-black text-xs uppercase tracking-widest text-slate-600">Nutritional Information</span>
                  <ChevronDown size={18} className={`transition-transform duration-300 ${showNutrients ? 'rotate-180' : ''}`} />
                </button>
                {showNutrients && (
                  <div className="p-6 grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                     <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-[11px] text-slate-400 font-bold uppercase">Energy</span><span className="text-xs font-black">64 kcal</span></div>
                     <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-[11px] text-slate-400 font-bold uppercase">Protein</span><span className="text-xs font-black">3.3g</span></div>
                     <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-[11px] text-slate-400 font-bold uppercase">Fat</span><span className="text-xs font-black">3.6g</span></div>
                     <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-[11px] text-slate-400 font-bold uppercase">Calcium</span><span className="text-xs font-black">120mg</span></div>
                  </div>
                )}
            </div> */}

            {/* Action Area */}
            <div className="mt-auto flex items-center gap-4">
              {!cartItem ? (

                //out of stock fix
                <button
                  onClick={() => dispatch(addToCart(product))}
                  disabled={isOutOfStock}
                  className={`flex-1 ${isOutOfStock
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-[#4b6f9e] hover:bg-[#1e293b]'
                    } text-white h-20 rounded-[2rem] font-black text-xl flex items-center justify-center gap-3`}
                >
                  {isOutOfStock ? 'Out of Stock' : 'Add to Basket'}
                </button>
              ) : (
                <div className="flex-1 flex items-center bg-white border-2 border-[#4b6f9e] h-20 rounded-[2rem] overflow-hidden shadow-lg shadow-blue-900/5">
                  <button onClick={() => dispatch(removeFromCart(product.id))} className="w-24 h-full flex items-center justify-center text-[#4b6f9e] hover:bg-slate-50 transition-colors">
                    <Minus size={28} strokeWidth={3} />
                  </button>
                  <span className="flex-1 text-center font-black text-3xl text-slate-800">{cartItem.quantity}</span>
                  <button onClick={() => dispatch(addToCart(product))} className="w-24 h-full flex items-center justify-center text-[#4b6f9e] hover:bg-slate-50 transition-colors">
                    <Plus size={28} strokeWidth={3} />
                  </button>
                </div>
              )}
            </div>

            {cartItem && (
              <div className="mt-6 flex items-center gap-2 text-[#4b6f9e] font-black text-[10px] bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 animate-in fade-in slide-in-from-top-2 uppercase tracking-widest">
                <CheckCircle2 size={16} /> Item added to your basket
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Related Products */}
        {relatedProducts.length > 0 && (
          <section className="border-t border-slate-100 pt-16">
            <div className="mb-10">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">You Might Also Like</h3>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Similar items in {product.subcategory || product.category}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {relatedProducts.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default ProductDetail;