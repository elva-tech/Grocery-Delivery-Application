import { useState, useMemo, useEffect, useCallback } from 'react';
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
import type { ProductVariant } from '../api/apiSlice';
import ProductCard from '../components/products/ProductCard';
import { resolveImageGallery } from '../utils/resolveImageUrl';
import { buildCartPayload, cartLineId, getDefaultVariant } from '../utils/productVariants';
import { WEB_COPY } from '../constants/copy';

const ProductDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [activeImg, setActiveImg] = useState(0);

  const { data: allProducts = [] } = useGetProductsQuery(getTenantId());

  useEffect(() => {
    window.scrollTo(0, 0);
    setActiveImg(0);
  }, [productId]);

  const product = useMemo(() => allProducts.find(p => p.id === productId), [productId, allProducts]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return allProducts
      .filter(p => p.parentCategoryId === product.parentCategoryId && p.id !== productId)
      .slice(0, 4);
  }, [product, productId, allProducts]);

  const defaultVariant = useMemo(
    () => (product ? getDefaultVariant(product) : null),
    [product]
  );

  const [selectedVariantId, setSelectedVariantId] = useState('');

  useEffect(() => {
    if (defaultVariant) setSelectedVariantId(defaultVariant.variantId);
  }, [productId, defaultVariant?.variantId]);

  const selectedVariant = useMemo((): ProductVariant | null => {
    if (!product || !defaultVariant) return null;
    const list = product.variants?.length ? product.variants : [defaultVariant];
    return list.find((v) => v.variantId === selectedVariantId) || defaultVariant;
  }, [product, selectedVariantId, defaultVariant]);

  const lineId =
    product && selectedVariant
      ? cartLineId(product.id, selectedVariant.variantId)
      : '';

  const cartItem = useSelector((state: RootState) =>
    lineId ? state.cart.items.find((item) => item.id === lineId) : undefined
  );

  const handleAddToCart = useCallback(() => {
    if (!product || !selectedVariant || selectedVariant.availableQty <= 0) return;
    dispatch(addToCart(buildCartPayload(product, selectedVariant)));
  }, [dispatch, product, selectedVariant]);

  if (!product) {
    return (
      <div className="p-20 text-center font-black uppercase tracking-tighter text-slate-400">
        Product Not Found
      </div>
    );
  }

  const images = resolveImageGallery(product);
  const variantOptions = product.variants?.length ? product.variants : defaultVariant ? [defaultVariant] : [];
  const inStock = (selectedVariant?.availableQty ?? 0) > 0;
  const displayPrice = selectedVariant?.price ?? product.price;
  const displayUnit = selectedVariant?.label ?? product.unit;
  const displayStock = selectedVariant?.availableQty ?? product.stock;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 animate-in fade-in duration-500">
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

          <div className="flex flex-col gap-6 overflow-hidden">
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

              <div className="absolute top-6 left-6 md:top-8 md:left-8 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-2 border border-slate-100 shadow-sm">
                <div className={`w-2 h-2 rounded-full ${displayStock > 10 ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`} />
                <span className="text-[10px] font-black uppercase tracking-tighter text-slate-700">
                  {displayStock > 10 ? 'In Stock' : displayStock > 0 ? `Hurry, only ${displayStock} left` : 'Out of Stock'}
                </span>
              </div>
            </div>

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

          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-6 w-1 bg-[#4b6f9e] rounded-full" />
              <span className="text-[#4b6f9e] font-black text-xs uppercase tracking-widest">Premium Choice</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight mb-2 tracking-tight">
              {product.name}
            </h1>
            <p className="text-lg md:text-xl text-slate-400 font-bold mb-4">{displayUnit}</p>

            {variantOptions.length > 1 && (
              <div className="mb-6">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                  Select option
                </label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-2xl p-4 font-bold text-slate-800 bg-white focus:border-[#4b6f9e] outline-none"
                >
                  {variantOptions.map((v) => (
                    <option key={v.variantId} value={v.variantId} disabled={v.availableQty <= 0}>
                      {v.label} — ₹{v.price}{v.availableQty <= 0 ? ' (Out of stock)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-baseline gap-2 mb-8 md:mb-10">
              <span className="text-5xl md:text-6xl font-black text-[#1e293b]">₹{displayPrice}</span>
              <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">Incl. Taxes</span>
            </div>

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

            <div className="mb-10 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
              <h4 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Product Description</h4>
              <p className="text-slate-600 text-sm leading-relaxed font-medium">
                {product.description || `Freshly sourced ${product.name}. Undergoes rigorous quality checks to ensure you receive only the best produce.`}
              </p>
              {product.returnAllowed === false && (
                <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-200/70 leading-relaxed">
                  {WEB_COPY.product.nonReturnableFootnote}
                </p>
              )}
            </div>

            <div className="mt-auto flex items-center gap-4">
              {!cartItem ? (
                <button
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className={`flex-1 ${!inStock ? 'bg-slate-300' : 'bg-[#4b6f9e] hover:bg-[#1e293b]'} text-white h-20 rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 shadow-xl shadow-blue-900/20 transition-all transform active:scale-95`}
                >
                  <ShoppingBag size={24} />
                  {!inStock ? 'Out of Stock' : 'Add to Basket'}
                </button>
              ) : (
                <div className="flex-1 flex items-center bg-white border-2 border-[#4b6f9e] h-20 rounded-[2rem] overflow-hidden shadow-lg shadow-blue-900/5">
                  <button onClick={() => dispatch(removeFromCart(lineId))} className="w-24 h-full flex items-center justify-center text-[#4b6f9e] hover:bg-slate-50 transition-colors">
                    <Minus size={28} strokeWidth={3} />
                  </button>
                  <span className="flex-1 text-center font-black text-3xl text-slate-800">{cartItem.quantity}</span>
                  <button onClick={handleAddToCart} disabled={!inStock} className="w-24 h-full flex items-center justify-center text-[#4b6f9e] hover:bg-slate-50 transition-colors disabled:opacity-40">
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
