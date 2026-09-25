/* eslint-disable react-refresh/only-export-components -- period picker + range helpers */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { attachMenuWheelGuard, isScrollEventInsideEl, PORTAL_MENU_Z_INDEX } from '../lib/portalMenuGuards.js';

/** Dashboard look, slightly tighter than the original panel. */
const PANEL_W = 320;
const PANEL_EST_H = 360;

function padDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getMonday(date = new Date()) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatMonthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/** Indian FY start year for a reference date (Apr–Mar). */
export function getFyStartYear(referenceDate = new Date()) {
  const d = referenceDate instanceof Date ? referenceDate : new Date();
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

export function getFinancialYearRange(fyStartYear, { capToToday = true } = {}) {
  const from = new Date(fyStartYear, 3, 1);
  let to = new Date(fyStartYear + 1, 2, 31);
  if (capToToday) {
    const today = startOfDay(new Date());
    if (to > today) to = today;
  }
  return { from: padDateInput(from), to: padDateInput(to), fyStartYear };
}

export function getWeekRange(mondayDate, { capToToday = true } = {}) {
  const from = startOfDay(mondayDate);
  let to = new Date(from);
  to.setDate(to.getDate() + 6);
  if (capToToday) {
    const today = startOfDay(new Date());
    if (to > today) to = today;
  }
  return { from: padDateInput(from), to: padDateInput(to), monday: from };
}

export function getMonthRange(year, monthIndex, { capToToday = true } = {}) {
  const from = new Date(year, monthIndex, 1);
  let to = new Date(year, monthIndex + 1, 0);
  if (capToToday) {
    const today = startOfDay(new Date());
    if (to > today) to = today;
  }
  return { from: padDateInput(from), to: padDateInput(to), year, monthIndex };
}

/** FY segment ranges (India: Apr → Mar). */
export function getFyPartRange(fyStartYear, part, { capToToday = true } = {}) {
  const endYear = fyStartYear + 1;
  const map = {
    FULL: { from: new Date(fyStartYear, 3, 1), to: new Date(endYear, 2, 31) },
    H1: { from: new Date(fyStartYear, 3, 1), to: new Date(fyStartYear, 8, 30) },
    H2: { from: new Date(fyStartYear, 9, 1), to: new Date(endYear, 2, 31) },
    Q1: { from: new Date(fyStartYear, 3, 1), to: new Date(fyStartYear, 5, 30) },
    Q2: { from: new Date(fyStartYear, 6, 1), to: new Date(fyStartYear, 8, 30) },
    Q3: { from: new Date(fyStartYear, 9, 1), to: new Date(fyStartYear, 11, 31) },
    Q4: { from: new Date(endYear, 0, 1), to: new Date(endYear, 2, 31) },
  };
  const seg = map[part] || map.FULL;
  let to = seg.to;
  if (capToToday) {
    const today = startOfDay(new Date());
    if (to > today) to = today;
  }
  if (to < seg.from) return null;
  return { from: padDateInput(seg.from), to: padDateInput(to) };
}

export function resolveFyPartsToRanges(fyStartYear, parts = [], { capToToday = true } = {}) {
  const selected = Array.isArray(parts) ? parts.filter(Boolean) : [];
  if (!selected.length || selected.includes('FULL')) {
    const full = getFyPartRange(fyStartYear, 'FULL', { capToToday });
    return full ? [full] : [];
  }
  const ranges = [];
  for (const part of selected) {
    const r = getFyPartRange(fyStartYear, part, { capToToday });
    if (r) ranges.push(r);
  }
  return ranges;
}

export function mergeRangesBounding(ranges) {
  const list = (Array.isArray(ranges) ? ranges : []).filter((r) => r?.from && r?.to);
  if (!list.length) return { from: '', to: '' };
  let from = list[0].from;
  let to = list[0].to;
  for (const r of list) {
    if (r.from < from) from = r.from;
    if (r.to > to) to = r.to;
  }
  return { from, to };
}

export function formatFyPartsLabel(fyStartYear, parts = []) {
  const fyLabel = `FY ${fyStartYear}–${String(fyStartYear + 1).slice(-2)}`;
  const selected = Array.isArray(parts) ? parts.filter((p) => p && p !== 'FULL') : [];
  if (!selected.length) return `${fyLabel} · Apr–Mar`;
  return `${fyLabel} · ${selected.join(', ')}`;
}

export function buildMonthWeekOptions(year, monthIndex) {
  const now = new Date();
  const currentMonday = getMonday(now);
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  let monday = getMonday(monthStart);

  const options = [];
  let weekNumber = 0;
  for (let i = 0; i < 6; i += 1) {
    const weekEnd = new Date(monday);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const overlapsMonth = weekEnd >= monthStart && monday <= monthEnd;
    if (monday > monthEnd) break;

    if (overlapsMonth) {
      if (monday.getTime() > currentMonday.getTime()) break;
      weekNumber += 1;
      const isCurrent = monday.getTime() === currentMonday.getTime();
      const range = getWeekRange(monday, { capToToday: isCurrent });
      const weekEndLabel = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      options.push({
        key: `week:${range.from}`,
        label: isCurrent ? 'Current week' : `Week ${weekNumber}`,
        sub: `Mon ${formatShortDate(monday)} → ${formatShortDate(weekEndLabel)}`,
        hint: isCurrent ? 'Mon → Today' : undefined,
        range: { from: range.from, to: range.to },
      });
    }

    monday = new Date(monday);
    monday.setDate(monday.getDate() + 7);
  }

  return options.reverse();
}

export function buildWeekNavOptions({ year, monthIndex } = {}) {
  const now = new Date();
  const y = Number.isFinite(year) ? year : now.getFullYear();
  const m = Number.isFinite(monthIndex) ? monthIndex : now.getMonth();
  return buildMonthWeekOptions(y, m);
}

export function getCurrentWeekPeriodState() {
  const now = new Date();
  const options = buildWeekNavOptions({
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
  });
  const current = options.find((opt) => opt.label === 'Current week') || options[0];
  if (!current) {
    const monday = getMonday(now);
    const range = getWeekRange(monday, { capToToday: true });
    return {
      mode: 'weekly',
      range: { from: range.from, to: range.to },
      ranges: [{ from: range.from, to: range.to }],
      parts: [],
      fyStartYear: null,
      summaryLabel: `Current week · Mon ${formatShortDate(monday)} → Today`,
    };
  }
  return {
    mode: 'weekly',
    range: { ...current.range },
    ranges: [{ ...current.range }],
    parts: [],
    fyStartYear: null,
    summaryLabel: `${current.label} · ${current.sub}`,
  };
}

export function buildMonthOptions(year) {
  const now = new Date();
  const options = [];
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    if (year > now.getFullYear()) continue;
    if (year === now.getFullYear() && monthIndex > now.getMonth()) continue;
    const range = getMonthRange(year, monthIndex);
    const isCurrent = year === now.getFullYear() && monthIndex === now.getMonth();
    options.push({
      key: `month:${year}-${monthIndex}`,
      label: formatMonthLabel(year, monthIndex),
      sub: isCurrent
        ? `1 ${new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: 'short' })} → Today`
        : 'Full month',
      range: { from: range.from, to: range.to },
    });
  }
  return options;
}

