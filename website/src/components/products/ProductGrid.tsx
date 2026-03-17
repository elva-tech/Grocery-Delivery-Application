import React from 'react';
import { ShoppingBag } from 'lucide-react';
import ProductCard from './ProductCard';

interface ProductGridProps {
  products: any[];
}

const ProductGrid: React.FC<ProductGridProps> = ({ products }) => {
  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 opacity-40">
        <ShoppingBag size={64} strokeWidth={1} />
        <p className="mt-4 font-bold">No items found</p>
      </div>
    );
  }

  return (
    <div className="w-full grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {(products || []).map((product) => (
        <ProductCard 
          key={product.id || product.productId} 
          product={product} 
        />
      ))}
    </div>
  );
};
export default ProductGrid;