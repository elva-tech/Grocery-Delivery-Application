import { memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus } from 'lucide-react';
import { addToCart, removeFromCart } from '../../store/slices/cartSlice';
import type { RootState } from '../../store/store';
import { resolveImageUrl } from '../../utils/resolveImageUrl';
import {
  buildCartPayload,
  cartLineId,
  getDisplayVariant,
  getPurchasableVariant,
  isProductPurchasable,
} from '../../utils/productVariants';

const ProductCard = memo(({ product }: { product: any }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const displayVariant = getDisplayVariant(product);
  const purchasableVariant = getPurchasableVariant(product);
  const inStock = isProductPurchasable(product);
  const lineId = purchasableVariant
    ? cartLineId(product.id, purchasableVariant.variantId)
    : cartLineId(product.id, displayVariant.variantId);

  const cartItem = useSelector((state: RootState) =>
    state.cart.items.find((item: any) => item.id === lineId)
  );
  const quantity = cartItem?.quantity || 0;
  const atMaxStock =
    inStock &&
    purchasableVariant != null &&
    quantity >= (purchasableVariant.availableQty ?? 0);

  const imageSrc = resolveImageUrl(product);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!purchasableVariant || atMaxStock) return;
    dispatch(addToCart(buildCartPayload(product, purchasableVariant)));
  };

  return (
    <div
      onClick={() => navigate(`/product/${product.id}`)}
      className={`bg-white p-2 sm:p-4 rounded-[1.2rem] sm:rounded-[2rem] border flex flex-col h-full transition-all group cursor-pointer relative ${
        inStock
          ? 'border-slate-100 hover:shadow-xl hover:shadow-slate-200/50'
          : 'border-slate-200 opacity-60 grayscale-[0.35]'
      }`}
    >
      {!inStock && (
        <span className="absolute top-3 left-3 z-10 px-2 py-1 rounded-lg bg-slate-800/90 text-white text-[9px] font-black uppercase tracking-widest">
          Out of stock
        </span>
      )}

      <div className="aspect-square w-full bg-[#f8fafc] rounded-xl sm:rounded-2xl p-2 mb-2 sm:mb-3 flex items-center justify-center overflow-hidden">
        {imageSrc ? (
          <img
            src={imageSrc}
            loading="lazy"
            className={`max-h-full max-w-full object-contain transition-transform duration-500 ${
              inStock ? 'group-hover:scale-110' : ''
            }`}
            alt={product.name}
          />
        ) : (
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">No Image</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-[10px] sm:text-xs font-black line-clamp-2 leading-tight text-[#1e293b] uppercase tracking-tighter mb-0.5 sm:mb-1">
          {product.name}
        </h4>
        <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold italic block truncate">
          {product.variantCount && product.variantCount > 1
            ? `${product.variantCount} options`
            : (product.unit || displayVariant.label)}
        </span>
      </div>

      <div className="mt-2 sm:mt-3 flex items-center justify-between gap-1">
        <div className="flex flex-col">
          <span className={`text-xs sm:text-lg font-black italic ${inStock ? 'text-[#1e293b]' : 'text-slate-400'}`}>
            ₹{product.price}
          </span>
        </div>

        <div className="relative z-10">
          {!inStock ? (
            <span className="px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl bg-slate-100 text-slate-500 text-[8px] sm:text-[10px] font-black uppercase tracking-wide">
              Unavailable
            </span>
          ) : quantity === 0 ? (
            <button
              onClick={handleAdd}
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
                onClick={() => dispatch(removeFromCart(lineId))}
                className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Minus size={12} strokeWidth={3} />
              </button>

              <span className="text-[10px] font-black w-5 sm:w-6 text-center text-[#1e293b] bg-white sm:bg-transparent py-0.5 sm:py-0">
                {quantity}
              </span>

              <button
                onClick={handleAdd}
                disabled={atMaxStock}
                className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-[#4b6f9e] hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
