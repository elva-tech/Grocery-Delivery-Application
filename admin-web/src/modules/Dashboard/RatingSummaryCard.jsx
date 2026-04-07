import React from 'react';
import { Star, AlertTriangle } from 'lucide-react';

const StarRating = ({ value, size = 14 }) => (
  <span className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star
        key={s}
        size={size}
        className={s <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}
      />
    ))}
  </span>
);

const RatingSummaryCard = ({ data, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Star size={18} className="text-amber-400 fill-amber-400" />
          <h3 className="font-bold text-slate-800">Customer Ratings</h3>
        </div>
        <div className="animate-pulse h-32 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  const hasData = data?.totalRatings > 0;

  return (
    <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Star size={18} className="fill-amber-400 text-amber-400" /> Customer Ratings
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
            From delivered orders
          </p>
        </div>
        {hasData && data.lowRatings > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-black text-red-500 bg-red-50 px-2 py-1 rounded-lg">
            <AlertTriangle size={12} /> {data.lowRatings} low
          </span>
        )}
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-200 rounded-2xl">
          <Star size={28} className="text-gray-300 mb-2" />
          <p className="text-slate-400 font-semibold text-sm">No ratings yet</p>
        </div>
      ) : (
        <div className="flex gap-6 items-center">
          {/* Big average */}
          <div className="text-center shrink-0">
            <p className="text-5xl font-black text-slate-800 leading-none">{data.avgRating}</p>
            <StarRating value={data.avgRating} size={16} />
            <p className="text-[10px] text-slate-400 font-bold mt-1">{data.totalRatings} reviews</p>
          </div>

          {/* Distribution bars */}
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = data.distribution?.[star] ?? 0;
              const pct = data.totalRatings > 0 ? (count / data.totalRatings) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 w-4 text-right">{star}</span>
                  <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 w-5">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RatingSummaryCard;
