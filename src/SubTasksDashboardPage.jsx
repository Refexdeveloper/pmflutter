/* eslint-disable max-lines -- Subtask-focused Kissflow dashboard */
import { useState, useCallback, useContext, useEffect, useRef, useMemo, Fragment } from 'react';
import { motion } from 'framer-motion';
import AppLayout from './components/feature/AppLayout.jsx';
import PtSelect from './components/PtSelect.jsx';
import {
  TableColumnHeader,
  distinctFilterOptions,
  toggleSortState,
  compareText,
  compareNumber,
  compareDateValue,
} from './components/TableColumnHeaders.jsx';
import { KissflowSDKContext, kf } from './sdk/index.js';
import {
  fetchSubtaskProcessData,
  computeSubtaskKpiMetrics,
  isSubtaskCompleted,
  toInitials,
} from './lib/kfSubtaskTracker.js';

const SUBTASK_DETAIL_POPUP_ID = 'Popup_rMdM7XTNc-';
const PAGE_SIZE = 10;
const AGING_DAYS_THRESHOLD = 21;

/** KPI → health table focus map */
const KPI_FOCUS = {
  'total-subtasks': { section: 'health', taskStatus: 'all' },
  'open-subtasks': { section: 'health', taskStatus: '__open__' },
  'completed-subtasks': { section: 'health', taskStatus: 'Completed' },
  'aging-subtasks': { section: 'health', taskStatus: '__aging__' },
};

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

