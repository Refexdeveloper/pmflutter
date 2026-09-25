/* eslint-disable max-lines -- Single-file Kissflow employee dashboard bundle */
import { useState, useCallback, useContext, useEffect, useId, useRef, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import AppLayout from './components/feature/AppLayout.jsx';
import TablePaginationBar, { PT_TABLE_PAGE_SIZE } from './components/TablePaginationBar.jsx';
import {
  TableColumnHeader,
  distinctFilterOptions,
  toggleSortState,
  compareText,
  compareNumber,
  compareDateValue,
} from './components/TableColumnHeaders.jsx';
import { fetchEmployeeDashboardTasks } from './lib/kfEmployeeTasksReport.js';
import { fetchEmployeeDashboardProjects } from './lib/kfEmployeeProjectsReport.js';
import {
  enrichProjectRows,
  personMatches,
  resolveRoleName,
  toInitials,
} from './lib/kfProjectDashboard.js';
import {
  buildCreatedYearOptions,
  getCreatedPeriodOptions,
  resolveCreatedDateRange,
  matchesCreatedDateRange,
} from './lib/dashboardCreatedDateFilters.js';
import { KissflowSDKContext, kf } from './sdk/index.js';
import SatelliteOrbitMenu from './components/SatelliteOrbitMenu.jsx';
import PtSelect from './components/PtSelect.jsx';


/** Employee dashboard Kissflow popup ids */
const EMP_POPUP_IDS = {
  project: 'Popup_Xrl9X_fXTJ',
  task: 'Popup_zNfOGGnPZ-',
};

const EMP_POPUP_SIZE = {
  width: 960,
  height: 720,
  popupWidth: '960px',
  popupHeight: '720px',
};

/** KPI card → section scroll + list filter */
const EMP_KPI_FOCUS = {
  'my-projects': { section: 'projects', projectFilter: 'all', label: 'My projects' },
  'my-tasks': { section: 'tasks', taskFilter: 'All', label: 'My tasks' },
  'completion-rate': { section: 'tasks', taskFilter: 'Completed', label: 'Completed tasks' },
  'overdue': { section: 'tasks', taskFilter: 'Overdue', label: 'Overdue tasks' },
};

function resolveEmpKfSdk(kfInstance) {
  return kfInstance ?? (typeof window !== 'undefined' ? window.kf : null) ?? (typeof kf !== 'undefined' ? kf : null);
}

/** Same InstanceID / ActivityID parsing as UserSpecificPT My Tasks */
function resolveEmpRowPopupIds(row) {
  const raw = row?.raw ?? row ?? {};
  const instanceId =
    raw?._id ?? row?.InstanceID ?? row?.InstanceId ?? row?.instanceId ?? row?.id ?? '';
  const activityInstance =
    raw?._activity_instance_id ?? row?.ActivityID ?? row?.ActivityId ?? row?.activityId ?? '';
  const activityId = Array.isArray(activityInstance) ? (activityInstance[0] ?? '') : activityInstance;
  return {
    instanceId: String(instanceId || '').trim(),
    activityId: String(activityId || '').trim(),
  };
}

/** Case item id for EmployeeDashboard project popup (CaseID param only). */
function resolveEmpProjectCaseId(row) {
  const raw = row?.raw ?? row ?? {};
  return String(
    raw?._id ??
      raw?._item_id ??
      row?.CaseID ??
      row?.caseId ??
      row?.InstanceID ??
      row?.id ??
      '',
  ).trim();
}

function openEmpKissflowPopup(kfInstance, popupId, instanceId, activityId, { requireActivity = true } = {}) {
  const sdk = resolveEmpKfSdk(kfInstance);
  if (typeof sdk?.app?.page?.openPopup !== 'function') {
    console.warn('Employee dashboard popup: openPopup not available', { popupId });
    return false;
  }
  if (!instanceId || (requireActivity && !activityId)) {
    console.warn('Employee dashboard popup: missing ids', { popupId, instanceId, activityId });
    sdk?.client?.showInfo?.('Missing InstanceID or ActivityID for this row.');
    return false;
  }
  try {
    const params = {
      InstanceID: instanceId,
      ...EMP_POPUP_SIZE,
    };
    if (activityId) {
      params.ActivityID = activityId;
    }
    const p = sdk.app.page.openPopup(popupId, params);
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('Employee dashboard popup failed:', err));
    }
    return true;
  } catch (err) {
    console.warn('Employee dashboard popup threw', err);
    return false;
  }
}

/** EmployeeDashboard projects only — open with CaseID (not InstanceID/ActivityID). */
function openEmpProjectPopup(kfInstance, caseId) {
  const sdk = resolveEmpKfSdk(kfInstance);
  if (typeof sdk?.app?.page?.openPopup !== 'function') {
    console.warn('Employee project popup: openPopup not available');
    return false;
  }
  if (!caseId) {
    console.warn('Employee project popup: missing CaseID');
    sdk?.client?.showInfo?.('Missing CaseID for this project.');
    return false;
  }
  try {
    const p = sdk.app.page.openPopup(EMP_POPUP_IDS.project, {
      CaseID: caseId,
      ...EMP_POPUP_SIZE,
    });
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('Employee project popup failed:', err));
    }
    return true;
  } catch (err) {
    console.warn('Employee project popup threw', err);
    return false;
  }
}



/** --- Employee motion presets --- */

const EMP_MOTION = {
  hoverLift: {
    y: -2,
    transition: { type: 'spring', stiffness: 320, damping: 24 },
  },
  tapPress: {
    scale: 0.98,
    transition: { type: 'spring', stiffness: 520, damping: 28 },
  },
  rowTap: {
    scale: 0.996,
    transition: { type: 'spring', stiffness: 520, damping: 28 },
  },
  sectionEnter: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.42, ease: 'easeOut' },
  },
  modalBackdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.22 },
  },
  modalPanel: {
    initial: { opacity: 0, y: 36, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 24, scale: 0.985 },
    transition: { type: 'spring', stiffness: 240, damping: 24 },
  },
  counter: {
    duration: 0.8,
    ease: 'easeOut',
  },
};



/** --- Toast --- */

/**
 * Lightweight toast stack for dashboard actions.
 * @typedef {{ id: string; message: string; type?: 'success'|'info'|'error' }} ToastMessage
 */

const tone = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  info: 'border-blue-200 bg-blue-50 text-slate-900',
  error: 'border-red-200 bg-red-50 text-red-900',
};

