import React from 'react';
import resolveImageUrl from '../../utils/resolveImageUrl';

const ProductCard = ({ product }) => {
  // Define colors based on category
  const categoryColors = {
    'Milk': 'bg-blue-100 text-blue-700 border-blue-200',
    'Sweets': 'bg-amber-100 text-amber-700 border-amber-200',
    'Curd': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Dairy Solids': 'bg-purple-100 text-purple-700 border-purple-200',
    'Ice Creams': 'bg-pink-100 text-pink-700 border-pink-200',
  };

  const badgeStyle = categoryColors[product.category] || 'bg-gray-100 text-gray-700 border-gray-200';
  const imageSrc = resolveImageUrl({
    imageUrl: product.imageUrl,
    image: product.images ?? product.image,
  });

  return (
    <div className="group relative bg-white rounded-[24px] border border-slate-100 p-4 hover:shadow-xl transition-all duration-300">
      {/* IMAGE CONTAINER */}
      <div className="relative aspect-square rounded-[18px] overflow-hidden mb-4 bg-slate-50">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
            No Image
          </div>
        )}
        
        {/* CATEGORY BADGE - OVERLAY */}
        <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${badgeStyle}`}>
          {product.category}
        </div>

        {/* STOCK OVERLAY (Only shows if low) */}
        {product.stock < 10 && (
          <div className="absolute bottom-3 right-3 bg-red-500 text-white text-[10px] px-2 py-1 rounded-md font-bold animate-pulse">
            Low Stock
          </div>
        )}
      </div>

      {/* PRODUCT INFO */}
      <div className="space-y-1">
        <h4 className="font-bold text-slate-800 text-sm truncate">{product.name}</h4>
        <div className="flex justify-between items-center">
          <span className="text-emerald-600 font-black text-lg">₹{product.price}</span>
          <span className="text-slate-400 text-[11px] font-bold">{product.stock} Units</span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;