import React, { useMemo } from 'react';
import { BarChart2, ShoppingCart } from 'lucide-react';

const DailySalesChart = ({ data = [], isLoading = false, filter, onFilterChange }) => {
  const maxSales = useMemo(
    () => (data.length > 0 ? Math.max(...data.map((d) => d.totalSales), 1) : 1),
    [data]
  );

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 size={18} className="text-blue-500" />
          <h3 className="font-bold text-slate-800">Daily Sales</h3>
        </div>
        <div className="h-64 animate-pulse bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 size={18} className="text-blue-500" /> Daily Sales
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
            Delivered orders only
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg p-2 outline-none cursor-pointer"
        >
          <option value="7">Last 7 Days</option>
          <option value="14">Last 14 Days</option>
          <option value="30" selected>Last 30 Days</option>
          <option value="90">Last 90 Days</option>
        </select>
      </div>

      {data.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl">
          <ShoppingCart size={32} className="text-gray-300 mb-2" />
          <p className="text-slate-400 font-semibold text-sm">No sales data for this period</p>
        </div>
      ) : (
        <>
          <div className="h-64 flex items-end gap-1.5 px-2">
            {data.map((day, i) => {
              const heightPct = (day.totalSales / maxSales) * 100;
              const barHeight = Math.max(heightPct, 2); // ensure minimum visible bar
              return (
                <div
                  key={day.date || i}
                  className="flex flex-col items-center flex-1 group relative"
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-transform bg-slate-800 text-white text-[10px] py-1.5 px-2 rounded-lg font-bold z-20 whitespace-nowrap pointer-events-none">
                    <div>₹{day.totalSales.toLocaleString('en-IN')}</div>
                    <div className="text-slate-400">{day.orderCount} orders</div>
                  </div>

                  {/* Bar */}
                  <div
                    className="w-full rounded-t-lg transition-all duration-700"
                    style={{
                      height: `${barHeight}%`,
                      background: 'linear-gradient(to top, #3b82f6, #93c5fd)',
                    }}
                  />

                  {/* Order count badge */}
                  {day.orderCount > 0 && (
                    <span className="absolute -top-5 text-[9px] font-black text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      {day.orderCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* X-axis labels */}
          <div className="flex gap-1.5 px-2 mt-2">
            {data.map((day, i) => (
              <div key={i} className="flex-1 text-center">
                <span className="text-[9px] text-gray-400 font-bold uppercase">
                  {formatDate(day.date)}
                </span>
              </div>
            ))}
          </div>

          {/* Summary row */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-xs font-bold">
            <span className="text-slate-500">
              Total Orders:{' '}
              <span className="text-slate-800">
                {data.reduce((s, d) => s + d.orderCount, 0)}
              </span>
            </span>
            <span className="text-slate-500">
              Total Sales:{' '}
              <span className="text-emerald-600">
                ₹{data.reduce((s, d) => s + d.totalSales, 0).toLocaleString('en-IN')}
              </span>
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default DailySalesChart;
