/* eslint-disable max-lines -- Task-focused Kissflow dashboard (mirrors ProjectDashboardPage task sections) */
import { useState, useCallback, useContext, useEffect, useRef, useMemo, Fragment } from 'react';
import { motion } from 'framer-motion';
import AppLayout from './components/feature/AppLayout.jsx';
import { KissflowSDKContext, kf } from './sdk/index.js';
import {
  createSubtaskInstance,
  openSubtaskDraft,
  fetchAllSubtasks,
  filterSubtasksForTask,
} from './lib/kfProjectTrackerKarthika.js';
import {
  fetchTaskTrackerData,
  mapProcessSubtaskItem,
  resolveTaskBusinessIdFromRow,
  computeTaskKpiMetrics,
  isTaskCompleted,
  isTaskOverdue,
  parseKfDate,
} from './lib/kfTaskTracker.js';
import { personMatches } from './lib/kfProjectDashboard.js';
import SatelliteOrbitMenu from './components/SatelliteOrbitMenu.jsx';
import PtSelect from './components/PtSelect.jsx';
import DashboardDetailModal from './components/DashboardDetailModal.jsx';
import SubtaskAccordionRow from './components/SubtaskAccordionRow.jsx';
import {
  TableColumnHeader,
  distinctFilterOptions,
  toggleSortState,
  compareText,
  compareNumber,
  compareDateValue,
} from './components/TableColumnHeaders.jsx';
import { TASKS_DASHBOARD_SATELLITE_OPTIONS } from './lib/kfSatelliteCreate.js';

const PAGE_SIZE = 10;
const IT_BUSINESS_FUNCTION = 'Information Technology';

const dashboardRowCreateLock = new Set();

function getGreetingText() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function resolveRoleName(roleLike) {
  if (!roleLike) return '';
  if (typeof roleLike === 'string') return roleLike.trim();
  if (typeof roleLike === 'object') return String(roleLike.Name || roleLike.name || '').trim();
  return '';
}

function normalizeDimensionField(value, fallback = 'N/A') {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') {
    const name = String(value.Name || value.name || value.label || '').trim();
    return name || fallback;
  }
  const text = String(value).trim();
  return text || fallback;
}

function normalizeDimensionValue(value) {
  const text = normalizeDimensionField(value, '');
  if (!text || text === 'N/A' || text === '—') return '';
  return text;
}