const KPI_THEME = {
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
      className={`group relative w-full overflow-hidden rounded-xl border bg-gradient-to-br p-3.5 text-left sm:rounded-2xl sm:p-5 ${theme.cardBg} ${theme.cardShadow} transition-[box-shadow,border-color,ring] duration-300 ease-out hover:shadow-[0_20px_48px_-16px_rgba(15,23,42,0.22)] hover:shadow-slate-400/20 hover:ring-2 ring-transparent ${theme.hoverRing} ${theme.hoverBorder} ${active ? 'border-[#1E88E5] ring-2 ring-[#1E88E5]/35' : 'border-slate-200/88 cursor-pointer'}`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/0 via-transparent to-slate-100/35 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" style={{ background: theme.glow }} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-[11px]">{title}</p>
          <p className={`mt-1.5 text-3xl font-bold tabular-nums sm:text-4xl ${theme.valueClass}`}>{value}</p>
          {subtitle ? <p className="mt-1.5 text-[11px] text-slate-400 sm:text-xs">{subtitle}</p> : null}
          {trend ? (
            <p className={`mt-2 text-[11px] font-semibold sm:text-xs ${trend.positive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{trend.value}</p>
          ) : null}
          <p className="mt-2 text-[10px] font-semibold text-[#1E88E5] opacity-0 transition-opacity group-hover:opacity-100">
            Click to view →
          </p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-12 sm:w-12 sm:rounded-xl ${theme.iconBg} ${theme.iconShadow} ${theme.iconRing}`}>
          <i className={`${icon} text-lg text-white/90 sm:text-xl`} />
        </div>
      </div>
    </motion.button>
  );
}

function SubtaskKPISection({ metrics, onKpiClick, activeKey = null }) {
  const m = metrics ?? computeSubtaskKpiMetrics([]);
  const cards = [
    { key: 'total-subtasks', title: 'Total Subtasks', value: m.totalSubtasks, subtitle: 'Across all linked tasks', icon: 'ri-node-tree', theme: KPI_THEME.total, trend: { value: `${m.totalSubtasks} tracked`, positive: true } },
    { key: 'open-subtasks', title: 'Open Subtasks', value: m.openSubtasks, subtitle: `${m.openPct}% of total subtasks`, icon: 'ri-folder-open-line', theme: KPI_THEME.open, trend: { value: `${m.openSubtasks} pending`, positive: false } },
    { key: 'completed-subtasks', title: 'Completed Subtasks', value: m.completedSubtasks, subtitle: `${m.completedPct}% completion rate`, icon: 'ri-check-double-line', theme: KPI_THEME.tasksDone, trend: { value: `${m.completedSubtasks} closed`, positive: true } },
    { key: 'aging-subtasks', title: 'Aging Subtasks', value: m.staleSubtasks, subtitle: `Open longer than ${AGING_DAYS_THRESHOLD} days`, icon: 'ri-alarm-warning-line', theme: KPI_THEME.overdue, trend: { value: `${m.stalePct}% of portfolio`, positive: false } },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

function AnimatedBar({ widthPct, color, trackClass, delay = 0 }) {
  const x = Math.min(100, Math.max(0, widthPct)) / 100;
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full ${trackClass}`}>
      <motion.div className="h-full origin-left rounded-full" style={{ backgroundColor: color }} initial={{ scaleX: 0 }} animate={{ scaleX: x }} transition={{ type: 'spring', stiffness: 120, damping: 18, delay }} />
    </div>
  );
}

function SubtaskHealthSummaryBar({ data }) {
  const total = Math.max(data.length, 1);
  const green = data.filter((s) => s.rag === 'Green').length;
  const amber = data.filter((s) => s.rag === 'Amber').length;
  const red = data.filter((s) => s.rag === 'Red').length;
  const pct = (n) => Math.round((n / total) * 100);
  const parentTasks = new Set(data.map((s) => s.parentTaskId).filter((id) => id && id !== '—')).size;
  const avgAging = Math.round(data.reduce((acc, s) => acc + (s.agingDays ?? 0), 0) / total);
  const unassigned = data.filter((s) => !s.assignedTo || s.assignedTo === '—').length;

  const ragItems = [
    { key: 'on-track', label: 'On Track', value: green, icon: '🟢', pct: pct(green), footnote: '% of subtasks', valueColor: 'text-[#22C55E]', iconWrap: 'bg-emerald-500/15 ring-1 ring-emerald-500/25', barColor: '#22C55E', barTrack: 'bg-emerald-100/80', cardBg: 'from-emerald-50/95 via-white to-green-50/80', ringHover: 'group-hover:ring-emerald-400/25', borderHover: 'hover:border-emerald-300/60', shadow: 'shadow-emerald-900/5' },
    { key: 'at-risk', label: 'At Risk', value: amber, icon: '🟡', pct: pct(amber), footnote: '% of subtasks', valueColor: 'text-[#F59E0B]', iconWrap: 'bg-amber-500/15 ring-1 ring-amber-500/30', barColor: '#F59E0B', barTrack: 'bg-amber-100/80', cardBg: 'from-amber-50/95 via-white to-yellow-50/70', ringHover: 'group-hover:ring-amber-400/25', borderHover: 'hover:border-amber-300/60', shadow: 'shadow-amber-900/5' },
    { key: 'delayed', label: 'Delayed', value: red, icon: '🔴', pct: pct(red), footnote: '% of subtasks', valueColor: 'text-[#EF4444]', iconWrap: 'bg-red-500/15 ring-1 ring-red-500/30', barColor: '#EF4444', barTrack: 'bg-red-100/80', cardBg: 'from-rose-50/95 via-white to-red-50/75', ringHover: 'group-hover:ring-red-400/25', borderHover: 'hover:border-red-300/55', shadow: 'shadow-red-900/5' },
  ];

  const metrics = [
    { key: 'avg-aging', label: 'Avg Aging', display: `${avgAging}d`, footnote: 'Subtask portfolio average', barPct: Math.min(100, avgAging), iconClass: 'ri-time-line', valueColor: 'text-[#2B5AED]', iconBg: 'bg-[#2B5AED]/12 text-[#2B5AED]', barColor: '#2B5AED', barTrack: 'bg-blue-100/90', cardBg: 'from-sky-50/90 via-white to-indigo-50/70', ringHover: 'group-hover:ring-blue-400/25', borderHover: 'hover:border-blue-300/55', shadow: 'shadow-blue-900/5', delay: 0.15 },
    { key: 'parents', label: 'Parent Tasks', display: String(parentTasks), footnote: `Linked across ${data.length} subtasks`, barPct: Math.min(100, (parentTasks / Math.max(data.length, 1)) * 100), iconClass: 'ri-link', valueColor: 'text-[#EA580C]', iconBg: 'bg-orange-500/12 text-[#EA580C]', barColor: '#F97316', barTrack: 'bg-orange-100/90', cardBg: 'from-orange-50/90 via-white to-amber-50/75', ringHover: 'group-hover:ring-orange-400/25', borderHover: 'hover:border-orange-300/55', shadow: 'shadow-orange-900/5', delay: 0.2 },
    { key: 'unassigned', label: 'Unassigned', display: String(unassigned), footnote: `${Math.round((unassigned / total) * 100)}% of portfolio`, barPct: Math.round((unassigned / total) * 100), iconClass: 'ri-user-unfollow-line', valueColor: 'text-[#E11D48]', iconBg: 'bg-rose-500/12 text-rose-600', barColor: '#E11D48', barTrack: 'bg-rose-100/90', cardBg: 'from-rose-50/92 via-white to-fuchsia-50/65', ringHover: 'group-hover:ring-rose-400/25', borderHover: 'hover:border-rose-300/55', shadow: 'shadow-rose-900/5', delay: 0.25 },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {ragItems.map((item, index) => (
        <motion.div key={item.key} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className={`group overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br p-3.5 sm:rounded-2xl sm:p-5 ${item.cardBg} shadow-md ${item.shadow} hover:ring-2 ring-transparent ${item.ringHover} ${item.borderHover}`}>
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.label}</span>
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm ${item.iconWrap}`}>{item.icon}</span>
            </div>
            <p className={`text-2xl font-bold sm:text-3xl ${item.valueColor}`}>{item.value}</p>
            <AnimatedBar widthPct={item.pct} color={item.barColor} trackClass={item.barTrack} delay={0.08 + index * 0.05} />
            <p className="text-[11px] text-slate-500">{item.pct}{item.footnote}</p>
          </div>
        </motion.div>
      ))}
      {metrics.map((m) => (
        <motion.div key={m.key} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: m.delay }} className={`group overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br p-3.5 sm:rounded-2xl sm:p-5 ${m.cardBg} shadow-md ${m.shadow} hover:ring-2 ring-transparent ${m.ringHover} ${m.borderHover}`}>
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{m.label}</span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${m.iconBg}`}><i className={m.iconClass} /></div>
            </div>
            <p className={`text-2xl font-bold sm:text-3xl ${m.valueColor}`}>{m.display}</p>
            <AnimatedBar widthPct={m.barPct} color={m.barColor} trackClass={m.barTrack} delay={m.delay} />
            <p className="text-[11px] text-slate-500">{m.footnote}</p>
          </div>
        </motion.div>
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
  const s = String(status || '').toLowerCase();
  const cfg =
    s.includes('complete') || s.includes('done')
      ? { bg: 'bg-green-50', text: 'text-[#43A047]' }
      : s.includes('progress') || s.includes('open')
        ? { bg: 'bg-blue-50', text: 'text-[#1E88E5]' }
        : { bg: 'bg-slate-100', text: 'text-slate-600' };
  return <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>{status || '—'}</span>;
}

function compactPageIndices(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current, current - 1, current + 1, current - 2, current + 2]);
  return [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
}

const COLUMN_META = [
  { key: 'subtaskName', label: 'Summary', filter: 'subtaskName' },
  { key: 'parentTaskName', label: 'Parent Task', filter: 'parent' },
  { key: 'parentTaskId', label: 'Task ID' },
  { key: 'assignedTo', label: 'Assigned To', filter: 'assignedTo' },
  { key: 'createdDate', label: 'Created' },
  { key: 'agingDays', label: 'Aging' },
  { key: 'rag', label: 'RAG Status', filter: 'rag' },
  { key: 'status', label: 'Status', filter: 'status' },
];

function SubtaskDrillDownPanel({ row }) {
  const items = [
    { label: 'Summary', value: row.summary && row.summary !== '—' ? row.summary : row.subtaskName, icon: 'ri-file-text-line' },
    { label: 'Assignee', value: row.assignedTo, icon: 'ri-user-star-line' },
    { label: 'Created by', value: row.createdBy, icon: 'ri-user-line' },
    { label: 'Status', value: row.status, icon: 'ri-flag-line' },
  ];

  return (
    <div className="bg-white p-4 sm:p-6">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#1E88E5]">Subtask Details</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <i className={`${item.icon} text-sm text-[#7F8C8D]`} />
              <span className="text-xs text-[#7F8C8D]">{item.label}</span>
            </div>
            <p className="break-words text-sm font-medium text-[#2C3E50]">{item.value || '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubtasksHealthTable({ data, onOpenSubtaskPopup, onRefresh, refreshing, insightFilter = null }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ragFilter, setRagFilter] = useState('all');
  const [parentFilter, setParentFilter] = useState('all');
  const [nameFilter, setNameFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [sortKey, setSortKey] = useState('subtaskName');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!insightFilter?.token) return;
    if (insightFilter.status != null) {
      setStatusFilter(insightFilter.status);
      setRagFilter('all');
      setParentFilter('all');
      setNameFilter('all');
      setAssigneeFilter('all');
      setSearch('');
    }
  }, [insightFilter?.token, insightFilter?.status]);

  const nameOptions = useMemo(
    () => distinctFilterOptions(data, (d) => d.subtaskName, { allLabel: 'All Subtasks' }),
    [data],
  );
  const parentOptions = useMemo(
    () => distinctFilterOptions(data, (d) => d.parentTaskName, { allLabel: 'All Parent Tasks' }),
    [data],
  );
  const assigneeOptions = useMemo(
    () => distinctFilterOptions(data, (d) => d.assignedTo, { allLabel: 'All Assignees' }),
    [data],
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
      { value: '__open__', label: 'Open (not completed)' },
      { value: '__aging__', label: `Aging (>${AGING_DAYS_THRESHOLD}d)` },
      ...distinctFilterOptions(data, (d) => d.status, { allLabel: 'All Status' }).slice(1),
    ],
    [data],
  );

  const filtered = useMemo(
    () =>
      data.filter((row) => {
        if (nameFilter !== 'all' && row.subtaskName !== nameFilter) return false;
        if (assigneeFilter !== 'all' && row.assignedTo !== assigneeFilter) return false;
        if (ragFilter !== 'all' && row.rag !== ragFilter) return false;
        if (statusFilter === '__open__') {
          if (isSubtaskCompleted(row.status)) return false;
        } else if (statusFilter === '__aging__') {
          if (isSubtaskCompleted(row.status) || (row.agingDays ?? 0) <= AGING_DAYS_THRESHOLD) return false;
        } else if (statusFilter !== 'all' && row.status !== statusFilter) {
          return false;
        }
        if (parentFilter !== 'all' && row.parentTaskName !== parentFilter) return false;
        if (
          search &&
          !row.subtaskName.toLowerCase().includes(search.toLowerCase()) &&
          !row.summary.toLowerCase().includes(search.toLowerCase()) &&
          !row.parentTaskId.toLowerCase().includes(search.toLowerCase()) &&
          !row.assignedTo.toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [data, nameFilter, assigneeFilter, ragFilter, statusFilter, parentFilter, search],
  );

  const sortedFiltered = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'subtaskName':
          return compareText(a.subtaskName, b.subtaskName, dir);
        case 'parentTaskName':
          return compareText(a.parentTaskName, b.parentTaskName, dir);
        case 'parentTaskId':
          return compareText(a.parentTaskId, b.parentTaskId, dir);
        case 'assignedTo':
          return compareText(a.assignedTo, b.assignedTo, dir);
        case 'createdDate':
          return compareDateValue(a.createdDate, b.createdDate, dir, sortDir);
        case 'agingDays':
          return compareNumber(a.agingDays, b.agingDays, dir);
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
    subtaskName: { filterValue: nameFilter, onFilterChange: setNameFilter, filterOptions: nameOptions },
    parent: { filterValue: parentFilter, onFilterChange: setParentFilter, filterOptions: parentOptions },
    assignedTo: { filterValue: assigneeFilter, onFilterChange: setAssigneeFilter, filterOptions: assigneeOptions },
    rag: { filterValue: ragFilter, onFilterChange: setRagFilter, filterOptions: ragOptions },
    status: { filterValue: statusFilter, onFilterChange: setStatusFilter, filterOptions: statusOptions },
  };

  useEffect(() => setPage(1), [search, statusFilter, ragFilter, parentFilter, nameFilter, assigneeFilter]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Subtasks Health Overview</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">{total} of {data.length} subtasks · {PAGE_SIZE} per page</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto">
          <div className="relative w-full sm:w-48">
            <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#7F8C8D]" />
            <input type="text" placeholder="Search subtask..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-[11px] outline-none focus:border-indigo-500 sm:text-xs" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PtSelect
              value={ragFilter}
              onChange={(e) => setRagFilter(e.target.value)}
              className="min-w-[7.5rem]"
              aria-label="Filter by RAG"
              options={ragOptions}
            />
            <PtSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-[7.5rem]"
              aria-label="Filter by status"
              options={statusOptions}
            />
            <PtSelect
              value={parentFilter}
              onChange={(e) => setParentFilter(e.target.value)}
              className="min-w-[8rem] max-w-[180px]"
              aria-label="Filter by parent task"
              options={parentOptions}
            />
            {typeof onRefresh === 'function' ? (
              <button type="button" disabled={refreshing} onClick={() => onRefresh()} className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-[#2C3E50] disabled:opacity-60 sm:text-xs">
                <i className={`ri-refresh-line ${refreshing ? 'animate-spin' : ''}`} />
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
              <th className="w-8 px-3 py-2.5" />
              {COLUMN_META.map((col) => {
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
              <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-[#7F8C8D]">No subtasks found</td></tr>
            ) : (
              pageRows.map((row) => {
                const open = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => onOpenSubtaskPopup?.(row)}>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setExpandedId(open ? null : row.id)} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-[#1E88E5]">
                          <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-lg`} />
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="max-w-[200px] truncate text-sm font-medium text-[#2C3E50]">{row.subtaskName}</p>
                        <p className="truncate text-xs text-[#7F8C8D]">
                          Assignee {row.assignedTo || '—'}
                          <span className="text-slate-300"> · </span>
                          Created by {row.createdBy || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-2.5"><p className="max-w-[140px] truncate text-xs font-medium text-[#1E88E5]">{row.parentTaskName}</p></td>
                      <td className="px-4 py-2.5"><p className="truncate text-xs text-[#7F8C8D]">{row.parentTaskId}</p></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1E88E5]/10 text-xs font-bold text-[#1E88E5]">{row.assigneeAvatar}</div>
                          <span className="text-sm text-[#2C3E50]">{row.assignedTo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-[#2C3E50]">{row.createdDate}</td>
                      <td className="px-4 py-2.5 text-sm text-[#7F8C8D]">{row.agingDays}d</td>
                      <td className="px-4 py-2.5"><RAGCell rag={row.rag} /></td>
                      <td className="px-4 py-2.5"><StatusBadge status={row.status} /></td>
                    </tr>
                    {open ? (
                      <tr className="bg-slate-50/95">
                        <td colSpan={9} className="border-b border-slate-200 p-0">
                          <SubtaskDrillDownPanel row={row} />
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
              <button type="button" onClick={() => onOpenSubtaskPopup?.(row)} className="w-full p-3 text-left">
                <p className="text-sm font-semibold text-slate-800">{row.subtaskName}</p>
                <p className="text-[11px] text-[#7F8C8D]">
                  Assignee {row.assignedTo || '—'}
                  <span className="text-slate-300"> · </span>
                  Created by {row.createdBy || '—'}
                </p>
                <p className="mt-0.5 text-[11px] text-[#1E88E5]">{row.parentTaskName}</p>
                <div className="mt-2 flex justify-between"><StatusBadge status={row.status} /><RAGCell rag={row.rag} /></div>
              </button>
              <button type="button" onClick={() => setExpandedId(open ? null : row.id)} className="w-full border-t border-slate-100 px-3 py-2 text-left text-xs font-medium text-[#1E88E5]">
                {open ? 'Hide details' : 'Show details'}
              </button>
              {open ? <SubtaskDrillDownPanel row={row} /> : null}
            </div>
          );
        })}
      </div>

      {total > 0 ? (
        <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-3 sm:flex-row sm:px-5">
          <p className="text-xs text-slate-500">Showing {pageStart}–{pageEnd} of {total}</p>
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

function SubTasksDashboardPremium({ useLayout = true }) {
  const { kf: kfFromContext } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null) ?? (typeof kf !== 'undefined' ? kf : null);
  const [userName, setUserName] = useState('User');
  const [roleName, setRoleName] = useState('Admin');
  const [apiSubtaskData, setApiSubtaskData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [insightFocus, setInsightFocus] = useState(null);
  const sectionRefs = useRef({});
  const headerRef = useRef(null);
  const insightPulseTimerRef = useRef(null);

  const reloadData = useCallback(async () => {
    if (!kfInstance?.api || !kfInstance?.account?._id) return;
    try {
      const rows = await fetchSubtaskProcessData(kfInstance);
      setApiSubtaskData(rows);
    } catch (error) {
      console.warn('[SubTasksDashboard] Fetch failed:', error);
      setApiSubtaskData([]);
    }
  }, [kfInstance]);

  useEffect(() => {
    if (!kfInstance) return undefined;
    let cancelled = false;
    let attempts = 0;
    async function run() {
      if (cancelled) return;
      if (!kfInstance?.api || !kfInstance?.account?._id) {
        attempts += 1;
        if (attempts < 25) window.setTimeout(run, 250);
        return;
      }
      await reloadData();
    }
    run();
    return () => { cancelled = true; };
  }, [kfInstance, reloadData]);

  useEffect(() => {
    if (!kfInstance?.user) return;
    const user = kfInstance.user;
    setUserName(String(user.Name || user.FirstName || 'User').trim());
    setRoleName(resolveRoleName(user.Role || user.Roles?.[0] || 'Admin'));
  }, [kfInstance]);

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
      const focus = KPI_FOCUS[key];
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

  useEffect(() => () => {
    if (insightPulseTimerRef.current) clearTimeout(insightPulseTimerRef.current);
  }, []);

  const kpiMetrics = useMemo(() => computeSubtaskKpiMetrics(apiSubtaskData), [apiSubtaskData]);

  const handleSubtaskOpenPopup = useCallback(
    (row) => {
      const sdk = kfInstance ?? kf;
      if (typeof sdk?.app?.page?.openPopup !== 'function') return false;
      const raw = row?.raw ?? row ?? {};
      const instanceId = String(raw?._id ?? row?._id ?? row?.InstanceID ?? row?.id ?? '').trim();
      const activityRaw = raw?._activity_instance_id ?? row?._activity_instance_id ?? row?.ActivityID ?? '';
      const activityId = String(Array.isArray(activityRaw) ? (activityRaw[0] ?? '') : activityRaw).trim();
      if (!instanceId || !activityId) return false;
      try {
        sdk.app.page.openPopup(SUBTASK_DETAIL_POPUP_ID, { ActivityId: activityId, InstanceId: instanceId });
        return true;
      } catch (err) {
        console.warn('Subtask popup failed:', err);
        return false;
      }
    },
    [kfInstance],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadData();
    } finally {
      setRefreshing(false);
    }
  }, [reloadData]);

  const content = (
    <div className="bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff]">
      <div className="p-2 pb-6 sm:p-6">
        <motion.header
          ref={headerRef}
          data-dashboard-header
          className="sticky top-0 z-30 -mx-2 mb-3 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-2 pb-2.5 pt-2 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.2)] backdrop-blur-md sm:-mx-6 sm:mb-5 sm:px-6 sm:pb-4 sm:pt-3"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        >
          <div className="mx-auto max-w-[1800px] text-center lg:text-left">
            <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl md:text-3xl">
              {getGreetingText()}, <span className="font-semibold text-slate-900">{userName}</span>
            </h1>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500 lg:text-sm">
              Logged in as <span className="text-slate-600">{roleName}</span>
            </p>
          </div>
        </motion.header>

        <div className="space-y-3 lg:space-y-6">
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-1.5 px-0.5 sm:mb-3"><h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">Insights</h2></div>
            <SubtaskKPISection metrics={kpiMetrics} onKpiClick={handleKpiClick} activeKey={insightFocus?.key} />
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="mb-1.5 px-0.5 sm:mb-3"><h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">Health Monitor</h2></div>
            <SubtaskHealthSummaryBar data={apiSubtaskData} />
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
            transition={{ delay: 0.1 }}
          >
            <SubtasksHealthTable
              data={apiSubtaskData}
              onOpenSubtaskPopup={handleSubtaskOpenPopup}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              insightFilter={
                insightFocus?.section === 'health'
                  ? { token: insightFocus.token, status: insightFocus.taskStatus }
                  : null
              }
            />
          </motion.section>
        </div>
      </div>
    </div>
  );

  if (!useLayout) return content;
  return <AppLayout>{content}</AppLayout>;
}

/** Kissflow custom component — subtask-focused dashboard (Sub_Task_Process_A00). */
export default function SubTasksDashboardPage({ useLayout = false }) {
  return <SubTasksDashboardPremium useLayout={useLayout} />;
}
