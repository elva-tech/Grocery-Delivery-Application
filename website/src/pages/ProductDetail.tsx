import React, { useState, useMemo, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, ShoppingBag, Plus, Minus, CheckCircle2
} from 'lucide-react';

import { addToCart, removeFromCart } from '../store/slices/cartSlice';
import { MOCK_PRODUCTS } from '../api/mockdata';
import { useGetProductsQuery } from '../api/apiSlice';
import type { RootState } from '../store/store';
import ProductCard from '../components/products/ProductCard';

const ProductDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [activeImg, setActiveImg] = useState(0);

  const { data: apiProducts = [] } = useGetProductsQuery();

  const allProducts = apiProducts.length 
    ? apiProducts.map(p => ({
        ...p,
        id: p.id || p.productId || p._id, // ⭐ FIX
        description: p.description || "",
        image: p.image || p.imageUrl
      }))
    : MOCK_PRODUCTS;

  useEffect(() => {
    window.scrollTo(0, 0);
    setActiveImg(0);
  }, [productId]);

  // ⭐ FIXED MATCHING LOGIC
  const product = useMemo(() => 
    allProducts.find(p => 
      String(p.id || p.productId || p._id) === String(productId)
    ),
    [productId, allProducts]
  );

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return allProducts
      .filter(p => 
        p.categoryId === product.categoryId && 
        String(p.id) !== String(productId)
      )
      .slice(0, 4);
  }, [product, productId, allProducts]);

  // ⭐ FIXED CART MATCH
  const cartItem = useSelector((state: RootState) => 
    state.cart.items.find(item => String(item.id) === String(productId))
  );

  if (!product) {
    return (
      <div className="p-20 text-center font-black uppercase tracking-tighter text-slate-400">
        Product Not Found
      </div>
    );
  }

  const images = Array.isArray(product.image) ? product.image : [product.image];

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24">
      
      <div className="max-w-7xl mx-auto px-6 py-6">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-[#4b6f9e] font-black uppercase text-xs"
        >
          <ChevronLeft size={18} /> Back
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
          
          {/* IMAGE */}
          <div>
            <div className="aspect-square bg-white rounded-3xl flex items-center justify-center">
              <img 
                src={images[activeImg]} 
                alt={product.name}
                className="w-full h-full object-contain p-10"
              />
            </div>
          </div>

          {/* DETAILS */}
          <div>
            <h1 className="text-4xl font-black mb-2">{product.name}</h1>
            <p className="text-slate-400 mb-6">{product.unit}</p>

            <div className="text-5xl font-black mb-6">₹{product.price}</div>

            {/* DESCRIPTION */}
            <div className="mb-8">
              <h4 className="text-xs font-black uppercase text-slate-400 mb-2">
                Product Description
              </h4>
              <p className="text-slate-600">
                {product.description || "No description available"}
              </p>
            </div>

            {/* CART */}
            {!cartItem ? (
              <button 
                onClick={() => dispatch(addToCart(product))}
                className="bg-[#4b6f9e] text-white px-6 py-4 rounded-2xl flex items-center gap-2"
              >
                <ShoppingBag size={20} /> Add to Basket
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <button onClick={() => dispatch(removeFromCart(product.id))}>
                  <Minus />
                </button>
                <span>{cartItem.quantity}</span>
                <button onClick={() => dispatch(addToCart(product))}>
                  <Plus />
                </button>
              </div>
            )}

            {cartItem && (
              <div className="mt-4 flex items-center gap-2 text-blue-600 text-xs font-bold">
                <CheckCircle2 size={14} /> Added to cart
              </div>
            )}
          </div>
        </div>

        {/* RELATED */}
        {relatedProducts.length > 0 && (
          <div>
            <h3 className="text-2xl font-black mb-6">Related Products</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {relatedProducts.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProductDetail;