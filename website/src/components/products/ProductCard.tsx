import React, { memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus } from 'lucide-react';
import { addToCart, removeFromCart } from '../../store/slices/cartSlice';
import type { RootState } from '../../store/store';

const ProductCard = memo(({ product }: { product: any }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const productId = product.productId || product.id || product._id; // ⭐ FIX

  const cartItem = useSelector((state: RootState) =>
    state.cart.items.find((item: any) => String(item.id) === String(productId))
  );
  const quantity = cartItem?.quantity || 0;

  const imageSrc = Array.isArray(product.image)
    ? product.image[0]
    : product.image || product.imageUrl; // ⭐ SAFE FIX

  return (
    <div
      onClick={() => navigate(`/product/${productId}`)} // ⭐ FIX
      className="bg-white p-2 sm:p-4 rounded-[1.2rem] sm:rounded-[2rem] border border-slate-100 flex flex-col h-full hover:shadow-xl hover:shadow-slate-200/50 transition-all group cursor-pointer relative"
    >
      {/* IMAGE */}
      <div className="aspect-square w-full bg-[#f8fafc] rounded-xl sm:rounded-2xl p-2 mb-2 sm:mb-3 flex items-center justify-center overflow-hidden">
        <img
          src={imageSrc}
          loading="lazy"
          className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-500"
          alt={product.name}
        />
      </div>

      {/* INFO */}
      <div className="flex-1 min-w-0">
        <h4 className="text-[10px] sm:text-xs font-black line-clamp-2 leading-tight text-[#1e293b] uppercase tracking-tighter mb-0.5 sm:mb-1">
          {product.name}
        </h4>
        <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold italic block truncate">
          {product.unit || '500ml'}
        </span>
      </div>

      {/* PRICE + CART */}
      <div className="mt-2 sm:mt-3 flex items-center justify-between gap-1">
        <div>
          <span className="text-xs sm:text-lg font-black italic text-[#1e293b]">
            ₹{product.price}
          </span>
        </div>

        <div className="relative z-10">
          {quantity === 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                dispatch(addToCart({ ...product, id: productId })); // ⭐ FIX
              }}
              className="bg-[#4b6f9e] text-white w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md hover:bg-[#1e293b] active:scale-90 transition-all"
            >
              <Plus size={16} strokeWidth={3} />
            </button>
          ) : (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col sm:flex-row items-center bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl overflow-hidden shadow-sm"
            >
              <button
                onClick={() => dispatch(removeFromCart(productId))} // ⭐ FIX
                className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Minus size={12} strokeWidth={3} />
              </button>

              <span className="text-[10px] font-black w-5 sm:w-6 text-center text-[#1e293b] bg-white sm:bg-transparent py-0.5 sm:py-0">
                {quantity}
              </span>

              <button
                onClick={() =>
                  dispatch(addToCart({ ...product, id: productId })) // ⭐ FIX
                }
                className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-[#4b6f9e] hover:bg-blue-50 transition-colors"
              >
                <Plus size={12} strokeWidth={3} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';
export default ProductCard;