function Toast({ toasts = [], onRemove }) {
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-2.5 right-2.5 z-[100] flex w-[92vw] max-w-sm flex-col gap-1.5 p-1.5 sm:bottom-6 sm:right-6 sm:w-auto sm:gap-2 sm:p-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start justify-between gap-2.5 rounded-lg border px-3 py-2.5 text-xs shadow-lg sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm ${tone[t.type] || tone.success}`}
          role="status"
        >
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            type="button"
            onClick={() => onRemove?.(t.id)}
            className="shrink-0 rounded-lg p-1 text-current opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <i className="ri-close-line text-base" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}


/** --- Employee components --- */



function EmpHeader({
  profile,
  createdYear = '',
  createdPeriod = '',
  createdYearOptions = [],
  onCreatedYearChange,
  onCreatedPeriodChange,
}) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const periodOptions = getCreatedPeriodOptions(createdYear);

  return (
    <div className="sticky top-0 z-30 overflow-hidden border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1.5 py-2 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:px-6 sm:py-4">
      <div className="relative mx-auto flex max-w-[1800px] flex-col gap-2.5 sm:gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E88E5] text-[10px] font-bold text-white shadow-[0_8px_20px_-4px_rgba(30,136,229,0.45)] sm:h-12 sm:w-12 sm:rounded-2xl sm:text-sm">
            {profile.avatar}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[11px] font-semibold text-slate-900 sm:text-base">{profile.name}</h2>
              <span className="shrink-0 rounded-full bg-white/80 px-1.5 py-0.5 text-[8px] font-semibold text-[#1E88E5] ring-1 ring-[#1E88E5]/20 sm:px-2.5 sm:text-xs">
                {profile.role}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[9px] text-slate-600 sm:text-xs">{profile.email}</p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:justify-end lg:w-auto">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/90 px-2 py-1.5 text-[10px] text-slate-800 shadow-sm sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs">
            <i className="ri-calendar-line text-[#1E88E5]" />
            <span className="font-medium">{dateStr}</span>
          </div>

          <PtSelect
            value={createdYear}
            onChange={(e) => onCreatedYearChange?.(e.target.value)}
            leadingIcon="ri-calendar-2-line"
            aria-label="Filter by year"
            className="min-w-0 w-full sm:min-w-[11rem] sm:w-auto"
            triggerClassName="text-xs py-2 h-auto min-h-[2.25rem]"
            options={[
              { value: '', label: 'All years' },
              ...createdYearOptions,
            ]}
          />

          {createdYear ? (
            <PtSelect
              value={createdPeriod}
              onChange={(e) => onCreatedPeriodChange?.(e.target.value)}
              leadingIcon="ri-calendar-event-line"
              aria-label="Filter by period"
              className="min-w-0 w-full sm:min-w-[11rem] sm:w-auto"
              triggerClassName="text-xs py-2 h-auto min-h-[2.25rem]"
              options={periodOptions}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}







function AnimatedValue({ value, suffix = '' }) {
  const numeric = Number.parseInt(String(value).replace(/[^\d-]/g, ''), 10) || 0;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const durationMs = Math.max(1, (EMP_MOTION.counter.duration || 0.8) * 1000);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(Math.round(from + (numeric - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [numeric]);

  return (
    <span>{display}{suffix}</span>
  );
}

/** Match ProjectDashboardPage Insights KPI look / sizing */
const EMP_KPI_THEME = {
  total: {
    valueClass: 'text-[#2B5AED]',
    iconBg: 'bg-[#2B5AED]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(43,90,237,0.12)]',
    cardBg: 'from-sky-50/92 via-white to-indigo-50/72',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(43,90,237,0.22)]',
    hoverRing: 'group-hover:ring-[#2B5AED]/25',
    hoverBorder: 'group-hover:border-[#2B5AED]/40',
    glow: 'rgba(43,90,237,0.18)',
    iconRing: 'ring-1 ring-[#2B5AED]/20 group-hover:ring-white/50',
  },
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
  completed: {
    valueClass: 'text-[#22C55E]',
    iconBg: 'bg-[#22C55E]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(34,197,94,0.1)]',
    cardBg: 'from-emerald-50/92 via-white to-green-50/78',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(34,197,94,0.18)]',
    hoverRing: 'group-hover:ring-[#22C55E]/25',
    hoverBorder: 'group-hover:border-[#22C55E]/38',
    glow: 'rgba(34,197,94,0.14)',
    iconRing: 'ring-1 ring-emerald-500/20 group-hover:ring-white/50',
  },
  overdue: {
    valueClass: 'text-[#EF4444]',
    iconBg: 'bg-[#EF4444]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(239,68,68,0.1)]',
    cardBg: 'from-rose-50/92 via-white to-red-50/78',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(239,68,68,0.2)]',
    hoverRing: 'group-hover:ring-[#EF4444]/22',
    hoverBorder: 'group-hover:border-[#EF4444]/38',
    glow: 'rgba(239,68,68,0.14)',
    iconRing: 'ring-1 ring-red-500/20 group-hover:ring-white/55',
  },
};

function EmpPremiumKPICard({ title, value, subtitle, trend, icon, theme, index, loading = false, onClick, active = false }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 28,
        delay: reduceMotion ? 0 : Math.min(index * 0.035, 0.25),
      }}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -6,
              scale: 1.02,
              transition: { type: 'spring', stiffness: 420, damping: 22 },
            }
      }
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`
        group relative overflow-hidden rounded-xl border bg-gradient-to-br p-3.5 sm:rounded-2xl sm:p-5
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${active ? 'border-[#1E88E5] ring-2 ring-[#1E88E5]/35' : 'border-slate-200/88'}
        ${theme.cardBg}
        ${theme.cardShadow}
        transition-[box-shadow,border-color] duration-300 ease-out
        hover:shadow-[0_20px_48px_-16px_rgba(15,23,42,0.22)] hover:shadow-slate-400/20
        hover:ring-2 ring-transparent
        ${theme.hoverRing}
        ${theme.hoverBorder}
      `}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: theme.glow }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/0 via-transparent to-slate-100/35 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      {loading ? (
        <div className="relative animate-pulse space-y-3">
          <div className="h-3 w-24 rounded bg-slate-200/70" />
          <div className="h-9 w-16 rounded bg-slate-200/60 sm:h-10" />
          <div className="h-3 w-32 rounded bg-slate-200/50" />
        </div>
      ) : (
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-[11px] sm:tracking-[0.14em]">
              {title}
            </p>
            <p
              className={`mt-1.5 text-3xl font-bold tabular-nums leading-none tracking-tight sm:mt-2 sm:text-4xl ${theme.valueClass}`}
            >
              {value}
            </p>
            {subtitle ? (
              <p className="mt-1.5 text-[11px] font-medium text-slate-400 sm:mt-2 sm:text-xs">{subtitle}</p>
            ) : null}
            {trend ? (
              <p
                className={`mt-2 flex items-center gap-1 text-[11px] font-semibold sm:mt-2.5 sm:text-xs ${
                  trend.positive ? 'text-[#22C55E]' : 'text-[#EF4444]'
                }`}
              >
                <i className={`${trend.positive ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-xs sm:text-sm`} />
                {trend.value}
              </p>
            ) : null}
          </div>

          <div
            className={`
              relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/90 sm:h-12 sm:w-12 sm:rounded-xl
              ${theme.iconBg}
              ${theme.iconShadow}
              ${theme.iconRing}
              transition-all duration-300 ease-out
              group-hover:scale-105 group-hover:-rotate-[8deg] group-hover:shadow-[0_10px_22px_-12px_rgba(15,23,42,0.25)]
            `}
          >
            <i className={`${icon} text-lg transition-transform duration-300 group-hover:scale-110 sm:text-xl`} />
          </div>
        </div>
      )}
    </motion.div>
  );
}

function EmpKPICards({ data, isLoadingTasks = false, isLoadingProjects = false, onKpiClick, activeKey = null }) {
  const cards = [
    {
      key: 'my-projects',
      title: 'My Projects',
      value: <AnimatedValue value={data.totalProjects} />,
      subtitle: 'Assigned to you',
      icon: 'ri-folder-3-line',
      theme: EMP_KPI_THEME.total,
      trend: { value: `${data.totalProjects} projects`, positive: true },
      loading: isLoadingProjects,
    },
    {
      key: 'my-tasks',
      title: 'My Tasks',
      value: <AnimatedValue value={data.totalSubtasks} />,
      subtitle: 'Tasks assigned to me',
      icon: 'ri-checkbox-line',
      theme: EMP_KPI_THEME.subtasks,
      trend: { value: `${data.totalSubtasks} tracked`, positive: true },
      loading: isLoadingTasks,
    },
    {
      key: 'completion-rate',
      title: 'Completion Rate',
      value: <AnimatedValue value={data.completionRate} suffix="%" />,
      subtitle: `${data.completedTasks} of ${data.totalSubtasks} done`,
      icon: 'ri-pie-chart-2-line',
      theme: EMP_KPI_THEME.completed,
      trend: {
        value: `${data.completionRate}% complete`,
        positive: Number(data.completionRate) >= 50,
      },
      loading: isLoadingTasks,
    },
    {
      key: 'overdue',
      title: 'Overdue',
      value: <AnimatedValue value={data.overdueTasks} />,
      subtitle: 'Needs attention',
      icon: 'ri-alarm-warning-line',
      theme: EMP_KPI_THEME.overdue,
      trend: {
        value: data.overdueTasks > 0 ? `${data.overdueTasks} overdue` : 'None overdue',
        positive: Number(data.overdueTasks) === 0,
      },
      loading: isLoadingTasks,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 xl:grid-cols-4">
      {cards.map((card, index) => (
        <EmpPremiumKPICard
          key={card.key}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          theme={card.theme}
          trend={card.trend}
          index={index}
          loading={card.loading}
          active={activeKey === card.key}
          onClick={() => onKpiClick?.(card.key)}
        />
      ))}
    </div>
  );
}




const ragColor = {
  Green: '#43A047',
  Amber: '#FB8C00',
  Red: '#E53935',
};

const ragBg = {
  Green: 'bg-green-50',
  Amber: 'bg-orange-50',
  Red: 'bg-red-50',
};

const ragLabel = {
  Green: 'On track',
  Amber: 'At risk',
  Red: 'Delayed',
};

function EmpProgressChart({ projects, isLoading = false }) {
  const list = projects.length ? projects : [];
  const completedSum = list.reduce((s, p) => s + Number(p.completedTasks || 0), 0);
  const totalSum = list.reduce((s, p) => s + Number(p.totalTasks || 0), 0);
  // Prefer task-weighted completion (matches subtitle); fall back to mean project % when no tasks.
  const overall = totalSum > 0
    ? Math.round((completedSum / totalSum) * 100)
    : list.length
      ? Math.round(list.reduce((sum, p) => sum + Number(p.progress || 0), 0) / list.length)
      : 0;
  const circumference = 2 * Math.PI * 48;
  const offset = circumference - (overall / 100) * circumference;
  const onTrack = list.filter((p) => p.rag === 'Green').length;
  const atRisk = list.filter((p) => p.rag === 'Amber').length;
  const delayed = list.filter((p) => p.rag === 'Red').length;
  const stroke = overall >= 70 ? '#43A047' : overall >= 40 ? '#FB8C00' : '#E53935';

  const [overallDisplay, setOverallDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const durationMs = Math.max(1, (EMP_MOTION.counter.duration || 0.8) * 1000);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setOverallDisplay(Math.round(overall * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [overall]);

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/80 bg-white/95 p-3 shadow-lg shadow-slate-200/40 backdrop-blur-sm sm:p-6 lg:rounded-3xl"
      aria-labelledby="emp-progress-heading"
    >
      <div className="mb-3 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <h3 id="emp-progress-heading" className="text-xs font-semibold text-slate-800 sm:text-base">My progress overview</h3>
          <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">Completion from Task Tracker across your projects</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          {[
            { label: 'On track', count: onTrack, dot: 'bg-[#43A047]', bg: 'bg-green-50' },
            { label: 'At risk', count: atRisk, dot: 'bg-[#FB8C00]', bg: 'bg-orange-50' },
            { label: 'Delayed', count: delayed, dot: 'bg-[#E53935]', bg: 'bg-red-50' },
          ].map((item) => (
            <div key={item.label} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${item.bg} sm:gap-1.5 sm:rounded-xl sm:px-2.5 sm:py-1.5`}>
              <div className={`h-2 w-2 rounded-full ${item.dot}`} />
              <span className="text-[10px] font-semibold text-slate-700 sm:text-xs">
                {item.count} {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 lg:flex-row lg:gap-8">
        <div className="flex shrink-0 flex-col items-center">
          <div className="relative h-24 w-24 sm:h-32 sm:w-32">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 112 112" aria-hidden>
              <circle cx="56" cy="56" r="48" fill="none" stroke="#F1F5F9" strokeWidth="10" />
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke={stroke}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-[stroke-dashoffset] duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold tabular-nums sm:text-2xl" style={{ color: stroke }}>
                {overallDisplay}%
              </span>
              <span className="text-[10px] font-medium text-slate-500">Overall</span>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] font-semibold text-slate-800 sm:mt-3 sm:text-xs">Task completion</p>
          <p className="text-center text-[9px] text-slate-500 sm:text-[10px]">
            {completedSum} / {totalSum} tasks
          </p>
        </div>

        <div className="w-full flex-1 space-y-3 sm:space-y-4">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="space-y-2">
                  <div className="h-3 w-2/3 rounded bg-slate-100" />
                  <div className="h-2.5 w-full rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          ) : list.map((p) => (
            <div key={p.id}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: ragColor[p.rag] }} />
                  <span className="truncate text-sm font-medium text-[#2C3E50]">{p.name}</span>
                  <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${ragBg[p.rag]}`} style={{ color: ragColor[p.rag] }}>
                    {ragLabel[p.rag]}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-bold tabular-nums" style={{ color: ragColor[p.rag] }}>
                    {p.progress}%
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {p.completedTasks}/{p.totalTasks}
                  </span>
                </div>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100">
                <div
                  className="h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${p.progress}%`, background: ragColor[p.rag] }}
                />
              </div>
            </div>
          ))}
          {!isLoading && list.length > 0 ? (
            <div className="border-t border-slate-100 pt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#1E88E5]" />
                  <span className="text-sm font-semibold text-[#2C3E50]">Overall average</span>
                </div>
                <span className="text-xs font-bold tabular-nums text-[#1E88E5]">{overallDisplay}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100">
                <div className="h-2.5 rounded-full bg-[#1E88E5] transition-all duration-700" style={{ width: `${overall}%` }} />
              </div>
            </div>
          ) : !isLoading ? (
            <p className="text-center text-sm text-slate-500">No assigned projects with tasks yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}







const ragConfig = {
  Green: { text: '#43A047', bg: 'bg-green-50', label: 'On track', dot: '🟢' },
  Amber: { text: '#FB8C00', bg: 'bg-orange-50', label: 'At risk', dot: '🟡' },
  Red: { text: '#E53935', bg: 'bg-red-50', label: 'Delayed', dot: '🔴' },
};

const statusBadge = {
  Active: 'bg-blue-50 text-[#1E88E5]',
  Completed: 'bg-green-50 text-[#43A047]',
  'On Hold': 'bg-orange-50 text-[#FB8C00]',
  Planning: 'bg-purple-50 text-purple-600',
};

function formatDate(d) {
  if (!d) return '—';
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? String(d) : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(d, status) {
  if (!d || isProjectClosed(status)) return false;
  return new Date(d) < new Date();
}

const EMP_PROJECT_COLUMNS = [
  { key: 'name', label: 'Project Name', filter: 'name' },
  { key: 'owner', label: 'Owner', filter: 'owner' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
  { key: 'revised', label: 'Revised' },
  { key: 'progress', label: 'Progress' },
  { key: 'rag', label: 'RAG Status', filter: 'rag' },
  { key: 'status', label: 'Status', filter: 'status' },
];

function EmpProjectsTable({ projects, isLoading = false, onOpenProjectPopup, focusFilter = null, pulse = false }) {
  const reduceMotion = useReducedMotion();
  const [page, setPage] = useState(1);
  const [nameFilter, setNameFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [ragFilter, setRagFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    if (!focusFilter?.token) return;
    if (focusFilter.status != null) {
      setStatusFilter(focusFilter.status === 'delayed' ? 'delayed' : focusFilter.status);
      setRagFilter('all');
      setNameFilter('all');
      setOwnerFilter('all');
    }
  }, [focusFilter?.token, focusFilter?.status]);

  const list = Array.isArray(projects) ? projects : [];

  const nameOptions = useMemo(
    () => distinctFilterOptions(list, (p) => p.name, { allLabel: 'All Projects' }),
    [list],
  );
  const ownerOptions = useMemo(
    () => distinctFilterOptions(list, (p) => p.owner, { allLabel: 'All Owners' }),
    [list],
  );
  const ragOptions = useMemo(
    () => [
      { value: 'all', label: 'All RAG' },
      { value: 'Green', label: 'On Track' },
      { value: 'Amber', label: 'At Risk' },
      { value: 'Red', label: 'Delayed' },
    ],
    [],
  );
  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'All Status' },
      { value: '__active__', label: 'Active (not completed)' },
      { value: 'delayed', label: 'Delayed' },
      ...distinctFilterOptions(list, (p) => p.status, { allLabel: 'All Status' }).slice(1),
    ],
    [list],
  );

  const filtered = useMemo(() => {
    return list.filter((p) => {
      if (nameFilter !== 'all' && p.name !== nameFilter) return false;
      if (ownerFilter !== 'all' && p.owner !== ownerFilter) return false;
      if (ragFilter !== 'all' && p.rag !== ragFilter) return false;
      if (statusFilter === '__active__') {
        if (String(p.status || '').toLowerCase() === 'completed') return false;
      } else if (statusFilter === 'delayed' || statusFilter === 'Red') {
        if (!(p.rag === 'Red' || Number(p.delayDays) > 0)) return false;
      } else if (statusFilter !== 'all' && String(p.status || '').trim() !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [list, nameFilter, ownerFilter, ragFilter, statusFilter]);

  const sortedFiltered = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return compareText(a.name, b.name, dir);
        case 'owner':
          return compareText(a.owner, b.owner, dir);
        case 'startDate':
          return compareDateValue(a.startDate, b.startDate, dir, sortDir);
        case 'endDate':
          return compareDateValue(a.revisedEndDate ?? a.dueDate, b.revisedEndDate ?? b.dueDate, dir, sortDir);
        case 'revised':
          return compareNumber(a.revisedCount, b.revisedCount, dir);
        case 'progress':
          return compareNumber(a.progress, b.progress, dir);
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
  const totalPages = Math.max(1, Math.ceil(total / PT_TABLE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sortedFiltered.slice((safePage - 1) * PT_TABLE_PAGE_SIZE, safePage * PT_TABLE_PAGE_SIZE);

  const handleSort = (key) => {
    const next = toggleSortState(sortKey, sortDir, key);
    setSortKey(next.sortKey);
    setSortDir(next.sortDir);
  };

  const columnFilterProps = {
    name: { filterValue: nameFilter, onFilterChange: setNameFilter, filterOptions: nameOptions },
    owner: { filterValue: ownerFilter, onFilterChange: setOwnerFilter, filterOptions: ownerOptions },
    rag: { filterValue: ragFilter, onFilterChange: setRagFilter, filterOptions: ragOptions },
    status: { filterValue: statusFilter, onFilterChange: setStatusFilter, filterOptions: statusOptions },
  };

  useEffect(() => {
    setPage(1);
  }, [focusFilter?.token, nameFilter, ownerFilter, ragFilter, statusFilter, projects]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div
      className={`overflow-hidden rounded-xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl ${
        pulse ? 'ring-2 ring-[#1E88E5]/40 ring-offset-2' : ''
      }`}
      aria-labelledby="emp-projects-heading"
    >
      <div className="flex flex-col gap-2.5 border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/40 px-2.5 py-2.5 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E88E5]/10 text-[#1E88E5]">
            <i className="ri-folder-3-line text-lg" aria-hidden />
          </div>
          <div className="text-center lg:text-left">
            <h3 id="emp-projects-heading" className="text-xs font-semibold text-slate-800 sm:text-base">My projects</h3>
            <p className="text-[10px] text-slate-500 sm:text-xs">
              {sortedFiltered.length} shown · tap to open in Kissflow
              {totalPages > 1 ? ` · ${PT_TABLE_PAGE_SIZE} per page` : ''}
              {focusFilter?.label ? ` · ${focusFilter.label}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#1E88E5]">
            {sortedFiltered.filter((p) => p.status === 'Active').length} active
          </span>
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-[#E53935]">
            {sortedFiltered.filter((p) => p.rag === 'Red').length} delayed
          </span>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {EMP_PROJECT_COLUMNS.map((col) => {
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
                  />
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <i className="ri-loader-4-line animate-spin text-[#1E88E5]" aria-hidden />
                    Loading projects…
                  </span>
                </td>
              </tr>
            ) : sortedFiltered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-500">
                  No projects match this view.
                </td>
              </tr>
            ) : pageRows.map((p) => {
              const rag = ragConfig[p.rag] || ragConfig.Green;
              const endForOverdue = p.revisedEndDate || p.dueDate || p.originalEndDate;
              const overdue = isOverdue(endForOverdue, p.status);
              return (
                <motion.tr
                  key={p.id}
                  onClick={() => onOpenProjectPopup?.(p)}
                  className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-blue-50/50 focus-within:bg-blue-50/50"
                  style={{ height: 56 }}
                  whileTap={reduceMotion ? undefined : EMP_MOTION.rowTap}
                >
                  <td className="px-5 py-3">
                    <p className="text-sm font-semibold text-[#2C3E50]">{p.name}</p>
                    <p className="text-xs text-[#7F8C8D]">
                      {p.displayId ? `${p.displayId} · ` : ''}
                      {p.lineOfBusiness}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#1E88E5] text-xs font-bold text-white">
                        {p.ownerAvatar}
                      </div>
                      <span className="whitespace-nowrap text-sm text-[#2C3E50]">{p.owner}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="whitespace-nowrap text-sm text-[#2C3E50]">{formatDate(p.startDate)}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-sm ${overdue ? 'font-medium text-[#E53935]' : 'text-[#2C3E50]'}`}>
                      {formatDate(p.revisedEndDate ?? p.dueDate)}
                    </span>
                    {overdue ? <i className="ri-alarm-warning-line ml-1 text-xs text-[#E53935]" aria-hidden /> : null}
                  </td>
                  <td className="px-5 py-3">
                    {p.revisedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-[#FB8C00]">
                        <i className="ri-refresh-line text-xs" />
                        {p.revisedCount}x
                      </span>
                    ) : (
                      <span className="text-xs text-[#7F8C8D]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 max-w-full rounded-full bg-slate-100">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${p.progress}%`, background: rag.text }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: rag.text }}>
                        {p.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${rag.bg}`} style={{ color: rag.text }}>
                      <span>{rag.dot}</span>
                      {rag.label}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {p.status}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2.5 p-2.5 sm:p-3 lg:hidden">
        {isLoading ? (
          <div className="animate-pulse space-y-2.5">
            {[1, 2].map((n) => (
              <div key={n} className="h-28 rounded-xl border border-slate-200 bg-white sm:rounded-2xl" />
            ))}
          </div>
        ) : sortedFiltered.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">No projects match this view.</p>
        ) : pageRows.map((p) => {
          const rag = ragConfig[p.rag] || ragConfig.Green;
          const endForOverdue = p.revisedEndDate || p.dueDate || p.originalEndDate;
          const overdue = isOverdue(endForOverdue, p.status);
          return (
            <motion.button
              key={p.id}
              type="button"
              onClick={() => onOpenProjectPopup?.(p)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm ring-1 ring-slate-100 transition-shadow hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E88E5]/40 sm:rounded-2xl sm:p-4"
              whileHover={reduceMotion ? undefined : EMP_MOTION.hoverLift}
              whileTap={reduceMotion ? undefined : EMP_MOTION.tapPress}
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                  <p className="text-[10px] text-slate-500">{p.displayId || p.id}</p>
                </div>
                <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${rag.bg}`} style={{ color: rag.text }}>
                  {rag.label}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                <span>{p.owner}</span>
                <span className={overdue ? 'font-semibold text-[#E53935]' : ''}>{formatDate(p.revisedEndDate ?? p.dueDate)}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full" style={{ width: `${p.progress}%`, background: rag.text }} />
                </div>
                <span className="text-[11px] font-bold" style={{ color: rag.text }}>{p.progress}%</span>
              </div>
            </motion.button>
          );
        })}
      </div>
      <TablePaginationBar total={total} page={safePage} onPageChange={setPage} />
    </div>
  );
}

const statusConfig = {
  'Not Started': { bg: '#F8FAFC', color: '#64748B', label: 'Not Started' },
  'In Progress': { bg: '#EFF6FF', color: '#1E88E5', label: 'In Progress' },
  Completed: { bg: '#F0FDF4', color: '#43A047', label: 'Completed' },
  Overdue: { bg: '#FEF2F2', color: '#E53935', label: 'Overdue' },
  Pending: { bg: '#F8FAFC', color: '#64748B', label: 'Not Started' },
};

function formatTaskDate(d) {
  if (!d) return '—';
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? String(d) : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isEmptyProjectName(projectName) {
  const v = String(projectName ?? '').trim();
  return !v || v === '—' || v === '-' || v.toLowerCase() === 'n/a';
}

function EmpProjectCell({ projectName }) {
  if (isEmptyProjectName(projectName)) {
    return (
      <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200/80 sm:text-xs">
        Individual Task
      </span>
    );
  }
  return (
    <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#1E88E5]">
      {projectName}
    </span>
  );
}

const EMP_SUBTASK_COLUMNS = [
  { key: 'taskName', label: 'Task Name', filter: 'taskName' },
  { key: 'projectName', label: 'Project', filter: 'project' },
  { key: 'assignedTo', label: 'Assigned To', filter: 'assignedTo' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
  { key: 'agingDays', label: 'Aging' },
  { key: 'delayDays', label: 'Delay' },
  { key: 'status', label: 'Status', filter: 'status' },
];

function EmpSubtasksTable({
  assignedTasks = [],
  createdTasks = [],
  isLoading = false,
  onOpenTaskPopup,
  focusFilter = null,
  pulse = false,
}) {
  const reduceMotion = useReducedMotion();
  const [taskScope, setTaskScope] = useState('assigned');
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [taskNameFilter, setTaskNameFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [sortKey, setSortKey] = useState('taskName');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    if (!focusFilter?.status) return;
    setTaskScope(focusFilter.scope === 'created' ? 'created' : 'assigned');
    setFilter(focusFilter.status === 'all' ? 'All' : focusFilter.status);
  }, [focusFilter?.token, focusFilter?.status, focusFilter?.scope]);

  const assignedList = Array.isArray(assignedTasks) ? assignedTasks : [];
  const createdList = Array.isArray(createdTasks) ? createdTasks : [];
  const taskList = taskScope === 'created' ? createdList : assignedList;

  const taskNameOptions = useMemo(
    () => distinctFilterOptions(taskList, (t) => t.taskName, { allLabel: 'All Tasks' }),
    [taskList],
  );
  const projectOptions = useMemo(
    () =>
      distinctFilterOptions(taskList, (t) => t.projectName, {
        allLabel: 'All Projects',
        emptyValue: '__individual__',
        emptyLabel: 'Individual Task',
      }),
    [taskList],
  );
  const assigneeOptions = useMemo(
    () => distinctFilterOptions(taskList, (t) => t.assignedTo, { allLabel: 'All Assignees' }),
    [taskList],
  );
  const statusOptions = useMemo(
    () => [
      { value: 'All', label: 'All Status' },
      { value: 'Not Started', label: 'Not Started' },
      { value: 'In Progress', label: 'In Progress' },
      { value: 'Completed', label: 'Completed' },
      { value: 'Overdue', label: 'Overdue' },
      ...distinctFilterOptions(taskList, (t) => t.status, { allLabel: 'All Status' })
        .slice(1)
        .filter((o) => !['Not Started', 'In Progress', 'Completed', 'Overdue', 'Pending'].includes(o.value)),
    ],
    [taskList],
  );

  const filtered = useMemo(
    () =>
      taskList.filter((t) => {
        const status =
          filter === 'All'
            ? true
            : filter === 'Not Started'
              ? t.status === 'Not Started' || t.status === 'Pending'
              : filter === 'Overdue'
                ? t.status === 'Overdue' || t.isOverdue
                : t.status === filter;
        const matchSearch =
          String(t.taskName).toLowerCase().includes(search.toLowerCase()) ||
          String(t.projectName).toLowerCase().includes(search.toLowerCase());
        if (!status || !matchSearch) return false;
        if (taskNameFilter !== 'all' && t.taskName !== taskNameFilter) return false;
        if (projectFilter === '__individual__') {
          if (!isEmptyProjectName(t.projectName)) return false;
        } else if (projectFilter !== 'all' && t.projectName !== projectFilter) {
          return false;
        }
        if (assigneeFilter !== 'all' && t.assignedTo !== assigneeFilter) return false;
        return true;
      }),
    [taskList, filter, search, taskNameFilter, projectFilter, assigneeFilter],
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
          return compareDateValue(a.endDate || a.dueDate, b.endDate || b.dueDate, dir, sortDir);
        case 'agingDays':
          return compareNumber(a.agingDays, b.agingDays, dir);
        case 'delayDays':
          return compareNumber(a.delayDays, b.delayDays, dir);
        case 'status':
          return compareText(a.status, b.status, dir);
        default:
          return 0;
      }
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const total = sortedFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / PT_TABLE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sortedFiltered.slice((safePage - 1) * PT_TABLE_PAGE_SIZE, safePage * PT_TABLE_PAGE_SIZE);

  const handleSort = (key) => {
    const next = toggleSortState(sortKey, sortDir, key);
    setSortKey(next.sortKey);
    setSortDir(next.sortDir);
  };

  const columnFilterProps = {
    taskName: { filterValue: taskNameFilter, onFilterChange: setTaskNameFilter, filterOptions: taskNameOptions },
    project: { filterValue: projectFilter, onFilterChange: setProjectFilter, filterOptions: projectOptions },
    assignedTo: { filterValue: assigneeFilter, onFilterChange: setAssigneeFilter, filterOptions: assigneeOptions },
    status: {
      filterValue: filter,
      onFilterChange: setFilter,
      filterOptions: statusOptions,
    },
  };

  useEffect(() => {
    setPage(1);
  }, [filter, search, focusFilter?.token, taskScope, assignedTasks, createdTasks, taskNameFilter, projectFilter, assigneeFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const filterCounts = {
    All: taskList.length,
    'Not Started': taskList.filter((t) => t.status === 'Not Started' || t.status === 'Pending').length,
    'In Progress': taskList.filter((t) => t.status === 'In Progress').length,
    Completed: taskList.filter((t) => t.status === 'Completed').length,
    Overdue: taskList.filter((t) => t.status === 'Overdue' || t.isOverdue).length,
  };

  const filterTabs = ['All'];

  return (
    <div
      className={`overflow-hidden rounded-xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl ${
        pulse ? 'ring-2 ring-[#1E88E5]/40 ring-offset-2' : ''
      }`}
      aria-labelledby="emp-tasks-heading"
    >
      <div className="border-b border-slate-100 px-2.5 py-2.5 sm:px-5 sm:py-4">
        <div className="mb-2.5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#43A047]/10 text-[#43A047]">
              <i className="ri-checkbox-line text-lg" aria-hidden />
            </div>
            <div>
              <h3 id="emp-tasks-heading" className="text-xs font-semibold text-slate-800 sm:text-base">
                {taskScope === 'created' ? 'Tasks created by me' : 'Tasks assigned to me'}
              </h3>
              <p className="text-[10px] text-slate-500 sm:text-xs">
                {sortedFiltered.length} shown · tap to open in Kissflow
                {totalPages > 1 ? ` · ${PT_TABLE_PAGE_SIZE} per page` : ''}
                {focusFilter?.label ? ` · ${focusFilter.label}` : ''}
              </p>
            </div>
          </div>
          <div className="relative w-full sm:w-56">
            <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#7F8C8D]" aria-hidden />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-[11px] shadow-sm outline-none transition focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20 sm:rounded-2xl sm:py-2 sm:text-xs"
            />
            {search ? (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Clear">
                <i className="ri-close-line" />
              </button>
            ) : null}
          </div>
        </div>

        <div
          className="mb-2.5 grid w-full min-w-0 grid-cols-2 gap-1 rounded-xl border border-slate-300/70 bg-slate-50/80 p-1 sm:max-w-xl sm:rounded-2xl"
          role="tablist"
          aria-label="Task ownership"
        >
          {[
            { id: 'assigned', label: 'Tasks Assigned to me', count: assignedList.length },
            { id: 'created', label: 'Tasks Created by Me', count: createdList.length },
          ].map((tab) => {
            const active = taskScope === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTaskScope(tab.id)}
                className={`inline-flex min-h-[40px] min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-all sm:min-h-[36px] sm:px-3 ${
                  active
                    ? 'bg-white text-slate-800 shadow-md ring-1 ring-slate-300/80'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                }`}
              >
                <span className="min-w-0 truncate leading-tight sm:hidden">
                  {tab.id === 'assigned' ? 'Assigned to me' : 'Created by Me'}
                </span>
                <span className="hidden min-w-0 truncate leading-tight sm:inline">{tab.label}</span>
                <span
                  className={`inline-flex h-5 min-w-[1.375rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                    active ? 'bg-slate-100 text-slate-700' : 'border border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {filterTabs.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex min-h-[2rem] shrink-0 snap-start items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E88E5]/40 sm:text-xs ${
                filter === f ? 'bg-[#0f172a] text-white shadow-md' : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {f}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  filter === f ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {f === 'Not Started' ? filterCounts['Not Started'] : filterCounts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {EMP_SUBTASK_COLUMNS.map((col) => {
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
                  />
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <i className="ri-loader-4-line animate-spin text-[#43A047]" aria-hidden />
                    Loading tasks…
                  </span>
                </td>
              </tr>
            ) : sortedFiltered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-500">
                  {taskScope === 'created' ? 'No tasks created by you.' : 'No tasks assigned to you.'}
                </td>
              </tr>
            ) : pageRows.map((t) => {
              const st = statusConfig[t.status] || statusConfig['Not Started'];
              const isCompleted = t.status === 'Completed';
              return (
                <motion.tr
                  key={t.id}
                  onClick={() => onOpenTaskPopup?.(t)}
                  className={`cursor-pointer border-b border-slate-100 transition-colors ${t.status === 'Overdue' ? 'bg-red-50/40' : 'hover:bg-blue-50/50'}`}
                  style={{ height: 56 }}
                  whileTap={reduceMotion ? undefined : EMP_MOTION.rowTap}
                >
                  <td className="max-w-[220px] px-5 py-3">
                    <p className={`truncate text-sm font-medium text-[#2C3E50] ${isCompleted ? 'opacity-50 line-through' : ''}`}>{t.taskName}</p>
                  </td>
                  <td className="px-5 py-3">
                    <EmpProjectCell projectName={t.projectName} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#1E88E5]/10 text-xs font-bold text-[#1E88E5]">
                        {(t.assigneeAvatar || toInitials(t.assignedTo || 'U')).slice(0, 2)}
                      </div>
                      <span className="whitespace-nowrap text-sm text-[#2C3E50]">{t.assignedTo || '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-[#2C3E50]">{formatTaskDate(t.startDate)}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-sm ${t.isOverdue ? 'font-medium text-[#E53935]' : 'text-[#2C3E50]'}`}>{formatTaskDate(t.endDate || t.dueDate)}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="text-xs font-semibold"
                      style={{
                        color: t.agingDays > 20 ? '#E53935' : t.agingDays > 10 ? '#FB8C00' : '#94A3B8',
                      }}
                    >
                      {t.agingDays > 0 ? `${t.agingDays}d` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold ${Number(t.delayDays) > 0 ? 'text-[#E53935]' : 'text-slate-400'}`}>
                      {Number(t.delayDays) > 0 ? `+${t.delayDays}d` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: st.bg, color: st.color }}>
                      {t.status}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2.5 p-2.5 sm:p-3 lg:hidden">
        {isLoading ? (
          <div className="animate-pulse space-y-2.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : sortedFiltered.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">
            {taskScope === 'created' ? 'No tasks created by you.' : 'No tasks assigned to you.'}
          </p>
        ) : pageRows.map((t) => {
          const st = statusConfig[t.status] || statusConfig['Not Started'];
          return (
            <motion.button
              key={t.id}
              type="button"
              onClick={() => onOpenTaskPopup?.(t)}
              className={`w-full rounded-xl border p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E88E5]/40 sm:rounded-2xl sm:p-4 ${
                t.status === 'Overdue' ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white'
              }`}
              whileHover={reduceMotion ? undefined : EMP_MOTION.hoverLift}
              whileTap={reduceMotion ? undefined : EMP_MOTION.tapPress}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{t.taskName}</p>
                  <p className="mt-0.5 text-[10px] text-[#1E88E5]">
                    {isEmptyProjectName(t.projectName) ? (
                      <span className="inline-flex items-center rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200/80">
                        Individual Task
                      </span>
                    ) : (
                      t.projectName
                    )}
                  </p>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: st.bg, color: st.color }}>
                  {t.status}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                <span>{t.assignedTo || '—'}</span>
                <span className={t.isOverdue ? 'font-semibold text-[#E53935]' : ''}>{formatTaskDate(t.endDate || t.dueDate)}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
      <TablePaginationBar total={total} page={safePage} onPageChange={setPage} />
    </div>
  );
}


/** --- Employee page --- */

/** Same completion semantics as ProjectDashboardPage. */
function isTaskCompleted(status) {
  const s = String(status || '').trim().toLowerCase();
  return s === 'completed' || s === 'closed' || s === 'done' || s.includes('complete');
}

function isProjectClosed(status) {
  return isTaskCompleted(status);
}

/** Link Task Tracker rows to a project (id / display ref / name). */
function getTasksLinkedToProject(project, allTasks) {
  const rows = Array.isArray(allTasks) ? allTasks : [];
  const pid = String(project?.id ?? '').trim();
  const pref = String(project?.displayId ?? '').trim();
  const pname = String(project?.name ?? '').trim();
  if (!pid && !pref && !pname) return [];

  return rows.filter((t) => {
    const tPid = String(
      t?.projectId ??
        t?.raw?.Project_ID?._item_id ??
        t?.raw?.Project_Lookup?._item_id ??
        '',
    ).trim();
    const tPref = String(
      t?.projectRef ??
        t?.raw?.Project_ID?.Project_ID ??
        t?.raw?.Project_Lookup?.Project_ID ??
        t?.raw?.Project_ID_Details ??
        '',
    ).trim();
    const tName = String(t?.projectName ?? '').trim();
    return (tPid && pid && tPid === pid)
      || (pref && tPref && tPref === pref)
      || (pname && tName && tName === pname);
  });
}

/**
 * Progress mirrors ProjectDashboardPage:
 * closed/completed → 100%; no linked tasks → 0%; else completed/total from Task Tracker.
 * Does not overwrite API RAG.
 */
function computeProjectProgressFromTasks(project, allTasks) {
  const linked = getTasksLinkedToProject(project, allTasks);
  const totalTasks = linked.length;
  const completedTasks = linked.filter((t) => isTaskCompleted(t.status)).length;

  if (isProjectClosed(project?.status)) {
    return { progress: 100, totalTasks, completedTasks };
  }
  if (totalTasks === 0) {
    return { progress: 0, totalTasks: 0, completedTasks: 0 };
  }
  return {
    progress: Math.round((completedTasks / totalTasks) * 100),
    totalTasks,
    completedTasks,
  };
}

function applyTaskProgressToProject(row, allTasks) {
  const { progress, totalTasks, completedTasks } = computeProjectProgressFromTasks(row, allTasks);
  return {
    ...row,
    progress,
    totalTasks,
    completedTasks,
  };
}

function mapActivityLogs(activityHistory) {
  return (activityHistory || []).map((h) => ({
    id: h.key,
    type: 'update',
    action: `${h.eventType}: ${h.field}${h.newValue != null && h.newValue !== '' ? ` → ${h.newValue}` : ''}`,
    user: h.by,
    timestamp: h.date || '',
  }));
}

function toEmployeeProject(row, kfUser) {
  const isOwner = personMatches(kfUser, {
    id: row.ownerId,
    email: row.ownerEmail,
    name: row.owner,
  });
  const role = isOwner ? 'Owner' : 'Contributor';
  const raw = row?.raw ?? row ?? {};
  const { instanceId, activityId } = resolveEmpRowPopupIds({ ...row, raw });
  return {
    ...row,
    InstanceID: instanceId || String(row?.id || '').trim(),
    ActivityID: activityId,
    raw,
    dueDate: row.originalEndDate || '',
    role,
    description:
      row.risk && row.risk !== 'N/A'
        ? String(row.risk)
        : `Workspace for ${row.lineOfBusiness || 'your project'}.`,
    activityLogs: mapActivityLogs(row.activityHistory),
  };
}

function normalizeEmployeeTask(t) {
  const status = t.status === 'Pending' ? 'Not Started' : t.status;
  return {
    ...t,
    status,
    dueDate: t.endDate || '',
    isOverdue: status === 'Overdue' || (Number(t.delayDays) > 0 && !isTaskCompleted(status)),
    priority: t.priority || 'Medium',
    completionDate: t.completionDate ?? null,
  };
}

function useToasts() {
  const uid = useId();
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(
    (message, type = 'success') => {
      const id = `${uid}-${Date.now()}`;
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    [uid],
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

function EmployeeDashboardPage({ useLayout: useLayoutProp = true }) {
  const useChromeLayout = useLayoutProp;
  const reduceMotion = useReducedMotion();

  const { kf: kfFromContext } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null) ?? (typeof kf !== 'undefined' ? kf : null);

  const [userName, setUserName] = useState('User');
  const [roleName, setRoleName] = useState('Member');
  const [apiRows, setApiRows] = useState([]);
  const [apiAllSubtasks, setApiAllSubtasks] = useState([]);
  const [apiAssignedSubtasks, setApiAssignedSubtasks] = useState([]);
  const [apiCreatedSubtasks, setApiCreatedSubtasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [createdSubtasks, setCreatedSubtasks] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [insightFocus, setInsightFocus] = useState(null);
  const [createdYear, setCreatedYear] = useState('');
  const [createdPeriod, setCreatedPeriod] = useState('');
  const listMetaRef = useRef(null);
  const sectionRefs = useRef({});
  const headerRef = useRef(null);
  const insightPulseTimerRef = useRef(null);

  const { toasts, removeToast } = useToasts();

  useEffect(() => {
    if (!kfInstance?.user) return;
    const user = kfInstance.user;
    const resolvedName = String(user.Name || user.FirstName || 'User').trim();
    const resolvedRole = resolveRoleName(user.Role || user.Roles?.[0] || '');
    if (resolvedName) setUserName(resolvedName);
    if (resolvedRole) setRoleName(resolvedRole);
  }, [kfInstance]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function run() {
      if (cancelled) return;
      if (!kfInstance?.api || !kfInstance?.account?._id) {
        attempts += 1;
        if (attempts < 25) window.setTimeout(run, 250);
        return;
      }
      try {
        setLoadError(null);
        setIsLoadingTasks(true);
        setIsLoadingProjects(true);

        const tasksPromise = fetchEmployeeDashboardTasks(kfInstance, {
          email: kfInstance?.user?.Email || kfInstance?.user?.email,
        })
          .then((report) => {
            if (!cancelled) {
              setApiAssignedSubtasks(Array.isArray(report?.assigned) ? report.assigned : []);
              setApiCreatedSubtasks(Array.isArray(report?.created) ? report.created : []);
              setApiAllSubtasks(Array.isArray(report?.all) ? report.all : []);
              setIsLoadingTasks(false);
            }
            return report;
          })
          .catch((err) => {
            if (!cancelled) {
              setApiAssignedSubtasks([]);
              setApiCreatedSubtasks([]);
              setApiAllSubtasks([]);
              setIsLoadingTasks(false);
            }
            throw err;
          });

        const listPromise = fetchEmployeeDashboardProjects(kfInstance, {
          email: kfInstance?.user?.Email || kfInstance?.user?.email,
        })
          .then((summary) => {
            if (!cancelled) {
              listMetaRef.current = summary;
              setApiRows(summary.rows);
              setIsLoadingProjects(false);
            }
            return summary;
          })
          .catch((err) => {
            if (!cancelled) {
              setApiRows([]);
              setIsLoadingProjects(false);
            }
            throw err;
          });

        const [, summary] = await Promise.all([tasksPromise, listPromise]);
        if (cancelled) return;

        const relevantIds = (summary.rows || []).map((row) => row.id).filter(Boolean);
        if (relevantIds.length === 0) return;

        const enriched = await enrichProjectRows(kfInstance, {
          listItems: summary.listItems,
          itemIds: relevantIds,
          fieldIds: summary.fieldIds,
          accountId: summary.accountId,
          concurrency: 2,
        });
        if (cancelled || enriched.length === 0) return;

        const byId = Object.fromEntries(enriched.map((row) => [row.id, row]));
        setApiRows((prev) => prev.map((row) => byId[row.id] || row));
      } catch (e) {
        if (!cancelled) {
          console.warn('Employee dashboard fetch failed:', e?.message || e);
          setLoadError(e?.message || 'Failed to load');
          setApiRows([]);
          setApiAllSubtasks([]);
          setApiAssignedSubtasks([]);
          setApiCreatedSubtasks([]);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [kfInstance]);

  useEffect(() => {
    const kfUser = kfInstance?.user || {};
    const assigned = (Array.isArray(apiAssignedSubtasks) ? apiAssignedSubtasks : []).map(normalizeEmployeeTask);
    const created = (Array.isArray(apiCreatedSubtasks) ? apiCreatedSubtasks : []).map(normalizeEmployeeTask);
    const allTasksNormalized = (Array.isArray(apiAllSubtasks) ? apiAllSubtasks : []).map(normalizeEmployeeTask);
    const linked = [...assigned, ...created];
    const prows = apiRows.map((r) => {
      const base = toEmployeeProject(r, kfUser);
      return applyTaskProgressToProject(base, allTasksNormalized.length ? allTasksNormalized : linked);
    });

    setSubtasks(assigned);
    setCreatedSubtasks(created);
    setProjects(prows);
  }, [apiRows, apiAllSubtasks, apiAssignedSubtasks, apiCreatedSubtasks, kfInstance]);

  const createdYearOptions = useMemo(
    () => buildCreatedYearOptions([...projects, ...subtasks, ...createdSubtasks]),
    [projects, subtasks, createdSubtasks],
  );

  const createdRange = useMemo(
    () => resolveCreatedDateRange(createdYear, createdPeriod),
    [createdYear, createdPeriod],
  );

  const filteredProjects = useMemo(
    () => projects.filter((p) => matchesCreatedDateRange(p, createdRange)),
    [projects, createdRange],
  );

  const filteredSubtasks = useMemo(
    () => subtasks.filter((t) => matchesCreatedDateRange(t, createdRange)),
    [subtasks, createdRange],
  );

  const filteredCreatedSubtasks = useMemo(
    () => createdSubtasks.filter((t) => matchesCreatedDateRange(t, createdRange)),
    [createdSubtasks, createdRange],
  );

  const handleCreatedYearChange = useCallback((value) => {
    setCreatedYear(value);
    setCreatedPeriod('');
  }, []);

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

  const handleKpiClick = useCallback(
    (key) => {
      const focus = EMP_KPI_FOCUS[key];
      if (!focus) return;
      const token = Date.now();
      setInsightFocus({
        key,
        token,
        pulse: true,
        section: focus.section,
        label: focus.label,
        projectStatus: focus.projectFilter,
        taskStatus: focus.taskFilter,
      });
      scrollToSection(focus.section);
      if (insightPulseTimerRef.current) clearTimeout(insightPulseTimerRef.current);
      insightPulseTimerRef.current = setTimeout(() => {
        setInsightFocus((prev) => (prev?.token === token ? { ...prev, pulse: false } : prev));
      }, 2400);
    },
    [scrollToSection],
  );

  useEffect(() => () => {
    if (insightPulseTimerRef.current) clearTimeout(insightPulseTimerRef.current);
  }, []);

  const handleTaskOpenPopup = useCallback(
    (row) => {
      const { instanceId, activityId } = resolveEmpRowPopupIds(row);
      return openEmpKissflowPopup(kfInstance, EMP_POPUP_IDS.task, instanceId, activityId, {
        requireActivity: true,
      });
    },
    [kfInstance],
  );

  const handleProjectOpenPopup = useCallback(
    (row) => {
      const caseId = resolveEmpProjectCaseId(row);
      return openEmpProjectPopup(kfInstance, caseId);
    },
    [kfInstance],
  );

  const completedCount = filteredSubtasks.filter((t) => t.status === 'Completed').length;
  const overdueCount = filteredSubtasks.filter((t) => t.status === 'Overdue' || t.isOverdue).length;
  const completionRate = filteredSubtasks.length > 0 ? Math.round((completedCount / filteredSubtasks.length) * 100) : 0;

  const kpiData = {
    totalProjects: filteredProjects.length,
    totalSubtasks: filteredSubtasks.length,
    completedTasks: completedCount,
    completionRate,
    overdueTasks: overdueCount,
  };

  const profile = {
    name: userName,
    role: roleName,
    email: String(kfInstance?.user?.Email || kfInstance?.user?.email || '').trim() || '—',
    avatar: toInitials(userName),
  };

  const projectFocusFilter =
    insightFocus?.section === 'projects'
      ? { token: insightFocus.token, status: insightFocus.projectStatus || 'all', label: insightFocus.label }
      : null;
  const taskFocusFilter =
    insightFocus?.section === 'tasks'
      ? { token: insightFocus.token, status: insightFocus.taskStatus || 'All', label: insightFocus.label }
      : null;

  const content = (
    <div className="min-h-screen scroll-smooth bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff] p-1.5 pb-4 sm:p-4 lg:p-6">
      <motion.div
        ref={headerRef}
        className="-mx-1.5 -mt-1.5 mb-2.5 sm:-mx-4 sm:-mt-4 sm:mb-5 lg:-mx-6 lg:-mt-6 lg:mb-6"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
      >
        <EmpHeader
          profile={profile}
          createdYear={createdYear}
          createdPeriod={createdPeriod}
          createdYearOptions={createdYearOptions}
          onCreatedYearChange={handleCreatedYearChange}
          onCreatedPeriodChange={setCreatedPeriod}
        />
      </motion.div>

      <div className="mx-auto max-w-[1800px] space-y-2.5 sm:space-y-4 lg:space-y-6">
        {loadError ? <p className="text-center text-[11px] text-amber-800 lg:text-left">Could not refresh data: {loadError}</p> : null}

        <motion.section
          aria-label="Key metrics"
          initial={reduceMotion ? false : EMP_MOTION.sectionEnter.initial}
          animate={EMP_MOTION.sectionEnter.animate}
          transition={EMP_MOTION.sectionEnter.transition}
        >
          <div className="relative mb-1.5 flex w-full items-center px-0.5 sm:mb-3">
            <h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">Insights</h2>
            <div className="ml-auto flex shrink-0 items-center">
              <SatelliteOrbitMenu
                kfInstance={kfInstance}
                placement="inline"
                popupIds={{
                  ...EMP_POPUP_IDS,
                  changeRequest: 'Popup_17BDRRnIED',
                }}
              />
            </div>
          </div>
          <EmpKPICards
            data={kpiData}
            isLoadingTasks={isLoadingTasks}
            isLoadingProjects={isLoadingProjects}
            onKpiClick={handleKpiClick}
            activeKey={insightFocus?.key}
          />
        </motion.section>

        <motion.section
          aria-label="Progress overview"
          initial={reduceMotion ? false : EMP_MOTION.sectionEnter.initial}
          animate={EMP_MOTION.sectionEnter.animate}
          transition={{ ...EMP_MOTION.sectionEnter.transition, delay: reduceMotion ? 0 : 0.04 }}
        >
          <EmpProgressChart projects={filteredProjects} isLoading={isLoadingProjects} />
        </motion.section>

        <motion.section
          ref={(el) => { sectionRefs.current.projects = el; }}
          aria-label="Projects"
          initial={reduceMotion ? false : EMP_MOTION.sectionEnter.initial}
          animate={EMP_MOTION.sectionEnter.animate}
          transition={{ ...EMP_MOTION.sectionEnter.transition, delay: reduceMotion ? 0 : 0.08 }}
        >
          <EmpProjectsTable
            projects={filteredProjects}
            isLoading={isLoadingProjects}
            onOpenProjectPopup={handleProjectOpenPopup}
            focusFilter={projectFocusFilter}
            pulse={insightFocus?.section === 'projects' && insightFocus?.pulse}
          />
        </motion.section>

        <motion.section
          ref={(el) => { sectionRefs.current.tasks = el; }}
          aria-label="Tasks"
          initial={reduceMotion ? false : EMP_MOTION.sectionEnter.initial}
          animate={EMP_MOTION.sectionEnter.animate}
          transition={{ ...EMP_MOTION.sectionEnter.transition, delay: reduceMotion ? 0 : 0.12 }}
        >
          <EmpSubtasksTable
            assignedTasks={filteredSubtasks}
            createdTasks={filteredCreatedSubtasks}
            isLoading={isLoadingTasks}
            onOpenTaskPopup={handleTaskOpenPopup}
            focusFilter={taskFocusFilter}
            pulse={insightFocus?.section === 'tasks' && insightFocus?.pulse}
          />
        </motion.section>
      </div>

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );

  if (!useChromeLayout) return content;
  return <AppLayout>{content}</AppLayout>;
}




export default function EmployeeDashboardProject({ useLayout = false }) {
  return <EmployeeDashboardPage useLayout={useLayout} />;
}