function collectUniqueFieldValues(rows, field) {
  const values = new Set();
  for (const row of rows) {
    const normalized = normalizeDimensionValue(row?.[field]);
    if (normalized) values.add(normalized);
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

function isInformationTechnologyCategory(value) {
  return normalizeDimensionValue(value) === normalizeDimensionValue(IT_BUSINESS_FUNCTION);
}

/** India business FY: 1 Apr → 31 Mar. Key e.g. "2025-26". */
function getIndiaFyKey(dateLike) {
  const d = parseKfDate(dateLike);
  if (!d) return null;
  const year = d.getFullYear();
  const month = d.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endShort}`;
}

function parseIndiaFyKey(fyKey) {
  const m = String(fyKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const startYear = Number(m[1]);
  return Number.isFinite(startYear) ? startYear : null;
}

function getCalendarYear(dateLike) {
  const d = parseKfDate(dateLike);
  return d ? d.getFullYear() : null;
}

function buildCreatedYearOptions(rows) {
  const fyKeys = new Set();
  const cyKeys = new Set();
  const now = new Date();
  fyKeys.add(getIndiaFyKey(now));
  cyKeys.add(String(now.getFullYear()));

  for (const row of rows) {
    const created = row?.createdAt || row?.raw?._created_at;
    const fy = getIndiaFyKey(created);
    const cy = getCalendarYear(created);
    if (fy) fyKeys.add(fy);
    if (cy) cyKeys.add(String(cy));
  }

  const fyOptions = Array.from(fyKeys)
    .filter(Boolean)
    .sort((a, b) => (parseIndiaFyKey(b) || 0) - (parseIndiaFyKey(a) || 0))
    .map((key) => ({ value: `fy:${key}`, label: `FY ${key}` }));

  const cyOptions = Array.from(cyKeys)
    .filter(Boolean)
    .sort((a, b) => Number(b) - Number(a))
    .map((year) => ({ value: `cy:${year}`, label: `Calendar ${year}` }));

  return [...fyOptions, ...cyOptions];
}

function getCreatedPeriodOptions(createdYear) {
  if (!createdYear) return [];
  const isFy = String(createdYear).startsWith('fy:');

  const halves = isFy
    ? [
        { value: 'H1', label: 'H1 (Apr–Sep)' },
        { value: 'H2', label: 'H2 (Oct–Mar)' },
      ]
    : [
        { value: 'H1', label: 'H1 (Jan–Jun)' },
        { value: 'H2', label: 'H2 (Jul–Dec)' },
      ];

  const quarters = isFy
    ? [
        { value: 'Q1', label: 'Q1 (Apr–Jun)' },
        { value: 'Q2', label: 'Q2 (Jul–Sep)' },
        { value: 'Q3', label: 'Q3 (Oct–Dec)' },
        { value: 'Q4', label: 'Q4 (Jan–Mar)' },
      ]
    : [
        { value: 'Q1', label: 'Q1 (Jan–Mar)' },
        { value: 'Q2', label: 'Q2 (Apr–Jun)' },
        { value: 'Q3', label: 'Q3 (Jul–Sep)' },
        { value: 'Q4', label: 'Q4 (Oct–Dec)' },
      ];

  const months = isFy
    ? [
        { value: 'M04', label: 'April' },
        { value: 'M05', label: 'May' },
        { value: 'M06', label: 'June' },
        { value: 'M07', label: 'July' },
        { value: 'M08', label: 'August' },
        { value: 'M09', label: 'September' },
        { value: 'M10', label: 'October' },
        { value: 'M11', label: 'November' },
        { value: 'M12', label: 'December' },
        { value: 'M01', label: 'January' },
        { value: 'M02', label: 'February' },
        { value: 'M03', label: 'March' },
      ]
    : [
        { value: 'M01', label: 'January' },
        { value: 'M02', label: 'February' },
        { value: 'M03', label: 'March' },
        { value: 'M04', label: 'April' },
        { value: 'M05', label: 'May' },
        { value: 'M06', label: 'June' },
        { value: 'M07', label: 'July' },
        { value: 'M08', label: 'August' },
        { value: 'M09', label: 'September' },
        { value: 'M10', label: 'October' },
        { value: 'M11', label: 'November' },
        { value: 'M12', label: 'December' },
      ];

  return [
    { value: '', label: 'Full year' },
    ...halves,
    ...quarters,
    ...months,
  ];
}

function resolveCreatedDateRange(createdYear, createdPeriod) {
  if (!createdYear) return null;
  const raw = String(createdYear);
  const period = String(createdPeriod || '').trim();

  if (raw.startsWith('fy:')) {
    const startYear = parseIndiaFyKey(raw.slice(3));
    if (startYear == null) return null;
    const endYear = startYear + 1;

    if (!period || period === 'FULL') {
      return { from: new Date(startYear, 3, 1), to: new Date(endYear, 2, 31, 23, 59, 59, 999) };
    }
    if (period === 'H1') return { from: new Date(startYear, 3, 1), to: new Date(startYear, 8, 30, 23, 59, 59, 999) };
    if (period === 'H2') return { from: new Date(startYear, 9, 1), to: new Date(endYear, 2, 31, 23, 59, 59, 999) };
    if (period === 'Q1') return { from: new Date(startYear, 3, 1), to: new Date(startYear, 5, 30, 23, 59, 59, 999) };
    if (period === 'Q2') return { from: new Date(startYear, 6, 1), to: new Date(startYear, 8, 30, 23, 59, 59, 999) };
    if (period === 'Q3') return { from: new Date(startYear, 9, 1), to: new Date(startYear, 11, 31, 23, 59, 59, 999) };
    if (period === 'Q4') return { from: new Date(endYear, 0, 1), to: new Date(endYear, 2, 31, 23, 59, 59, 999) };

    const monthMatch = period.match(/^M(\d{2})$/);
    if (monthMatch) {
      const monthNum = Number(monthMatch[1]);
      const year = monthNum >= 4 ? startYear : endYear;
      const monthIndex = monthNum - 1;
      return {
        from: new Date(year, monthIndex, 1),
        to: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
      };
    }
    return { from: new Date(startYear, 3, 1), to: new Date(endYear, 2, 31, 23, 59, 59, 999) };
  }

  if (raw.startsWith('cy:')) {
    const year = Number(raw.slice(3));
    if (!Number.isFinite(year)) return null;

    if (!period || period === 'FULL') {
      return { from: new Date(year, 0, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) };
    }
    if (period === 'H1') return { from: new Date(year, 0, 1), to: new Date(year, 5, 30, 23, 59, 59, 999) };
    if (period === 'H2') return { from: new Date(year, 6, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) };
    if (period === 'Q1') return { from: new Date(year, 0, 1), to: new Date(year, 2, 31, 23, 59, 59, 999) };
    if (period === 'Q2') return { from: new Date(year, 3, 1), to: new Date(year, 5, 30, 23, 59, 59, 999) };
    if (period === 'Q3') return { from: new Date(year, 6, 1), to: new Date(year, 8, 30, 23, 59, 59, 999) };
    if (period === 'Q4') return { from: new Date(year, 9, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) };

    const monthMatch = period.match(/^M(\d{2})$/);
    if (monthMatch) {
      const monthIndex = Number(monthMatch[1]) - 1;
      return {
        from: new Date(year, monthIndex, 1),
        to: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
      };
    }
    return { from: new Date(year, 0, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) };
  }

  return null;
}

function taskMatchesCreatedRange(row, range) {
  if (!range) return true;
  const created = parseKfDate(row?.createdAt || row?.raw?._created_at);
  if (!created) return false;
  const t = created.getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}

function hasActiveDimensionFilters(filters) {
  return Boolean(
    filters?.company ||
      filters?.lineOfBusiness ||
      filters?.functionType ||
      filters?.createdYear,
  );
}

function filterTasksByDimensions(rows, filters) {
  if (!hasActiveDimensionFilters(filters)) return rows;
  const createdRange = resolveCreatedDateRange(filters.createdYear, filters.createdPeriod);
  return rows.filter((row) => {
    if (filters.company && normalizeDimensionValue(row.companyName) !== filters.company) return false;
    if (filters.lineOfBusiness && normalizeDimensionValue(row.lineOfBusiness) !== filters.lineOfBusiness) return false;
    if (filters.functionType && normalizeDimensionValue(row.functionType) !== filters.functionType) return false;
    if (!taskMatchesCreatedRange(row, createdRange)) return false;
    return true;
  });
}

function filterProcessSubtasksByTasks(processSubtasks, tasks, filters) {
  if (!hasActiveDimensionFilters(filters)) return processSubtasks;
  if (!tasks.length) return [];
  const taskKeys = new Set(tasks.map((t) => resolveTaskBusinessIdFromRow(t)).filter(Boolean));
  return (processSubtasks || []).filter((sub) => {
    const parentId = String(sub?.parentTaskBusinessId || '').trim();
    return parentId && taskKeys.has(parentId);
  });
}

/** Keep only tasks assigned to the logged-in Kissflow user (same idea as UserSpecificPT My Work). */
function scopeTasksToCurrentUser(tasks, processSubtasks, user) {
  if (!user) {
    return { tasks: [], processSubtasks: [] };
  }
  const myTasks = (Array.isArray(tasks) ? tasks : []).filter((t) =>
    personMatches(user, {
      id: t.assignedToId || t?.raw?.Assigned_To?._id,
      email:
        t.assignedToEmail ||
        t?.raw?.externalemail ||
        t?.raw?.Assigned_To?.Email ||
        t?.raw?.Assigned_To?.email,
      name: t.assignedTo || t?.raw?.Assigned_To?.Name,
    }),
  );
  const taskKeys = new Set(myTasks.map((t) => resolveTaskBusinessIdFromRow(t)).filter(Boolean));
  const myProcessSubtasks = (Array.isArray(processSubtasks) ? processSubtasks : []).filter((sub) => {
    const parentId = String(sub?.parentTaskBusinessId || '').trim();
    return parentId && taskKeys.has(parentId);
  });
  return { tasks: myTasks, processSubtasks: myProcessSubtasks };
}

function DashboardDimensionFilters({ filters, options, onChange, onClear, hasActiveFilters }) {
  const showFunctionType = isInformationTechnologyCategory(filters.lineOfBusiness);
  const createdPeriodOptions = getCreatedPeriodOptions(filters.createdYear);
  const fields = [
    { key: 'company', label: 'Company', icon: 'ri-building-2-line', allLabel: 'All companies' },
    { key: 'lineOfBusiness', label: 'Business Functions', icon: 'ri-briefcase-line', allLabel: 'All Functions' },
    ...(showFunctionType
      ? [{ key: 'functionType', label: 'Function Type', icon: 'ri-stack-line', allLabel: 'All Function Types' }]
      : []),
  ];

  return (
    <div className="flex w-full flex-col gap-1.5 lg:w-auto lg:items-end">
      <div className="flex w-full snap-x snap-mandatory items-end gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-wrap lg:justify-end lg:overflow-visible [&::-webkit-scrollbar]:hidden">
        {fields.map(({ key, label, icon, allLabel }) => (
          <label key={key} className="flex min-w-[10.5rem] shrink-0 snap-start flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
            <PtSelect
              value={filters[key] || ''}
              onChange={(e) => onChange(key, e.target.value)}
              leadingIcon={icon}
              aria-label={`Filter by ${label}`}
              className="w-full sm:min-w-[11rem]"
              triggerClassName="text-xs sm:text-sm py-2 h-auto min-h-[2.25rem]"
              options={[
                { value: '', label: allLabel },
                ...(options[key] || []).map((opt) => ({ value: opt, label: opt })),
              ]}
            />
          </label>
        ))}

        <label className="flex min-w-[11rem] shrink-0 snap-start flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Filter</span>
          <PtSelect
            value={filters.createdYear || ''}
            onChange={(e) => onChange('createdYear', e.target.value)}
            leadingIcon="ri-calendar-2-line"
            aria-label="Filter by year"
            className="w-full sm:min-w-[12rem]"
            triggerClassName="text-xs sm:text-sm py-2 h-auto min-h-[2.25rem]"
            options={[
              { value: '', label: 'All years' },
              ...(options.createdYear || []),
            ]}
          />
        </label>

        {filters.createdYear ? (
          <label className="flex min-w-[11rem] shrink-0 snap-start flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Period</span>
            <PtSelect
              value={filters.createdPeriod || ''}
              onChange={(e) => onChange('createdPeriod', e.target.value)}
              leadingIcon="ri-calendar-event-line"
              aria-label="Filter by created period"
              className="w-full sm:min-w-[12rem]"
              triggerClassName="text-xs sm:text-sm py-2 h-auto min-h-[2.25rem]"
              options={createdPeriodOptions}
            />
          </label>
        ) : null}

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClear}
            className="mb-0.5 shrink-0 self-end rounded-lg px-2.5 py-2 text-xs font-semibold text-[#1E88E5] transition hover:bg-blue-50"
          >
            Clear filters
          </button>
        ) : null}
      </div>
      {hasActiveFilters ? (
        <p className="text-center text-[10px] font-medium text-slate-500 lg:text-right">
          Portfolio filters applied across all sections · dates use task created date
        </p>
      ) : null}
    </div>
  );
}

const KPI_THEME = {
  subtasks: {
    valueClass: 'text-[#8B5CF6]',
    iconBg: 'bg-[#8B5CF6]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(139,92,246,0.12)]',
    cardBg: 'from-violet-50/92 via-white to-purple-50/72',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(139,92,246,0.2)]',
    hoverRing: 'group-hover:ring-[#8B5CF6]/25',
    hoverBorder: 'group-hover:border-[#8B5CF6]/38',
    glow: 'rgba(139,92,246,0.16)',
    iconRing: 'ring-1 ring-violet-500/20 group-hover:ring-white/50',
  },
  open: {
    valueClass: 'text-[#F97316]',
    iconBg: 'bg-[#F97316]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(249,115,22,0.1)]',
    cardBg: 'from-amber-50/92 via-white to-orange-50/72',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(249,115,22,0.2)]',
    hoverRing: 'group-hover:ring-[#F97316]/25',
    hoverBorder: 'group-hover:border-[#F97316]/38',
    glow: 'rgba(249,115,22,0.14)',
    iconRing: 'ring-1 ring-orange-500/25 group-hover:ring-white/50',
  },
  tasksDone: {
    valueClass: 'text-[#0F766E]',
    iconBg: 'bg-[#0F766E]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(15,118,110,0.1)]',
    cardBg: 'from-teal-50/92 via-white to-emerald-50/72',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(15,118,110,0.18)]',
    hoverRing: 'group-hover:ring-[#0F766E]/25',
    hoverBorder: 'group-hover:border-[#0F766E]/38',
    glow: 'rgba(15,118,110,0.14)',
    iconRing: 'ring-1 ring-teal-600/22 group-hover:ring-white/50',
  },
  overdue: {
    valueClass: 'text-[#D946EF]',
    iconBg: 'bg-[#D946EF]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(217,70,239,0.1)]',
    cardBg: 'from-fuchsia-50/92 via-white to-pink-50/72',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(217,70,239,0.2)]',
    hoverRing: 'group-hover:ring-[#D946EF]/25',
    hoverBorder: 'group-hover:border-[#D946EF]/38',
    glow: 'rgba(217,70,239,0.15)',
    iconRing: 'ring-1 ring-fuchsia-500/22 group-hover:ring-white/50',
  },
};

function PremiumKPICard({ title, value, subtitle, trend, icon, theme, index, onClick, active = false }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28, delay: Math.min(index * 0.035, 0.25) }}
      whileHover={{ y: -6, scale: 1.02, transition: { type: 'spring', stiffness: 420, damping: 22 } }}
      whileTap={{ scale: 0.985 }}
      className={`group relative w-full overflow-hidden rounded-xl border bg-gradient-to-br p-3.5 text-left sm:rounded-2xl sm:p-5 ${theme.cardBg} ${theme.cardShadow} transition-[box-shadow,border-color,ring] duration-300 hover:shadow-[0_20px_48px_-16px_rgba(15,23,42,0.22)] hover:ring-2 ring-transparent ${theme.hoverRing} ${theme.hoverBorder} ${active ? 'border-[#1E88E5] ring-2 ring-[#1E88E5]/35' : 'border-slate-200/88 cursor-pointer'}`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" style={{ background: theme.glow }} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-[11px]">{title}</p>
          <p className={`mt-1.5 text-3xl font-bold tabular-nums leading-none sm:mt-2 sm:text-4xl ${theme.valueClass}`}>{value}</p>
          {subtitle ? <p className="mt-1.5 text-[11px] font-medium text-slate-400 sm:mt-2 sm:text-xs">{subtitle}</p> : null}
          {trend ? (
            <p className={`mt-2 flex items-center gap-1 text-[11px] font-semibold sm:text-xs ${trend.positive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
              <i className={`${trend.positive ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-xs`} />
              {trend.value}
            </p>
          ) : null}
          {onClick ? (
            <p className="mt-2 text-[10px] font-semibold text-[#1E88E5] opacity-0 transition-opacity group-hover:opacity-100">
              Click to view →
            </p>
          ) : null}
        </div>
        <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/90 sm:h-12 sm:w-12 sm:rounded-xl ${theme.iconBg} ${theme.iconShadow} ${theme.iconRing}`}>
          <i className={`${icon} text-lg sm:text-xl`} />
        </div>
      </div>
    </motion.button>
  );
}

const KPI_FOCUS = {
  'total-tasks': { section: 'health', taskStatus: 'all', taskRag: 'all' },
  'open-tasks': { section: 'health', taskStatus: '__open__', taskRag: 'all' },
  'completed-tasks': { section: 'health', taskStatus: 'Completed', taskRag: 'all' },
  'overdue-tasks': { section: 'health', taskStatus: '__overdue__', taskRag: 'all' },
};

function TaskKPISection({ metrics, onKpiClick, activeKey = null }) {
  const m = metrics ?? computeTaskKpiMetrics([]);
  const cards = [
    {
      key: 'total-tasks',
      title: 'Total Tasks',
      value: m.totalTasks,
      subtitle: 'Across all active projects',
      icon: 'ri-list-check-3',
      theme: KPI_THEME.subtasks,
      trend: { value: `${m.totalTasks} tracked`, positive: true },
    },
    {
      key: 'open-tasks',
      title: 'Open Tasks',
      value: m.openTasks,
      subtitle: `${m.openPct}% of total tasks`,
      icon: 'ri-folder-open-line',
      theme: KPI_THEME.open,
      trend: { value: `${m.openTasks} pending`, positive: false },
    },
    {
      key: 'completed-tasks',
      title: 'Completed Tasks',
      value: m.completedTasks,
      subtitle: `${m.completedPct}% task completion rate`,
      icon: 'ri-check-double-line',
      theme: KPI_THEME.tasksDone,
      trend: { value: `${m.completedTasks} closed`, positive: true },
    },
    {
      key: 'overdue-tasks',
      title: 'Overdue Tasks',
      value: m.overdueTasks,
      subtitle: 'Requires immediate action',
      icon: 'ri-alarm-warning-line',
      theme: KPI_THEME.overdue,
      trend: { value: `${m.overdueTasks} overdue`, positive: false },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {cards.map((card, index) => (
        <PremiumKPICard
          key={card.key}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          theme={card.theme}
          trend={card.trend}
          index={index}
          active={activeKey === card.key}
          onClick={() => onKpiClick?.(card.key)}
        />
      ))}
    </div>
  );
}

function RAGCell({ rag }) {
  const config = {
    Red: { bg: 'bg-red-50', dot: '🔴', text: 'text-[#E53935]', label: 'Delayed' },
    Amber: { bg: 'bg-orange-50', dot: '🟡', text: 'text-[#FB8C00]', label: 'At Risk' },
    Green: { bg: 'bg-green-50', dot: '🟢', text: 'text-[#43A047]', label: 'On Track' },
  }[rag];
  if (!config) return <span className="text-xs text-slate-500">—</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.text}`}>
      <span>{config.dot}</span>
      {config.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const sLower = String(status || '').toLowerCase();
  const cfg =
    sLower.includes('complete') || sLower.includes('closed') || sLower.includes('done')
      ? { bg: 'bg-green-50', text: 'text-[#43A047]' }
      : sLower.includes('progress') || sLower.includes('review')
        ? { bg: 'bg-blue-50', text: 'text-[#1E88E5]' }
        : sLower.includes('overdue')
          ? { bg: 'bg-red-50', text: 'text-[#E53935]' }
          : { bg: 'bg-slate-100', text: 'text-slate-600' };
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {status || '—'}
    </span>
  );
}

