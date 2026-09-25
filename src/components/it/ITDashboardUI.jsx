/* eslint-disable react-refresh/only-export-components -- shared IT dashboard UI kit */
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  UserRound, Wrench, ShieldCheck, LayoutDashboard,
  Ticket, FolderOpen, CheckCircle2, ListTodo, AlertTriangle, Users,
  RotateCcw, Search, Layers,
} from 'lucide-react';
import { getGreetingText } from '../../lib/kfProjectDashboard.js';
import { ITEM_STATUS_WAITING_LABEL } from '../../lib/kfITServiceDashboard.js';

/** Unified IT Service Management design tokens */
export const IT_THEME = {
  page: 'min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/45 to-indigo-50',
  blobA: 'absolute -left-20 top-20 h-72 w-72 rounded-full bg-cyan-400/18 blur-3xl',
  blobB: 'absolute -right-16 bottom-24 h-80 w-80 rounded-full bg-indigo-400/14 blur-3xl',
  blobC: 'absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-300/10 blur-3xl',
  header: 'relative border-b border-white/70 bg-white/80 px-4 py-6 backdrop-blur-xl sm:px-8',
  headerIcon: 'flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-white/50',
  brandLabel: 'text-xs font-semibold uppercase tracking-wider text-indigo-600',
  nameGradient: 'bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent',
  refreshBtn: 'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:shadow-lg hover:brightness-105',
  section: 'overflow-hidden rounded-2xl border border-white/80 bg-white/92 shadow-xl shadow-indigo-500/5 backdrop-blur-sm',
  sectionHead: 'border-b border-slate-100 bg-gradient-to-r from-cyan-50/80 via-white to-indigo-50/70 px-4 py-4 sm:px-6',
  sectionIcon: 'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20',
  tableHead: 'bg-gradient-to-r from-cyan-100/75 via-indigo-50/60 to-violet-50/40 text-[11px] font-bold uppercase tracking-wide text-indigo-800/75',
  rowHover: 'hover:bg-cyan-50/50',
  rowExpanded: 'bg-gradient-to-r from-cyan-50/90 via-indigo-50/40 to-violet-50/30 shadow-inner',
  expandPanel: 'border-t border-indigo-100/80 bg-gradient-to-br from-cyan-50/90 via-indigo-50/45 to-violet-50/35',
  expandIcon: 'flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25',
  chevron: 'text-indigo-500',
  requestId: 'font-bold text-indigo-700',
  searchFocus: 'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
  tabInactive: 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700',
  tabActive: 'bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20',
  stepBadge: 'rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700',
  itemStatusBadge: 'rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-800',
  previewBadge: 'rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800',
  primaryBtn: 'flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:scale-[1.02] hover:shadow-xl disabled:opacity-60 disabled:hover:scale-100',
  sidebarHeader: 'bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 px-5 py-5 text-white',
};

export const IT_KPI_CARDS = {
  total: { gradient: 'from-cyan-500 to-indigo-600', glow: 'shadow-cyan-500/35', icon: Ticket },
  open: { gradient: 'from-sky-500 to-violet-600', glow: 'shadow-sky-500/35', icon: FolderOpen },
  completed: { gradient: 'from-emerald-500 to-teal-600', glow: 'shadow-emerald-500/35', icon: CheckCircle2 },
  pending: { gradient: 'from-violet-500 to-fuchsia-600', glow: 'shadow-violet-500/35', icon: ListTodo },
  sla: { gradient: 'from-rose-500 to-orange-600', glow: 'shadow-rose-500/35', icon: AlertTriangle },
  agentQueue: { gradient: 'from-indigo-500 to-cyan-600', glow: 'shadow-indigo-500/35', icon: Users },
};

export const IT_ROLE_CONFIG = {
  employee: {
    key: 'employee',
    icon: UserRound,
    sectionIcon: UserRound,
    roleLabel: 'Employee Portal',
    subtitle: 'My service requests · Live IT Service Request',
  },
  agent: {
    key: 'agent',
    icon: Wrench,
    sectionIcon: Wrench,
    roleLabel: 'IT Agent Workspace',
    subtitle: 'Agent tasks · Resolve & submit solutions',
  },
  manager: {
    key: 'manager',
    icon: ShieldCheck,
    sectionIcon: ShieldCheck,
    roleLabel: 'IT Manager Console',
    subtitle: 'Manager review · Approvals & oversight',
  },
  admin: {
    key: 'admin',
    icon: LayoutDashboard,
    sectionIcon: LayoutDashboard,
    roleLabel: 'IT Admin Command Center',
    subtitle: 'Full visibility · All service requests',
  },
};