export function buildFinancialYearOptions(count = 4) {
  const currentFy = getFyStartYear();
  const options = [];
  for (let i = 0; i < count; i += 1) {
    const fyStartYear = currentFy - i;
    const range = getFinancialYearRange(fyStartYear);
    options.push({
      key: `fy:${fyStartYear}`,
      label: `FY ${fyStartYear}–${String(fyStartYear + 1).slice(-2)}`,
      sub: `1 Apr ${fyStartYear} → 31 Mar ${fyStartYear + 1}`,
      hint: i === 0 ? 'Current financial year' : undefined,
      fyStartYear,
      range: { from: range.from, to: range.to },
    });
  }
  return options;
}

export function getEmptyPeriodState() {
  return {
    mode: 'all',
    range: { from: '', to: '' },
    ranges: [],
    parts: [],
    fyStartYear: null,
    summaryLabel: 'All time',
  };
}

export function getDefaultPeriodState() {
  return getEmptyPeriodState();
}

const MODE_OPTIONS = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'fy', label: 'Financial Year' },
];

const FY_HALF_CHIPS = [
  { key: 'H1', label: 'H1', sub: 'Apr–Sep' },
  { key: 'H2', label: 'H2', sub: 'Oct–Mar' },
];

const FY_QUARTER_CHIPS = [
  { key: 'Q1', label: 'Q1', sub: 'Apr–Jun' },
  { key: 'Q2', label: 'Q2', sub: 'Jul–Sep' },
  { key: 'Q3', label: 'Q3', sub: 'Oct–Dec' },
  { key: 'Q4', label: 'Q4', sub: 'Jan–Mar' },
];