function compactPageIndices(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current, current - 1, current + 1, current - 2, current + 2]);
  return [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
}

const TASK_COLUMN_META = [
  { key: 'taskName', label: 'Task Name', filter: 'taskName' },
  { key: 'projectName', label: 'Project', filter: 'project' },
  { key: 'assignedTo', label: 'Assigned To', filter: 'assignedTo' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
  { key: 'revised', label: 'Revised' },
  { key: 'agingDays', label: 'Aging' },
  { key: 'delayDays', label: 'Delay' },
  { key: 'rag', label: 'RAG Status', filter: 'rag' },
  { key: 'status', label: 'Status', filter: 'status' },
];

function isEmptyProjectName(projectName) {
  const v = String(projectName ?? '').trim();
  return !v || v === '—' || v === '-' || v.toLowerCase() === 'n/a';
}

function TaskProjectCell({ projectName }) {
  if (isEmptyProjectName(projectName)) {
    return (
      <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200/80 sm:text-xs">
        Individual Task
      </span>
    );
  }
  return (
    <span
      className="inline-block max-w-[140px] truncate rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#1E88E5]"
      title={projectName}
    >
      {projectName}
    </span>
  );
}

function TaskDrillDownPanel({ task, processSubtasks, onOpenSubtaskPopup, onCreateSubtask, onRefresh, refreshing }) {
  const subtasks = useMemo(
    () => filterSubtasksForTask(processSubtasks, resolveTaskBusinessIdFromRow(task)).map((item) => (item.taskName ? item : mapProcessSubtaskItem(item))),
    [processSubtasks, task],
  );
  const canAddSubtask = typeof onCreateSubtask === 'function' && !isTaskCompleted(task?.status);

  return (
    <div className="bg-white p-4 sm:p-6">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1E88E5]">Subtasks</p>
          <p className="text-sm text-slate-600">{subtasks.length} subtask{subtasks.length === 1 ? '' : 's'} for this task</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {typeof onRefresh === 'function' ? (
            <button
              type="button"
              disabled={refreshing}
              onClick={() => onRefresh()}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-[#2C3E50] shadow-sm disabled:opacity-60 sm:text-xs"
            >
              <i className={`ri-refresh-line ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          ) : null}
          {canAddSubtask ? (
            <button
              type="button"
              onClick={() => onCreateSubtask(task)}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#1E88E5] px-3 py-2 text-[11px] font-semibold text-white shadow-sm sm:text-xs"
            >
              <i className="ri-add-line" />
              Add subtask
            </button>
          ) : null}
        </div>
      </div>

      {subtasks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-10">
          <i className="ri-node-tree text-3xl text-gray-300" />
          <p className="text-sm text-[#7F8C8D]">No subtasks yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subtasks.map((sub) => (
            <SubtaskAccordionRow
              key={sub.id}
              sub={sub}
              onClick={() => onOpenSubtaskPopup?.(sub)}
              statusSlot={<StatusBadge status={sub.status} />}
              className="bg-slate-50/50"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TasksHealthTable({
  data,
  processSubtasks,
  onOpenTaskPopup,
  onOpenSubtaskPopup,
  onCreateSubtask,
  onRefresh,
  refreshing,
  insightFilter = null,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [ragFilter, setRagFilter] = useState('all');
  const [taskNameFilter, setTaskNameFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [sortKey, setSortKey] = useState('taskName');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!insightFilter?.token) return;
    setProjectFilter('all');
    setTaskNameFilter('all');
    setAssigneeFilter('all');
    setSearch('');
    if (insightFilter.status != null) {
      setStatusFilter(insightFilter.status);
    }
    if (insightFilter.rag != null) {
      setRagFilter(insightFilter.rag);
    } else if (insightFilter.status != null) {
      setRagFilter('all');
    }
  }, [insightFilter?.token, insightFilter?.status, insightFilter?.rag]);

  const taskNameOptions = useMemo(
    () => distinctFilterOptions(data, (d) => d.taskName, { allLabel: 'All Tasks' }),
    [data],
  );
  const projectOptions = useMemo(
    () =>
      distinctFilterOptions(data, (d) => d.projectName, {
        allLabel: 'All Projects',
        emptyValue: '__individual__',
        emptyLabel: 'Individual Task',
      }),
    [data],
  );
  const assigneeOptions = useMemo(
    () => distinctFilterOptions(data, (d) => d.assignedTo, { allLabel: 'All Assignees' }),
    [data],
  );
  const ragOptions = [
    { value: 'all', label: 'All RAG' },
    { value: 'Green', label: 'On Track' },
    { value: 'Amber', label: 'At Risk' },
    { value: 'Red', label: 'Delayed' },
  ];
  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'All Status' },
      { value: '__open__', label: 'Open (not completed)' },
      { value: '__overdue__', label: 'Overdue (delayed)' },
      ...distinctFilterOptions(data, (d) => d.status, { allLabel: 'All Status' }).slice(1),
    ],
    [data],
  );

  const filtered = useMemo(
    () =>
      data.filter((row) => {
        if (taskNameFilter !== 'all' && row.taskName !== taskNameFilter) return false;
        if (assigneeFilter !== 'all' && row.assignedTo !== assigneeFilter) return false;
        if (ragFilter !== 'all' && row.rag !== ragFilter) return false;
        if (statusFilter === '__open__') {
          if (isTaskCompleted(row.status)) return false;
        } else if (statusFilter === '__overdue__') {
          if (!isTaskOverdue(row)) return false;
        } else if (statusFilter !== 'all' && row.status !== statusFilter) {
          return false;
        }
        if (projectFilter === '__individual__') {
          if (!isEmptyProjectName(row.projectName)) return false;
        } else if (projectFilter !== 'all' && row.projectName !== projectFilter) {
          return false;
        }
        if (
          search &&
          !row.taskName.toLowerCase().includes(search.toLowerCase()) &&
          !row.assignedTo.toLowerCase().includes(search.toLowerCase()) &&
          !String(row.projectName || '').toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [data, ragFilter, statusFilter, projectFilter, taskNameFilter, assigneeFilter, search],
  );

  const sortedFiltered = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'taskName':
          return compareText(a.taskName, b.taskName, dir);
        case 'projectName':
          return compareText(
            isEmptyProjectName(a.projectName) ? 'Individual Task' : a.projectName,
            isEmptyProjectName(b.projectName) ? 'Individual Task' : b.projectName,
            dir,
          );
        case 'assignedTo':
          return compareText(a.assignedTo, b.assignedTo, dir);
        case 'startDate':
          return compareDateValue(a.startDate, b.startDate, dir, sortDir);
        case 'endDate':
          return compareDateValue(a.endDate, b.endDate, dir, sortDir);
        case 'revised':
        case 'revisedCount':
          return compareNumber(a.revisedCount, b.revisedCount, dir);
        case 'agingDays':
          return compareNumber(a.agingDays, b.agingDays, dir);
        case 'delayDays':
          return compareNumber(a.delayDays, b.delayDays, dir);
        case 'rag':
          return compareText(a.rag, b.rag, dir);
        case 'status':
          return compareText(a.status, b.status, dir);
        default:
          return 0;
      }
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const total = sortedFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, total);
  const pageRows = sortedFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageIndexList = compactPageIndices(safePage, totalPages);

  const handleSort = (key) => {
    const next = toggleSortState(sortKey, sortDir, key);
    setSortKey(next.sortKey);
    setSortDir(next.sortDir);
  };

  const columnFilterProps = {
    taskName: { filterValue: taskNameFilter, onFilterChange: setTaskNameFilter, filterOptions: taskNameOptions },
    project: { filterValue: projectFilter, onFilterChange: setProjectFilter, filterOptions: projectOptions },
    assignedTo: { filterValue: assigneeFilter, onFilterChange: setAssigneeFilter, filterOptions: assigneeOptions },
    rag: { filterValue: ragFilter, onFilterChange: setRagFilter, filterOptions: ragOptions },
    status: { filterValue: statusFilter, onFilterChange: setStatusFilter, filterOptions: statusOptions },
  };

  const toggleExpand = (row) => {
    setExpandedId((prev) => (prev === row.id ? null : row.id));
  };

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, projectFilter, ragFilter, taskNameFilter, assigneeFilter]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-indigo-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center">
        <div className="text-center lg:text-left">
          <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Tasks Health Overview</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
            {total} of {data.length} tasks
            {totalPages > 1 ? ` · ${PAGE_SIZE} per page` : ''}
            {' · tap a row for details'}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto">
          <div className="relative w-full sm:w-40">
            <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#7F8C8D]" />
            <input
              type="text"
              placeholder="Search task..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-[11px] outline-none focus:border-indigo-500 sm:text-xs"
            />
          </div>
          <div className="flex snap-x snap-mandatory items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
            <PtSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-[8rem] shrink-0"
              aria-label="Filter by status"
              options={statusOptions}
            />
            <PtSelect
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="min-w-[8rem] max-w-[180px] shrink-0"
              aria-label="Filter by project"
              options={projectOptions}
            />
            {typeof onRefresh === 'function' ? (
              <button
                type="button"
                aria-label="Refresh tasks"
                disabled={refreshing}
                onClick={() => onRefresh()}
                className="inline-flex shrink-0 snap-start items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-[#2C3E50] shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:text-xs"
              >
                <i className={`ri-refresh-line text-sm ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="w-8 px-3 py-2.5" aria-label="Expand" />
              {TASK_COLUMN_META.map((col) => {
                const filterCfg = col.filter ? columnFilterProps[col.filter] : null;
                return (
                  <TableColumnHeader
                    key={col.key}
                    col={col}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    filterValue={filterCfg?.filterValue}
                    filterOptions={filterCfg?.filterOptions}
                    onFilterChange={filterCfg?.onFilterChange}
                    className="px-4 py-2.5"
                  />
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-12 text-center text-sm text-[#7F8C8D]">No tasks found</td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const open = expandedId === row.id;
                const subCount = filterSubtasksForTask(processSubtasks, resolveTaskBusinessIdFromRow(row)).length;
                return (
                  <Fragment key={row.id}>
                    <tr className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50" onClick={() => onOpenTaskPopup?.(row)}>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => toggleExpand(row)} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-[#1E88E5]">
                          <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-lg`} />
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="max-w-[200px] truncate text-sm font-medium text-[#2C3E50]">{row.taskName}</p>
                        <p className="text-xs text-[#7F8C8D]">{row.taskId || row.id}</p>
                        {subCount > 0 ? <p className="text-[10px] font-medium text-[#FB8C00]">{subCount} subtask{subCount === 1 ? '' : 's'}</p> : null}
                      </td>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()} title={isEmptyProjectName(row.projectName) ? 'Individual Task' : row.projectName}>
                        <TaskProjectCell projectName={row.projectName} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1E88E5]/10 text-xs font-bold text-[#1E88E5]">{row.assigneeAvatar}</div>
                          <span className="text-sm text-[#2C3E50]">{row.assignedTo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-[#2C3E50]">{row.startDate || '—'}</td>
                      <td className={`px-4 py-2.5 text-sm ${row.status === 'Overdue' || row.delayDays > 0 ? 'font-semibold text-[#E53935]' : 'text-[#2C3E50]'}`}>
                        {row.revisedEndDate ?? row.endDate ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.revisedCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-[#FB8C00]">
                            <i className="ri-refresh-line text-xs" />
                            {row.revisedCount}x
                          </span>
                        ) : (
                          <span className="text-xs text-[#7F8C8D]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-[#7F8C8D]">{row.agingDays}d</td>
                      <td className="px-4 py-2.5">
                        {row.delayDays > 0 ? (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-[#E53935]">+{row.delayDays}d</span>
                        ) : (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-[#43A047]">On time</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5"><RAGCell rag={row.rag} /></td>
                      <td className="px-4 py-2.5"><StatusBadge status={row.status} /></td>
                    </tr>
                    {open ? (
                      <tr className="bg-slate-50/95">
                        <td colSpan={11} className="border-b border-slate-200 p-0">
                          <TaskDrillDownPanel
                            task={row}
                            processSubtasks={processSubtasks}
                            onOpenSubtaskPopup={onOpenSubtaskPopup}
                            onCreateSubtask={onCreateSubtask}
                            onRefresh={onRefresh}
                            refreshing={refreshing}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2.5 p-2.5 lg:hidden">
        {pageRows.map((row) => {
          const open = expandedId === row.id;
          return (
            <div key={row.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button type="button" onClick={() => onOpenTaskPopup?.(row)} className="w-full p-3 text-left">
                <p className="text-sm font-semibold text-slate-800">{row.taskName}</p>
                <p className="text-[11px] text-[#1E88E5]">
                  {isEmptyProjectName(row.projectName) ? 'Individual Task' : row.projectName}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <StatusBadge status={row.status} />
                  <RAGCell rag={row.rag} />
                </div>
              </button>
              <button type="button" onClick={() => toggleExpand(row)} className="w-full border-t border-slate-100 px-3 py-2 text-left text-xs font-medium text-[#1E88E5]">
                {open ? 'Hide subtasks' : 'Show subtasks'}
              </button>
              {open ? (
                <TaskDrillDownPanel
                  task={row}
                  processSubtasks={processSubtasks}
                  onOpenSubtaskPopup={onOpenSubtaskPopup}
                  onCreateSubtask={onCreateSubtask}
                  onRefresh={onRefresh}
                  refreshing={refreshing}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {total > 0 ? (
        <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-3 sm:flex-row sm:px-5">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{pageStart}</span>–<span className="font-semibold text-slate-700">{pageEnd}</span> of{' '}
            <span className="font-semibold text-slate-700">{total}</span>
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" disabled={safePage <= 1} onClick={() => setPage(1)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-40">«</button>
            <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-40">‹</button>
            {pageIndexList.map((n, idx) => (
              <span key={n} className="flex items-center">
                {idx > 0 && pageIndexList[idx - 1] !== n - 1 ? <span className="px-1 text-slate-400">…</span> : null}
                <button type="button" onClick={() => setPage(n)} className={`rounded-md border px-2 py-1 text-xs ${n === safePage ? 'border-[#1E88E5] bg-[#1E88E5] text-white' : 'border-slate-200 bg-white'}`}>{n}</button>
              </span>
            ))}
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-40">›</button>
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-40">»</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TasksDashboardPremium({ useLayout = true, scopeToCurrentUser = false }) {
  const { kf: kfFromContext } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null) ?? (typeof kf !== 'undefined' ? kf : null);
  const [userName, setUserName] = useState('User');
  const [roleName, setRoleName] = useState('Admin');
  const [apiTaskData, setApiTaskData] = useState([]);
  const [apiProcessSubtaskData, setApiProcessSubtaskData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [insightFocus, setInsightFocus] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [dimensionFilters, setDimensionFilters] = useState({
    company: '',
    lineOfBusiness: '',
    functionType: '',
    createdYear: '',
    createdPeriod: '',
  });
  const sectionRefs = useRef({});
  const headerRef = useRef(null);
  const insightPulseTimerRef = useRef(null);

  const reloadData = useCallback(async () => {
    if (!kfInstance?.api || !kfInstance?.account?._id) return;

    let tasksRes = { status: 'fulfilled', value: [] };
    let processSubtasksRes = { status: 'fulfilled', value: null };
    try {
      tasksRes = { status: 'fulfilled', value: await fetchTaskTrackerData(kfInstance, { enrichDetails: false }) };
    } catch (reason) {
      tasksRes = { status: 'rejected', reason };
    }
    try {
      processSubtasksRes = { status: 'fulfilled', value: await fetchAllSubtasks(kfInstance) };
    } catch (reason) {
      processSubtasksRes = { status: 'rejected', reason };
    }

    if (tasksRes.status === 'rejected') {
      console.warn('[TasksDashboard] Task fetch failed:', tasksRes.reason);
    }

    const tasks = tasksRes.status === 'fulfilled' ? (tasksRes.value ?? []) : [];
    const processSubtasks =
      processSubtasksRes.status === 'fulfilled'
        ? (processSubtasksRes.value?.items ?? []).map(mapProcessSubtaskItem)
        : [];

    if (processSubtasksRes.status === 'rejected') {
      console.warn('[TasksDashboard] Subtask fetch failed:', processSubtasksRes.reason);
    }

    setApiTaskData(tasks);
    setApiProcessSubtaskData(processSubtasks);
  }, [kfInstance]);

  useEffect(() => {
    if (!kfInstance) return undefined;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 25;

    async function run() {
      if (cancelled) return;
      if (!kfInstance?.api || !kfInstance?.account?._id) {
        attempts += 1;
        if (attempts < maxAttempts) {
          window.setTimeout(run, 250);
        }
        return;
      }
      try {
        await reloadData();
      } catch (error) {
        if (!cancelled) {
          console.warn('Tasks dashboard fetch failed:', error?.message || error);
          setApiTaskData([]);
          setApiProcessSubtaskData([]);
        }
      }
    }

    run();
    return () => { cancelled = true; };
  }, [kfInstance, reloadData]);

  useEffect(() => {
    if (!kfInstance?.user) return;
    const user = kfInstance.user;
    const resolvedName = String(user.Name || user.FirstName || 'User').trim();
    const resolvedRole = resolveRoleName(user.Role || user.Roles?.[0] || 'Admin');
    if (resolvedName) setUserName(resolvedName);
    if (resolvedRole) setRoleName(resolvedRole);
  }, [kfInstance]);

  const scopedPortfolio = useMemo(() => {
    if (!scopeToCurrentUser) {
      return { tasks: apiTaskData, processSubtasks: apiProcessSubtaskData };
    }
    return scopeTasksToCurrentUser(apiTaskData, apiProcessSubtaskData, kfInstance?.user);
  }, [scopeToCurrentUser, apiTaskData, apiProcessSubtaskData, kfInstance?.user]);

  const filterOptions = useMemo(() => {
    const tasks = scopedPortfolio.tasks;
    const itTasks = tasks.filter((t) => isInformationTechnologyCategory(t.lineOfBusiness));
    return {
      company: collectUniqueFieldValues(tasks, 'companyName'),
      lineOfBusiness: collectUniqueFieldValues(tasks, 'lineOfBusiness'),
      functionType: collectUniqueFieldValues(itTasks, 'functionType'),
      createdYear: buildCreatedYearOptions(tasks),
    };
  }, [scopedPortfolio.tasks]);

  const filteredTaskData = useMemo(
    () => filterTasksByDimensions(scopedPortfolio.tasks, dimensionFilters),
    [scopedPortfolio.tasks, dimensionFilters],
  );

  const filteredProcessSubtaskData = useMemo(
    () => filterProcessSubtasksByTasks(scopedPortfolio.processSubtasks, filteredTaskData, dimensionFilters),
    [scopedPortfolio.processSubtasks, filteredTaskData, dimensionFilters],
  );

  const hasActiveFilters = hasActiveDimensionFilters(dimensionFilters);

  const handleDimensionFilterChange = useCallback((key, value) => {
    setDimensionFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'lineOfBusiness' && !isInformationTechnologyCategory(value)) {
        next.functionType = '';
      }
      if (key === 'createdYear') {
        next.createdPeriod = '';
      }
      return next;
    });
  }, []);

  const handleClearDimensionFilters = useCallback(() => {
    setDimensionFilters({
      company: '',
      lineOfBusiness: '',
      functionType: '',
      createdYear: '',
      createdPeriod: '',
    });
  }, []);

  const kpiMetrics = useMemo(() => computeTaskKpiMetrics(filteredTaskData), [filteredTaskData]);

  /** Offset by sticky header height so section titles aren't hidden under the bar */
  const scrollToSection = useCallback((key) => {
    const align = () => {
      const el = sectionRefs.current[key];
      if (!el) return;
      const headerH = headerRef.current?.getBoundingClientRect().height ?? 0;
      const gap = 16;
      const offset = headerH + gap;
      const root = typeof document !== 'undefined' ? document.querySelector('.rootDiv') : null;
      if (root) {
        const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - offset;
        root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      } else {
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(align));
  }, []);

  const applyInsightFocus = useCallback(
    (key, focus) => {
      if (!focus) return;
      const token = Date.now();
      setInsightFocus({ key, token, pulse: true, ...focus });
      scrollToSection(focus.section);
      if (insightPulseTimerRef.current) clearTimeout(insightPulseTimerRef.current);
      insightPulseTimerRef.current = setTimeout(() => {
        setInsightFocus((prev) => (prev?.token === token ? { ...prev, pulse: false } : prev));
      }, 2400);
    },
    [scrollToSection],
  );

  const handleKpiClick = useCallback(
    (key) => {
      applyInsightFocus(key, KPI_FOCUS[key]);
    },
    [applyInsightFocus],
  );

  useEffect(() => () => {
    if (insightPulseTimerRef.current) clearTimeout(insightPulseTimerRef.current);
  }, []);

  const handleOpenTaskDetail = useCallback((row) => {
    if (!row) return false;
    setDetailModal({ type: 'task', row });
    return true;
  }, []);

  const handleOpenSubtaskDetail = useCallback((row) => {
    if (!row) return false;
    setDetailModal({ type: 'subtask', row });
    return true;
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setDetailModal(null);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadData();
    } finally {
      setRefreshing(false);
    }
  }, [reloadData]);

  const handleCreateSubtask = useCallback(
    async (taskRow) => {
      if (isTaskCompleted(taskRow?.status)) {
        const sdk = kfInstance ?? kf;
        sdk?.client?.showInfo?.('Cannot add a subtask to a completed task.');
        return false;
      }

      const sdk = kfInstance ?? kf;
      if (!sdk) return false;
      const taskId = resolveTaskBusinessIdFromRow(taskRow);
      if (!taskId) {
        sdk?.client?.showInfo?.('Missing task id on this row.');
        return false;
      }
      const lockKey = `task-${taskRow?.id ?? taskId}`;
      if (dashboardRowCreateLock.has(lockKey)) return false;
      dashboardRowCreateLock.add(lockKey);
      try {
        const created = await createSubtaskInstance(sdk, taskId);
        void openSubtaskDraft(sdk, created.instanceId, created.activityInstanceId)
          .then(() => reloadData())
          .catch((e) => console.warn('Open subtask draft failed:', e));
        return true;
      } catch (error) {
        sdk?.client?.showInfo?.(error?.message || 'Failed to create subtask.');
        return false;
      } finally {
        dashboardRowCreateLock.delete(lockKey);
      }
    },
    [kfInstance, reloadData],
  );

  const healthInsightFilter =
    insightFocus?.section === 'health'
      ? {
          token: insightFocus.token,
          status: insightFocus.taskStatus,
          rag: insightFocus.taskRag,
        }
      : null;

  const content = (
    <div className="bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff]">
      <div className="p-2 pb-6 sm:p-6">
        <motion.header
          ref={headerRef}
          className="sticky top-0 z-30 -mx-2 mb-3 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-2 pb-2.5 pt-2 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.2)] backdrop-blur-md sm:-mx-6 sm:mb-5 sm:px-6 sm:pb-4 sm:pt-3"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mx-auto flex max-w-[1800px] flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="min-w-0 shrink text-center lg:w-auto lg:py-0.5 lg:text-left">
              <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl md:text-3xl">
                {getGreetingText()}, <span className="font-semibold text-slate-900">{userName}</span>
              </h1>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 lg:text-sm">
                {scopeToCurrentUser ? (
                  <>
                    Your tasks · <span className="text-slate-600">{roleName}</span>
                  </>
                ) : (
                  <>
                    Tasks dashboard · <span className="text-slate-600">{roleName}</span>
                  </>
                )}
              </p>
            </div>
            <DashboardDimensionFilters
              filters={dimensionFilters}
              options={filterOptions}
              onChange={handleDimensionFilterChange}
              onClear={handleClearDimensionFilters}
              hasActiveFilters={hasActiveFilters}
            />
          </div>
        </motion.header>

        <div className="space-y-3 lg:space-y-6">
          <motion.section
            ref={(el) => { sectionRefs.current.kpi = el; }}
            id="kpi"
            className="scroll-mt-24 lg:scroll-mt-32"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="relative mb-1.5 flex w-full items-center px-0.5 sm:mb-3">
              <h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">Insights</h2>
              <div className="ml-auto flex shrink-0 items-center">
                <SatelliteOrbitMenu
                  kfInstance={kfInstance}
                  placement="inline"
                  options={TASKS_DASHBOARD_SATELLITE_OPTIONS}
                  popupIds={{
                    task: 'Popup_QO1ppGoYU6',
                    subtask: 'Popup_5OXg4dWTHd',
                  }}
                />
              </div>
            </div>
            <TaskKPISection metrics={kpiMetrics} onKpiClick={handleKpiClick} activeKey={insightFocus?.key} />
          </motion.section>

          <motion.section
            ref={(el) => { sectionRefs.current.health = el; }}
            id="health"
            className={`scroll-mt-24 rounded-2xl transition-[box-shadow,ring] duration-500 lg:scroll-mt-32 lg:rounded-3xl ${
              insightFocus?.section === 'health' && insightFocus?.pulse
                ? 'ring-2 ring-[#1E88E5] ring-offset-2 ring-offset-[#edf1ff] shadow-[0_0_0_6px_rgba(30,136,229,0.12)]'
                : ''
            }`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <TasksHealthTable
              data={filteredTaskData}
              processSubtasks={filteredProcessSubtaskData}
              onOpenTaskPopup={handleOpenTaskDetail}
              onOpenSubtaskPopup={handleOpenSubtaskDetail}
              onCreateSubtask={handleCreateSubtask}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              insightFilter={healthInsightFilter}
            />
          </motion.section>
        </div>
      </div>

      <DashboardDetailModal
        detail={detailModal}
        onClose={handleCloseDetailModal}
        viewerName={userName}
      />
    </div>
  );

  if (!useLayout) return content;
  return <AppLayout>{content}</AppLayout>;
}

/** Kissflow custom component — task-focused dashboard. Pass scopeToCurrentUser to limit to assignee = logged-in user. */
export default function TasksDashboardPage({ useLayout = false, scopeToCurrentUser = false }) {
  return <TasksDashboardPremium useLayout={useLayout} scopeToCurrentUser={scopeToCurrentUser} />;
}
