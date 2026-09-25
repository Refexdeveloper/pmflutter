import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { attachMenuWheelGuard, isScrollEventInsideEl, PORTAL_MENU_Z_INDEX } from '../lib/portalMenuGuards.js';

/**
 * Shared table column headers for Project Tracker.
 * - SortHeader: dates / numbers (click toggles sort)
 * - FilterHeader: categorical cols (click opens distinct-value dropdown; optional sort in menu)
 */

export function SortHeader({ label, colKey, sortKey, sortDir, onSort, className = '' }) {
  const active = sortKey === colKey;
  return (
    <th className={`whitespace-nowrap px-5 py-3 text-left ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSort?.(colKey);
        }}
        className={`group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
          active ? 'text-[#1E88E5]' : 'text-[#7F8C8D] hover:text-slate-900'
        }`}
      >
        {label}
        <span className="flex flex-col leading-none opacity-70">
          <i
            className={`ri-arrow-up-s-fill text-[10px] ${
              active && sortDir === 'asc' ? 'text-[#1E88E5] opacity-100' : 'text-slate-300 group-hover:text-slate-400'
            }`}
            aria-hidden
          />
          <i
            className={`-mt-1 ri-arrow-down-s-fill text-[10px] ${
              active && sortDir === 'desc' ? 'text-[#1E88E5] opacity-100' : 'text-slate-300 group-hover:text-slate-400'
            }`}
            aria-hidden
          />
        </span>
      </button>
    </th>
  );
}

/** Looks like a quiet header until clicked — then opens a compact filter menu. */
export function FilterHeader({
  label,
  colKey,
  sortKey,
  sortDir,
  onSort,
  filterValue = 'all',
  filterOptions = [],
  onFilterChange,
  className = '',
}) {
  const active = sortKey === colKey;
  const filtered = filterValue != null && filterValue !== 'all';
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const pointerInsideMenuRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);

  const close = useCallback(() => {
    pointerInsideMenuRef.current = false;
    setOpen(false);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return false;
    const rect = btn.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    // Keep menu usable even if the header drifts — never auto-dismiss from scroll.
    const spaceBelow = Math.max(120, viewportH - Math.min(rect.bottom, viewportH) - 12);
    const spaceAbove = Math.max(120, Math.max(rect.top, 0) - 12);
    const preferUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxH = Math.min(280, preferUp ? spaceAbove : spaceBelow);
    const width = Math.max(180, Math.min(260, rect.width + 80));
    let left = Math.min(Math.max(8, rect.left), Math.max(8, viewportW - width - 8));
    const top = preferUp ? undefined : Math.min(viewportH - maxH - 8, Math.max(8, rect.bottom + 6));
    const bottom = preferUp
      ? Math.min(viewportH - 8, Math.max(8, viewportH - rect.top + 6))
      : undefined;
    setMenuStyle({
      position: 'fixed',
      left,
      width,
      maxHeight: Math.max(160, maxH),
      zIndex: PORTAL_MENU_Z_INDEX,
      ...(preferUp ? { bottom, top: undefined } : { top, bottom: undefined }),
    });
    return true;
  }, []);

  const openMenu = useCallback(() => {
    updateMenuPosition();
    setOpen(true);
  }, [updateMenuPosition]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    const onScrollOrResize = (e) => {
      // Never dismiss on scroll. Ignore in-menu / pointer-over-menu scrolls entirely.
      if (e?.type === 'scroll' && isScrollEventInsideEl(e, menuRef.current, pointerInsideMenuRef)) {
        return;
      }
      // Outer scroll/resize: reposition only (no close).
      updateMenuPosition();
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, close, updateMenuPosition]);

  // Block wheel scroll-chaining into .rootDiv / table (that used to yank the header away and close).
  useLayoutEffect(() => {
    if (!open) return undefined;
    return attachMenuWheelGuard(menuRef.current);
  }, [open, menuStyle]);

  const menu =
    open && menuStyle
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={`Filter ${label}`}
            style={menuStyle}
            onPointerEnter={() => {
              pointerInsideMenuRef.current = true;
            }}
            onPointerLeave={() => {
              pointerInsideMenuRef.current = false;
            }}
            className="overflow-y-auto overscroll-contain rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg shadow-slate-200/50"
          >
            {filterOptions.map((opt) => {
              const selected = String(filterValue) === String(opt.value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onFilterChange?.(opt.value);
                    close();
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition ${
                    selected
                      ? 'bg-blue-50 font-semibold text-[#1E88E5]'
                      : 'font-medium text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  {selected ? <i className="ri-check-line shrink-0 text-sm text-[#1E88E5]" aria-hidden /> : null}
                </button>
              );
            })}
            {typeof onSort === 'function' ? (
              <div className="sticky bottom-0 border-t border-slate-100 bg-white px-1 py-1">
                <button
                  type="button"
                  onClick={() => {
                    onSort(colKey);
                    close();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                >
                  <i
                    className={`text-sm ${sortKey === colKey && sortDir === 'desc' ? 'ri-sort-desc' : 'ri-sort-asc'}`}
                    aria-hidden
                  />
                  {sortKey === colKey
                    ? sortDir === 'asc'
                      ? 'Sorted A–Z · click to reverse'
                      : 'Sorted Z–A · click to reverse'
                    : 'Sort A–Z'}
                </button>
              </div>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <th className={`relative whitespace-nowrap px-5 py-3 text-left ${className}`}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (open) close();
          else openMenu();
        }}
        className={`group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
          active || filtered || open ? 'text-[#1E88E5]' : 'text-[#7F8C8D] hover:text-slate-900'
        }`}
      >
        {label}
        <span className="flex items-center gap-0.5 opacity-70">
          {filtered ? <span className="h-1.5 w-1.5 rounded-full bg-[#1E88E5]" aria-hidden /> : null}
          <i
            className={`ri-arrow-down-s-line text-sm transition-transform ${
              open ? 'rotate-180 text-[#1E88E5]' : 'text-slate-300 group-hover:text-slate-400'
            }`}
            aria-hidden
          />
        </span>
      </button>
      {menu}
    </th>
  );
}

/** Renders FilterHeader when col.filter is set, otherwise SortHeader. */
export function TableColumnHeader({
  col,
  sortKey,
  sortDir,
  onSort,
  filterValue,
  filterOptions,
  onFilterChange,
  className,
}) {
  if (col.filter) {
    return (
      <FilterHeader
        label={col.label}
        colKey={col.key}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        filterValue={filterValue}
        filterOptions={filterOptions}
        onFilterChange={onFilterChange}
        className={className}
      />
    );
  }
  return (
    <SortHeader
      label={col.label}
      colKey={col.key}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={onSort}
      className={className}
    />
  );
}

/** Build sorted distinct { value, label } options from row field values. */
export function distinctFilterOptions(rows, getValue, { allLabel = 'All', mapLabel, emptyValue, emptyLabel } = {}) {
  const seen = new Map();
  for (const row of rows) {
    let raw = getValue(row);
    if (raw == null || String(raw).trim() === '' || String(raw).trim() === '—' || String(raw).trim() === '-') {
      if (emptyValue != null) {
        if (!seen.has(emptyValue)) seen.set(emptyValue, emptyLabel || 'Individual Task');
      }
      continue;
    }
    const value = String(raw);
    if (!seen.has(value)) seen.set(value, mapLabel ? mapLabel(value) : value);
  }
  const items = Array.from(seen.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => {
      if (emptyValue != null && a.value === emptyValue) return -1;
      if (emptyValue != null && b.value === emptyValue) return 1;
      return String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' });
    });
  return [{ value: 'all', label: allLabel }, ...items];
}

export function toggleSortState(prevKey, prevDir, nextKey) {
  if (prevKey === nextKey) {
    return { sortKey: prevKey, sortDir: prevDir === 'asc' ? 'desc' : 'asc' };
  }
  return { sortKey: nextKey, sortDir: 'asc' };
}

export function compareText(a, b, dir = 1) {
  return dir * String(a ?? '').localeCompare(String(b ?? ''), undefined, { sensitivity: 'base' });
}

export function compareNumber(a, b, dir = 1) {
  const na = Number(a);
  const nb = Number(b);
  const aBad = Number.isNaN(na);
  const bBad = Number.isNaN(nb);
  if (aBad && bBad) return 0;
  if (aBad) return 1;
  if (bBad) return -1;
  return dir * (na - nb);
}

export function compareDateValue(a, b, dir = 1, sortDir = 'asc') {
  const ta = a == null || a === '' || a === '—' ? null : Date.parse(String(a));
  const tb = b == null || b === '' || b === '—' ? null : Date.parse(String(b));
  const aBad = ta == null || Number.isNaN(ta);
  const bBad = tb == null || Number.isNaN(tb);
  if (aBad && bBad) return 0;
  if (aBad) return sortDir === 'asc' ? 1 : -1;
  if (bBad) return sortDir === 'asc' ? -1 : 1;
  return dir * (ta - tb);
}
