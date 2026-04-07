import React from 'react';
import { Award, Package, IndianRupee } from 'lucide-react';

const rankColors = ['#f59e0b', '#94a3b8', '#b45309', '#10b981', '#6366f1'];
const rankLabels = ['1st', '2nd', '3rd', '4th', '5th'];

const TopProductsSection = ({ data = [], isLoading = false }) => {
  const maxQty = data.length > 0 ? Math.max(...data.map((p) => p.totalQty), 1) : 1;

  if (isLoading) {
    return (
      <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Award size={18} className="text-amber-500" />
          <h3 className="font-bold text-slate-800">Top Selling Products</h3>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse h-12 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Award size={18} className="text-amber-500" />
          <h3 className="font-bold text-slate-800">Top Selling Products</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-2xl">
          <Package size={32} className="text-gray-300 mb-2" />
          <p className="text-slate-400 font-semibold text-sm">No delivered orders yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Award size={18} className="text-amber-500" /> Top Selling Products
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
            Based on delivered orders
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {data.map((product, i) => (
          <div key={product.productId || i} className="group">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-[10px] font-black w-8 text-center py-0.5 rounded-md shrink-0"
                  style={{ backgroundColor: rankColors[i] + '22', color: rankColors[i] }}
                >
                  {rankLabels[i] || `#${i + 1}`}
                </span>
                <span className="text-sm font-semibold text-slate-700 truncate">
                  {product.name || 'Unknown Product'}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2 text-right">
                <span className="text-[11px] font-bold text-slate-500">
                  {product.totalQty} units
                </span>
                <span className="text-[11px] font-black text-emerald-600 flex items-center gap-0.5">
                  <IndianRupee size={10} />
                  {product.totalRevenue.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(product.totalQty / maxQty) * 100}%`,
                  backgroundColor: rankColors[i],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopProductsSection;