export const CRITICALITY_STYLE = {
  Critical: 'bg-rose-100 text-rose-700 ring-rose-200',
  High: 'bg-orange-100 text-orange-800 ring-orange-200',
  Medium: 'bg-amber-100 text-amber-800 ring-amber-200',
  Low: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
};

export const ITEM_STATUS_STYLE = {
  Completed: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'On Hold': 'bg-amber-100 text-amber-800 ring-amber-200',
  'In Progress': 'bg-sky-100 text-sky-700 ring-sky-200',
  Picked: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
  Escalated: 'bg-rose-100 text-rose-700 ring-rose-200',
  [ITEM_STATUS_WAITING_LABEL]: 'bg-violet-100 text-violet-700 ring-violet-200',
};

export function itemStatusClass(status) {
  return ITEM_STATUS_STYLE[status] || 'bg-slate-100 text-slate-600 ring-slate-200';
}

export function useCountUp(endValue, duration = 900) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(0);

  useEffect(() => {
    const to = Number.isFinite(Number(endValue)) ? Math.round(Number(endValue)) : 0;
    const from = ref.current;
    let raf = 0;
    const t0 = performance.now();
    const ease = (t) => 1 - (1 - t) ** 3;

    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const v = Math.round(from + (to - from) * ease(t));
      setDisplay(v);
      ref.current = v;
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        ref.current = to;
        setDisplay(to);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [endValue, duration]);

  return display;
}

export function ITKpiCard({ title, value, icon: Icon, gradient, glow, delay = 0 }) {
  const animated = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 26 }}
      className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/88 p-5 shadow-lg shadow-indigo-500/5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10"
    >
      <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${gradient} opacity-22 blur-2xl transition-opacity group-hover:opacity-38`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 sm:text-4xl">{animated}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg ${glow}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </motion.div>
  );
}

export function ITDashboardBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className={IT_THEME.blobA} />
      <div className={IT_THEME.blobB} />
      <div className={IT_THEME.blobC} />
    </div>
  );
}

export function ITDashboardHeader({
  roleKey,
  userName,
  subtitle,
  connected,
  loading,
  loadError,
  onRefresh,
}) {
  const role = IT_ROLE_CONFIG[roleKey];
  const RoleIcon = role.icon;

  return (
    <header className={IT_THEME.header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className={IT_THEME.headerIcon}>
            <RoleIcon className="h-7 w-7" />
          </div>
          <div>
            <p className={IT_THEME.brandLabel}>IT Service Management · {role.roleLabel}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              {getGreetingText()},{' '}
              <span className={IT_THEME.nameGradient}>{userName}</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle || role.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!connected && !loading && (
            <span className={IT_THEME.previewBadge}>Preview mode</span>
          )}
          <button type="button" onClick={onRefresh} className={IT_THEME.refreshBtn}>
            <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      {loadError && <p className="mx-auto mt-3 max-w-7xl text-sm text-rose-600">{loadError}</p>}
    </header>
  );
}

export function ITSearchInput({ value, onChange, placeholder = 'Search tickets...' }) {
  return (
    <div className="relative max-w-xs flex-1 sm:max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none ${IT_THEME.searchFocus}`}
      />
    </div>
  );
}

export function ITTabButton({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
        active ? IT_THEME.tabActive : IT_THEME.tabInactive
      }`}
    >
      {label}
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
        active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
      }`}>
        {count}
      </span>
    </button>
  );
}

export function ITTableSectionHeader({ roleKey, title, subtitle, search, onSearchChange, tabs }) {
  const role = IT_ROLE_CONFIG[roleKey];
  const SectionIcon = role.sectionIcon;

  return (
    <div className={IT_THEME.sectionHead}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={IT_THEME.sectionIcon}>
            <SectionIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title || 'Live IT Service Request'}</h2>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        {search != null && (
          <ITSearchInput value={search.value} onChange={search.onChange} placeholder={search.placeholder} />
        )}
      </div>
      {tabs && <div className="mt-4 flex flex-wrap gap-2">{tabs}</div>}
    </div>
  );
}

export function ITDetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm last:border-0">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800 break-words [overflow-wrap:anywhere]">{value || '—'}</span>
    </div>
  );
}

export function ITDetailTile({ label, value }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/92 p-3 shadow-sm shadow-indigo-500/5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800 break-words">{value || '—'}</p>
    </div>
  );
}

export function ITSectionIconBox({ icon: Icon }) {
  return (
    <div className={IT_THEME.sectionIcon}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

export { Layers, Ticket };
