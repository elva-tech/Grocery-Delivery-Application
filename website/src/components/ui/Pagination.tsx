import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  totalItems: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

const Pagination: React.FC<PaginationProps> = ({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [12, 24, 48],
}) => {
  if (!totalItems) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const rangeStart = (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-4 mt-4 border-t border-slate-100">

      {/* Rows per page */}
      <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
        <span>Show:</span>
        <div className="flex gap-1">
          {pageSizeOptions.map(n => (
            <button
              key={n}
              onClick={() => { onPageSizeChange(n); onPageChange(1); }}
              className={`px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all
                ${pageSize === n
                  ? 'bg-[#4b6f9e] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <span className="text-[11px] font-bold text-slate-400">
        {rangeStart}–{rangeEnd} of {totalItems} products
      </span>

      {/* Navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={safePage === 1}
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-500"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-500"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-black text-xs">
          {safePage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage === totalPages}
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-500"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={safePage === totalPages}
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-500"
        >
          <ChevronsRight size={16} />
        </button>
      </div>

    </div>
  );
};

export default Pagination;
