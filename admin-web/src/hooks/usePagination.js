import { useState, useMemo } from 'react';

/**
 * usePagination
 *
 * @param {any[]} items       — full array to paginate
 * @param {number} initialSize — default page size (default: 10)
 *
 * Returns:
 *   currentPage, pageSize, totalPages, safeCurrentPage
 *   paginatedItems          — sliced array for the current page
 *   setCurrentPage
 *   setPageSize             — also resets to page 1
 *   goToPage(n)             — safe clamped navigation
 */
const usePagination = (items = [], initialSize = 10) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    return items.slice(
      (safeCurrentPage - 1) * pageSize,
      safeCurrentPage * pageSize
    );
  }, [items, safeCurrentPage, pageSize]);

  const setPageSize = (size) => {
    setPageSizeState(size);
    setCurrentPage(1);
  };

  const goToPage = (n) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, n)));
  };

  return {
    currentPage: safeCurrentPage,
    pageSize,
    totalPages,
    paginatedItems,
    setCurrentPage,
    setPageSize,
    goToPage,
  };
};

export default usePagination;
