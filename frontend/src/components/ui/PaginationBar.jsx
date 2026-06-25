"use client";

export const DEFAULT_PAGE_SIZE = 30;

export function paginateItems(items = [], page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return {
    items: items.slice(startIndex, endIndex),
    totalItems,
    totalPages,
    currentPage: safePage,
    startRecord: totalItems === 0 ? 0 : startIndex + 1,
    endRecord: endIndex,
  };
}

function getVisiblePageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage]);

  if (currentPage > 1) pages.add(currentPage - 1);
  if (currentPage < totalPages) pages.add(currentPage + 1);
  if (currentPage > 2) pages.add(currentPage - 2);
  if (currentPage < totalPages - 1) pages.add(currentPage + 2);

  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  let previous = 0;

  for (const page of sorted) {
    if (previous && page - previous > 1) {
      result.push("ellipsis");
    }

    result.push(page);
    previous = page;
  }

  return result;
}

export default function PaginationBar({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  startRecord = 0,
  endRecord = 0,
  itemLabel = "entries",
  onPageChange,
  className = "",
}) {
  if (totalItems === 0) {
    return (
      <div
        className={`shrink-0 border-t border-[#F1F5F9] bg-white px-4 py-3 ${className}`}
      >
        <p className="text-[11px] text-[#64748B]">Showing 0 {itemLabel}</p>
      </div>
    );
  }

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const visiblePages = getVisiblePageNumbers(safeCurrentPage, totalPages);

  return (
    <div
      className={`shrink-0 border-t border-[#F1F5F9] bg-white px-4 py-3 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="shrink-0 text-[11px] text-[#64748B]">
          Showing {startRecord}-{endRecord} of {totalItems} {itemLabel}
        </p>

        <div className="min-w-0 max-w-full overflow-x-auto">
          <div className="flex w-max min-w-full items-center justify-end gap-1 sm:min-w-0">
            <button
              type="button"
              onClick={() => onPageChange?.(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              className="flex h-[28px] min-w-[28px] shrink-0 items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              ‹
            </button>

            {visiblePages.map((page, index) =>
              page === "ellipsis" ? (
                <span
                  key={`ellipsis-${index}`}
                  className="flex h-[28px] min-w-[20px] shrink-0 items-center justify-center px-1 text-[12px] text-[#94A3B8]"
                >
                  …
                </span>
              ) : (
                <button
                  key={page}
                  type="button"
                  onClick={() => onPageChange?.(page)}
                  className={`flex h-[28px] min-w-[28px] shrink-0 items-center justify-center rounded-[6px] px-2 text-[12px] font-semibold ${
                    safeCurrentPage === page
                      ? "bg-[#111827] text-white"
                      : "border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]"
                  }`}
                >
                  {page}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => onPageChange?.(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
              className="flex h-[28px] min-w-[28px] shrink-0 items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#64748B] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
