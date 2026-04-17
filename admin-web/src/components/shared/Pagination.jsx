import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Reusable pagination bar.
 *
 * Props:
 *   totalItems   {number}   — total number of items across all pages
 *   pageSize     {number}   — items per page
 *   currentPage  {number}   — current page (1-based)
 *   onPageChange {fn}       — called with new page number
 *   onPageSizeChange {fn}   — called with new page size
 *   pageSizeOptions {number[]} — list of page-size options (default: [10,25,50,100])
 */
const Pagination = ({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}) => {
  if (!totalItems) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const rangeStart = (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-1 pt-2">

      {/* Rows per page */}
      <div className="flex items-center gap-2 text-sm text-slate-500 font-semibold">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
          className="border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white outline-none focus:border-emerald-300 cursor-pointer"
        >
          {pageSizeOptions.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Count */}
      <span className="text-sm text-slate-400 font-semibold">
        {rangeStart}–{rangeEnd} of {totalItems}
      </span>

      {/* Navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={safePage === 1}
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-black text-xs">
          {safePage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage === totalPages}
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={safePage === totalPages}
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight size={16} />
        </button>
      </div>

    </div>
  );
};

export default Pagination;
