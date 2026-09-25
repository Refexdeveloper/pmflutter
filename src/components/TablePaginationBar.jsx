import { useMemo } from 'react';

export const PT_TABLE_PAGE_SIZE = 10;

/** Sorted unique page indices with gaps filled visually via ellipsis in the UI */
export function compactPageIndices(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current, current - 1, current + 1, current - 2, current + 2]);
  return [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
}

/**
 * Shared table footer pagination — same UX as ProjectDashboardPage tables.
 */
export default function TablePaginationBar({
  total,
  page,
  onPageChange,
  pageSize = PT_TABLE_PAGE_SIZE,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, total);
  const pageIndexList = useMemo(
    () => compactPageIndices(safePage, totalPages),
    [safePage, totalPages],
  );

  if (total <= 0) return null;

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-2 py-2.5 sm:flex-row sm:gap-3 sm:px-5 sm:py-3 lg:items-stretch">
      <p className="w-full text-center text-[10px] text-slate-500 sm:w-auto sm:text-left sm:text-xs lg:text-xs">
        Showing <span className="font-semibold text-slate-700">{pageStart}</span>–
        <span className="font-semibold text-slate-700">{pageEnd}</span> of{' '}
        <span className="font-semibold text-slate-700">{total}</span>
        {totalPages > 1 ? <span className="text-slate-400"> · {pageSize} per page</span> : null}
      </p>
      <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-0.5 sm:w-auto sm:max-w-none sm:gap-1 lg:justify-end">
        <button
          type="button"
          aria-label="First page"
          disabled={safePage <= 1}
          onClick={() => onPageChange(1)}
          className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:text-sm"
        >
          «
        </button>
        <button
          type="button"
          aria-label="Previous page"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:text-sm"
        >
          ‹
        </button>
        {pageIndexList.map((n, idx) => (
          <span key={n} className="flex items-center">
            {idx > 0 && pageIndexList[idx - 1] !== n - 1 ? (
              <span className="px-1.5 text-xs font-medium text-slate-400" aria-hidden>
                …
              </span>
            ) : null}
            <button
              type="button"
              aria-label={`Page ${n}`}
              aria-current={n === safePage ? 'page' : undefined}
              onClick={() => onPageChange(n)}
              className={`flex h-7 min-w-[1.6rem] items-center justify-center rounded-md border px-1.5 text-[10px] font-semibold shadow-sm transition sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:px-2 sm:text-xs ${
                n === safePage
                  ? 'border-[#1E88E5] bg-[#1E88E5] text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {n}
            </button>
          </span>
        ))}
        <button
          type="button"
          aria-label="Next page"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:text-sm"
        >
          ›
        </button>
        <button
          type="button"
          aria-label="Last page"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:text-sm"
        >
          »
        </button>
      </div>
    </div>
  );
}
