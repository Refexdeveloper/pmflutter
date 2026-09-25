import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** True when viewport is lg+ (desktop boundary for ProjectDashboard). */
export function useIsDesktopLg() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return isDesktop;
}

export function MobileFiltersButton({ count = 0, onClick, className = '' }) {
  const active = Number(count) > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
        active
          ? 'border-[#1E88E5]/50 bg-[#E8F0FE] text-[#1E62F0]'
          : 'border-slate-200 bg-white text-slate-700'
      } ${className}`}
    >
      <i className="ri-filter-3-line text-sm" aria-hidden />
      Filters{active ? ` (${count})` : ''}
    </button>
  );
}

export function MobileActiveFilterChips({ chips = [] }) {
  if (!Array.isArray(chips) || chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
        >
          <span className="truncate">{chip.label}</span>
          <i className="ri-close-line shrink-0 text-sm text-slate-400" aria-hidden />
        </button>
      ))}
    </div>
  );
}

/**
 * Mobile-only bottom sheet for stacked filter controls.
 * Desktop must not render this (caller gates with lg:hidden / useIsDesktopLg).
 */
export default function MobileFilterSheet({
  open,
  title = 'Filters',
  onClose,
  onClear,
  onApply,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close filters"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[min(88vh,640px)] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-[11px] font-medium text-slate-500">Tap Apply to update the view</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50"
            aria-label="Close"
          >
            <i className="ri-close-line text-xl" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
          {children}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onApply}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#1E88E5] text-sm font-semibold text-white shadow-sm"
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function MobileFilterField({ label, children }) {
  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
