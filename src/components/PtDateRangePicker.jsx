import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { attachMenuWheelGuard, isScrollEventInsideEl, PORTAL_MENU_Z_INDEX } from '../lib/portalMenuGuards.js';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const PANEL_W = 268;
/** Tall enough for header + from/to + 6 week rows + footer (no inner scroll). */
const PANEL_EST_H = 340;

const DEFAULT_TRIGGER =
  'relative inline-flex h-8 min-h-[2rem] w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200/90 bg-white px-2.5 pr-7 text-left text-xs font-medium text-slate-700 shadow-none outline-none transition hover:border-slate-300 hover:bg-slate-50 cursor-pointer';

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDateToIso(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatIsoDateToDisplay(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function parseIsoToDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Compact Project Tracker date-range filter — portals above overflow trays.
 */
export default function PtDateRangePicker({
  from = '',
  to = '',
  onFromChange,
  onToChange,
  className = '',
  triggerClassName = '',
  placeholder = 'Dates',
  'aria-label': ariaLabel = 'Filter by date range',
}) {
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const pointerInsidePanelRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const [activeField, setActiveField] = useState('from');
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));

  const monthLabel = useMemo(
    () => calendarMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    [calendarMonth],
  );

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const lead = monthStart.getDay();
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    }
    return cells;
  }, [calendarMonth]);

  const selectedIso = activeField === 'to' ? to : from;
  const hasValue = Boolean(from || to);

  const close = useCallback(() => {
    pointerInsidePanelRef.current = false;
    setOpen(false);
    setMenuStyle(null);
  }, []);

  const computeMenuStyle = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - PANEL_W - 8));
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const preferUp = spaceBelow < PANEL_EST_H && spaceAbove > spaceBelow;
    const available = preferUp ? spaceAbove : spaceBelow;

    return {
      position: 'fixed',
      left,
      width: PANEL_W,
      top: preferUp ? undefined : rect.bottom + 4,
      bottom: preferUp ? window.innerHeight - rect.top + 4 : undefined,
      // Only clamp when the viewport is shorter than a full month panel.
      ...(available < PANEL_EST_H ? { maxHeight: Math.max(260, available) } : {}),
      zIndex: PORTAL_MENU_Z_INDEX,
    };
  }, []);

  const openPicker = useCallback(
    (field = 'from') => {
      const seed =
        parseIsoToDate(field === 'to' ? to : from) || parseIsoToDate(from) || new Date();
      setCalendarMonth(startOfMonth(seed));
      setActiveField(field);
      const style = computeMenuStyle();
      if (!style) return;
      setMenuStyle(style);
      setOpen(true);
    },
    [from, to, computeMenuStyle],
  );

  const toggle = useCallback(() => {
    if (open) close();
    else openPicker(from && !to ? 'to' : 'from');
  }, [open, close, openPicker, from, to]);

  useEffect(() => {
    if (!open) return undefined;

    const onDoc = (e) => {
      const t = e.target;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        btnRef.current?.focus();
      }
    };
    const onReposition = (e) => {
      if (e?.type === 'scroll' && isScrollEventInsideEl(e, panelRef.current, pointerInsidePanelRef)) {
        return;
      }
      const style = computeMenuStyle();
      if (style) setMenuStyle(style);
    };

    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, close, computeMenuStyle]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    return attachMenuWheelGuard(panelRef.current);
  }, [open, menuStyle]);

  const selectDay = useCallback(
    (dateObj) => {
      const iso = formatDateToIso(dateObj);
      if (activeField === 'to') {
        onToChange?.(iso);
        if (from && iso < from) onFromChange?.(iso);
      } else {
        onFromChange?.(iso);
        if (to && iso > to) onToChange?.(iso);
        setActiveField('to');
        setCalendarMonth(startOfMonth(dateObj));
      }
    },
    [activeField, from, to, onFromChange, onToChange],
  );

  const triggerLabel = hasValue
    ? `${formatIsoDateToDisplay(from) || '…'} – ${formatIsoDateToDisplay(to) || '…'}`
    : placeholder;

  return (
    <div ref={rootRef} className={`relative inline-flex min-w-0 w-full max-w-full ${className}`}>
      <i
        className="ri-calendar-line pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-sm text-[#1E88E5]"
        aria-hidden
      />
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        className={`${DEFAULT_TRIGGER} pl-8 ${
          open ? 'border-[#1E88E5] ring-2 ring-[#1E88E5]/20' : ''
        } ${triggerClassName}`}
      >
        <span className={`block truncate ${hasValue ? 'text-[#1E62F0]' : 'text-slate-700'}`}>
          {triggerLabel}
        </span>
        <i
          className={`ri-arrow-down-s-line pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-base text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {open && menuStyle && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Date range"
              style={menuStyle}
              className="overflow-hidden overscroll-contain rounded-xl border border-slate-200/90 bg-white shadow-xl shadow-slate-300/30"
              onPointerEnter={() => {
                pointerInsidePanelRef.current = true;
              }}
              onPointerLeave={() => {
                pointerInsidePanelRef.current = false;
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-2.5 py-1.5">
                <p className="truncate text-[11px] font-semibold text-slate-600">
                  {(formatIsoDateToDisplay(from) || 'Start') +
                    ' → ' +
                    (formatIsoDateToDisplay(to) || 'End')}
                </p>
                <button
                  type="button"
                  aria-label="Close date picker"
                  onClick={close}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <i className="ri-close-line text-base leading-none" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1 px-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => openPicker('from')}
                  className={`rounded-lg px-2 py-1.5 text-left transition ${
                    activeField === 'from'
                      ? 'bg-[#E8F0FE] text-[#1E62F0] ring-1 ring-[#1E88E5]/40'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="block text-[9px] font-semibold uppercase tracking-wide opacity-70">
                    From
                  </span>
                  <span className="text-[11px] font-semibold">
                    {formatIsoDateToDisplay(from) || 'Select'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openPicker('to')}
                  className={`rounded-lg px-2 py-1.5 text-left transition ${
                    activeField === 'to'
                      ? 'bg-[#E8F0FE] text-[#1E62F0] ring-1 ring-[#1E88E5]/40'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="block text-[9px] font-semibold uppercase tracking-wide opacity-70">
                    To
                  </span>
                  <span className="text-[11px] font-semibold">
                    {formatIsoDateToDisplay(to) || 'Select'}
                  </span>
                </button>
              </div>

              <div className="px-2.5 py-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() =>
                      setCalendarMonth((prev) =>
                        startOfMonth(new Date(prev.getFullYear(), prev.getMonth() - 1)),
                      )
                    }
                    className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                  >
                    <i className="ri-arrow-left-s-line text-lg leading-none" />
                  </button>
                  <span className="text-xs font-semibold text-slate-800">{monthLabel}</span>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() =>
                      setCalendarMonth((prev) =>
                        startOfMonth(new Date(prev.getFullYear(), prev.getMonth() + 1)),
                      )
                    }
                    className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                  >
                    <i className="ri-arrow-right-s-line text-lg leading-none" />
                  </button>
                </div>

                <div className="mb-0.5 grid grid-cols-7 gap-0.5 text-center text-[9px] font-semibold text-slate-400">
                  {WEEKDAYS.map((d) => (
                    <span key={d} className="py-0.5">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {calendarDays.map((dt, i) => {
                    if (!dt) return <span key={`e-${i}`} className="h-7" />;
                    const iso = formatDateToIso(dt);
                    const isSelected = selectedIso === iso;
                    const isStart = from && iso === from;
                    const isEnd = to && iso === to;
                    const inRange = from && to && iso > from && iso < to;
                    const isToday = formatDateToIso(new Date()) === iso;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => selectDay(dt)}
                        className={`h-7 rounded-md text-[11px] font-medium transition-colors ${
                          isSelected || isStart || isEnd
                            ? 'bg-[#1E88E5] text-white'
                            : inRange
                              ? 'bg-blue-50 text-[#1E62F0]'
                              : isToday
                                ? 'text-[#1E88E5] ring-1 ring-[#1E88E5]/30 hover:bg-slate-50'
                                : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {dt.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-1.5 border-t border-slate-100 px-2.5 py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onFromChange?.('');
                    onToChange?.('');
                    setActiveField('from');
                  }}
                  className="flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 rounded-lg bg-[#1E88E5] px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#1976D2]"
                >
                  Done
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