function segmentShell() {
  return 'grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1';
}

function segmentBtn(active) {
  const base =
    'inline-flex min-h-[1.875rem] items-center justify-center rounded-lg px-1.5 py-1 text-[11px] font-semibold transition sm:text-xs';
  if (active) {
    return `${base} bg-[#1E88E5] text-white shadow-sm shadow-[#1E88E5]/25`;
  }
  return `${base} text-slate-600 hover:bg-white hover:text-[#1E62F0]`;
}

/** Default trigger — matches USPT filter-tray PtSelect scale. */
const TRIGGER_CLASS =
  'relative inline-flex h-auto min-h-[2.5rem] w-full min-w-[9.5rem] items-center rounded-lg border border-slate-200/90 bg-slate-50/90 py-1.5 pl-8 pr-7 text-left text-xs font-medium text-slate-700 shadow-none outline-none transition hover:border-slate-300 hover:bg-white focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20 sm:min-h-[2rem]';

/**
 * Adaptive period control — Weekly / Monthly / FY (Apr–Mar).
 * Same visual language as ProjectDashboard filters; FY supports H1·H2·Q1–Q4 multi-select.
 */
export default function DashboardPeriodPicker({
  mode = 'all',
  range = { from: '', to: '' },
  ranges = null,
  parts = null,
  fyStartYear: fyStartYearProp = null,
  summaryLabel = 'All time',
  onChange,
  className = '',
  allowAllTime = true,
  triggerClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const [panelMode, setPanelMode] = useState(() =>
    mode === 'all' || !mode || mode === 'custom' ? 'fy' : mode,
  );
  const [monthYear, setMonthYear] = useState(() => new Date().getFullYear());
  const [weekMonthCursor, setWeekMonthCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  });
  const [fyYear, setFyYear] = useState(() =>
    Number.isFinite(Number(fyStartYearProp)) ? Number(fyStartYearProp) : getFyStartYear(),
  );
  const [fyParts, setFyParts] = useState(() =>
    Array.isArray(parts) ? parts.filter((p) => p && p !== 'FULL') : [],
  );
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const pointerInsidePanelRef = useRef(false);

  const computeMenuStyle = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(PANEL_W, Math.max(280, window.innerWidth - 16));
    const left = Math.min(
      Math.max(8, rect.right - width),
      Math.max(8, window.innerWidth - width - 8),
    );
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const preferUp = spaceBelow < PANEL_EST_H && spaceAbove > spaceBelow;
    const available = preferUp ? spaceAbove : spaceBelow;

    return {
      position: 'fixed',
      left,
      width,
      top: preferUp ? undefined : rect.bottom + 6,
      bottom: preferUp ? window.innerHeight - rect.top + 6 : undefined,
      maxHeight: Math.min(PANEL_EST_H, Math.max(240, available)),
      zIndex: PORTAL_MENU_Z_INDEX,
    };
  }, []);

  const close = useCallback(() => {
    pointerInsidePanelRef.current = false;
    setOpen(false);
    setMenuStyle(null);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const nextPanel = mode === 'all' || !mode || mode === 'custom' ? 'fy' : mode;
    setPanelMode(nextPanel);
    if (mode === 'weekly' && range?.from) {
      const anchor = new Date(`${range.from}T12:00:00`);
      if (!Number.isNaN(anchor.getTime())) {
        setWeekMonthCursor({ year: anchor.getFullYear(), monthIndex: anchor.getMonth() });
      }
    }
    if (Number.isFinite(Number(fyStartYearProp))) setFyYear(Number(fyStartYearProp));
    if (Array.isArray(parts)) setFyParts(parts.filter((p) => p && p !== 'FULL'));

    const onDoc = (event) => {
      const t = event.target;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        btnRef.current?.focus();
      }
    };
    const onReposition = (event) => {
      if (
        event?.type === 'scroll' &&
        isScrollEventInsideEl(event, panelRef.current, pointerInsidePanelRef)
      ) {
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
  }, [open, mode, range?.from, range?.to, parts, fyStartYearProp, close, computeMenuStyle]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    // Attach to the outer panel; wheel guard finds the overflow-y-auto body in the event path.
    return attachMenuWheelGuard(panelRef.current);
  }, [open, menuStyle, panelMode]);

  const weekOptions = useMemo(
    () =>
      buildWeekNavOptions({
        year: weekMonthCursor.year,
        monthIndex: weekMonthCursor.monthIndex,
      }),
    [open, weekMonthCursor.year, weekMonthCursor.monthIndex],
  );
  const monthOptions = useMemo(() => buildMonthOptions(monthYear), [monthYear, open]);
  const fyOptions = useMemo(() => buildFinancialYearOptions(4), [open]);

  const triggerLabel = summaryLabel || 'All time';
  const activeRanges =
    Array.isArray(ranges) && ranges.length
      ? ranges
      : range?.from && range?.to
        ? [range]
        : [];

  const emit = useCallback(
    (payload) => {
      const nextRanges = Array.isArray(payload.ranges)
        ? payload.ranges
        : payload.range?.from && payload.range?.to
          ? [payload.range]
          : [];
      const bounding = mergeRangesBounding(nextRanges);
      onChange?.({
        mode: payload.mode,
        range: bounding,
        ranges: nextRanges,
        parts: Array.isArray(payload.parts) ? payload.parts : [],
        fyStartYear: payload.fyStartYear ?? null,
        summaryLabel: payload.summaryLabel || 'All time',
      });
    },
    [onChange],
  );

  const applySelection = (nextMode, nextRange, label, extra = {}) => {
    emit({
      mode: nextMode,
      range: nextRange,
      ranges: nextRange?.from ? [nextRange] : [],
      summaryLabel: label,
      ...extra,
    });
    close();
  };

  const applyFySelection = (nextFyYear, nextParts, { closePanel = false } = {}) => {
    const year = Number(nextFyYear) || getFyStartYear();
    const cleanParts = (Array.isArray(nextParts) ? nextParts : []).filter(
      (p) => p && p !== 'FULL',
    );
    const nextRanges = resolveFyPartsToRanges(year, cleanParts);
    emit({
      mode: 'fy',
      ranges: nextRanges,
      parts: cleanParts,
      fyStartYear: year,
      summaryLabel: formatFyPartsLabel(year, cleanParts),
    });
    if (closePanel) close();
  };

  const toggleFyPart = (partKey) => {
    setFyParts((prev) => {
      const set = new Set(prev);
      if (set.has(partKey)) set.delete(partKey);
      else set.add(partKey);
      const next = Array.from(set);
      applyFySelection(fyYear, next);
      return next;
    });
  };

  const shiftWeekMonth = (delta) => {
    setWeekMonthCursor((prev) => {
      const d = new Date(prev.year, prev.monthIndex + delta, 1);
      const now = new Date();
      if (
        d.getFullYear() > now.getFullYear() ||
        (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth())
      ) {
        return { year: now.getFullYear(), monthIndex: now.getMonth() };
      }
      return { year: d.getFullYear(), monthIndex: d.getMonth() };
    });
  };

  const canShiftWeekMonthForward = (() => {
    const now = new Date();
    return (
      weekMonthCursor.year < now.getFullYear() ||
      (weekMonthCursor.year === now.getFullYear() && weekMonthCursor.monthIndex < now.getMonth())
    );
  })();

  return (
    <div ref={rootRef} className={`relative inline-flex min-w-0 ${className}`}>
      <i
        className="ri-calendar-2-line pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-sm text-[#1E88E5]"
        aria-hidden
      />
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Period filter"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) {
            close();
            return;
          }
          const style = computeMenuStyle();
          if (!style) return;
          setMenuStyle(style);
          setOpen(true);
        }}
        className={`${TRIGGER_CLASS} ${
          open ? 'border-[#1E88E5] ring-2 ring-[#1E88E5]/20' : ''
        } ${triggerClassName}`}
      >
        <span className="block truncate text-slate-700">{triggerLabel}</span>
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
              aria-label="Period filter"
              style={menuStyle}
              className="flex flex-col overflow-hidden overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-xl"
              onPointerEnter={() => {
                pointerInsidePanelRef.current = true;
              }}
              onPointerLeave={() => {
                pointerInsidePanelRef.current = false;
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {allowAllTime ? (
                <div className="shrink-0 border-b border-slate-100 px-2.5 pt-2.5">
                  <PeriodOptionRow
                    active={mode === 'all'}
                    label="All time"
                    sub="No date restriction"
                    onClick={() => applySelection('all', { from: '', to: '' }, 'All time')}
                  />
                </div>
              ) : null}

              <div className="shrink-0 border-b border-slate-100 px-2.5 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Choose period type
                </p>
                <div className={`mt-1.5 ${segmentShell()}`}>
                  {MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setPanelMode(opt.key);
                        if (opt.key === 'weekly') {
                          const now = new Date();
                          setWeekMonthCursor({
                            year: now.getFullYear(),
                            monthIndex: now.getMonth(),
                          });
                        }
                        if (opt.key === 'fy' && !Number.isFinite(Number(fyYear))) {
                          setFyYear(getFyStartYear());
                        }
                      }}
                      className={segmentBtn(panelMode === opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5">
                {panelMode === 'weekly' ? (
                  <div className="space-y-1.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium text-slate-500">Weeks · Mon → Sun</p>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          onClick={() => shiftWeekMonth(-1)}
                        >
                          ←
                        </button>
                        <span className="min-w-[6.5rem] text-center text-xs font-bold text-slate-800">
                          {formatMonthLabel(weekMonthCursor.year, weekMonthCursor.monthIndex)}
                        </span>
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                          disabled={!canShiftWeekMonthForward}
                          onClick={() => shiftWeekMonth(1)}
                        >
                          →
                        </button>
                      </div>
                    </div>
                    {weekOptions.map((opt) => {
                      const active =
                        mode === 'weekly' &&
                        range.from === opt.range.from &&
                        range.to === opt.range.to;
                      return (
                        <PeriodOptionRow
                          key={opt.key}
                          active={active}
                          label={opt.label}
                          sub={opt.sub}
                          hint={opt.hint}
                          onClick={() =>
                            applySelection('weekly', opt.range, `${opt.label} · ${opt.sub}`)
                          }
                        />
                      );
                    })}
                    {!weekOptions.length ? (
                      <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                        No weeks in this month yet.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {panelMode === 'monthly' ? (
                  <div className="space-y-2">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium text-slate-500">Calendar months</p>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          onClick={() => setMonthYear((y) => y - 1)}
                        >
                          ←
                        </button>
                        <span className="min-w-[3.5rem] text-center text-xs font-bold text-slate-800">
                          {monthYear}
                        </span>
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                          disabled={monthYear >= new Date().getFullYear()}
                          onClick={() =>
                            setMonthYear((y) => Math.min(new Date().getFullYear(), y + 1))
                          }
                        >
                          →
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {monthOptions.map((opt) => {
                        const active = mode === 'monthly' && range.from === opt.range.from;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => applySelection('monthly', opt.range, opt.label)}
                            className={`rounded-xl border px-2.5 py-2 text-left transition ${
                              active
                                ? 'border-[#1E88E5] bg-[#1E88E5]/10'
                                : 'border-slate-200 hover:border-[#1E88E5]/40 hover:bg-slate-50'
                            }`}
                          >
                            <span className="block text-xs font-semibold text-slate-800">
                              {opt.label.split(' ')[0]}
                            </span>
                            <span className="block text-[10px] font-medium text-slate-500">
                              {opt.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {panelMode === 'fy' ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-slate-500">
                      Indian FY · 1 Apr → 31 Mar
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {fyOptions.map((opt) => {
                        const active = fyYear === opt.fyStartYear;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              setFyYear(opt.fyStartYear);
                              applyFySelection(opt.fyStartYear, fyParts);
                            }}
                            className={`rounded-xl border px-2.5 py-1.5 text-left transition ${
                              active
                                ? 'border-[#1E88E5] bg-[#1E88E5]/10'
                                : 'border-slate-200 bg-white hover:border-[#1E88E5]/40 hover:bg-slate-50'
                            }`}
                          >
                            <span className="block text-xs font-semibold text-slate-800">
                              {opt.label}
                            </span>
                            {opt.hint ? (
                              <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                                Current
                              </span>
                            ) : (
                              <span className="mt-0.5 block text-[9px] font-medium text-slate-400">
                                {opt.fyStartYear}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2">
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Halves · multi-select
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {FY_HALF_CHIPS.map((chip) => {
                          const active = fyParts.includes(chip.key);
                          return (
                            <button
                              key={chip.key}
                              type="button"
                              onClick={() => toggleFyPart(chip.key)}
                              className={`rounded-xl border px-2 py-1.5 text-left transition ${
                                active
                                  ? 'border-[#1E88E5] bg-[#1E88E5]/10'
                                  : 'border-slate-200 bg-white hover:border-[#1E88E5]/40'
                              }`}
                            >
                              <span className="block text-xs font-bold text-slate-800">
                                {chip.label}
                              </span>
                              <span className="block text-[10px] font-medium text-slate-500">
                                {chip.sub}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <p className="mb-1.5 mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Quarters · multi-select
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {FY_QUARTER_CHIPS.map((chip) => {
                          const active = fyParts.includes(chip.key);
                          return (
                            <button
                              key={chip.key}
                              type="button"
                              onClick={() => toggleFyPart(chip.key)}
                              className={`rounded-xl border px-1.5 py-1.5 text-center transition ${
                                active
                                  ? 'border-[#1E88E5] bg-[#1E88E5]/10'
                                  : 'border-slate-200 bg-white hover:border-[#1E88E5]/40'
                              }`}
                            >
                              <span className="block text-xs font-bold text-slate-800">
                                {chip.label}
                              </span>
                              <span className="block text-[9px] font-medium text-slate-500">
                                {chip.sub}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFyParts([]);
                            applyFySelection(fyYear, []);
                          }}
                          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                            mode === 'fy' && fyParts.length === 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'text-slate-600 hover:bg-white'
                          }`}
                        >
                          Full FY
                        </button>
                        <button
                          type="button"
                          onClick={() => applyFySelection(fyYear, fyParts, { closePanel: true })}
                          className="rounded-lg bg-[#1E88E5] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-[#1E88E5]/25 hover:bg-[#1E62F0]"
                        >
                          Done
                        </button>
                      </div>
                      {mode === 'fy' && activeRanges.length > 1 ? (
                        <p className="mt-1.5 text-[10px] font-medium text-slate-400">
                          Matches any of {activeRanges.length} selected windows
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function PeriodOptionRow({ active, label, sub, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
        active
          ? 'border-[#1E88E5] bg-[#1E88E5]/10'
          : 'border-slate-200 hover:border-[#1E88E5]/40 hover:bg-slate-50'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-slate-800">{label}</span>
        {sub ? (
          <span className="mt-0.5 block text-[11px] font-medium text-slate-500">{sub}</span>
        ) : null}
        {hint ? (
          <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            {hint}
          </span>
        ) : null}
      </span>
      {active ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1E88E5]" /> : null}
    </button>
  );
}
