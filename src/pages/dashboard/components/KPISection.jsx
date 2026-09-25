import { motion } from 'framer-motion';
import { ctoDashboardKPIs } from '@/mocks/cto-dashboard';

/** Inspired palette — high-contrast SaaS dashboard (+ RAG-style gradient shells / hover) */
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
  active: {
    valueClass: 'text-[#0084AD]',
    iconBg: 'bg-[#0084AD]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(0,132,173,0.12)]',
    cardBg: 'from-cyan-50/92 via-white to-sky-50/75',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(0,132,173,0.2)]',
    hoverRing: 'group-hover:ring-[#0084AD]/25',
    hoverBorder: 'group-hover:border-[#0084AD]/38',
    glow: 'rgba(0,132,173,0.16)',
    iconRing: 'ring-1 ring-[#0084AD]/20 group-hover:ring-white/50',
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
  delayed: {
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

function PremiumKPICard({ title, value, subtitle, trend, icon, theme, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 28,
        delay: Math.min(index * 0.035, 0.25),
      }}
      whileHover={{
        y: -6,
        scale: 1.02,
        transition: { type: 'spring', stiffness: 420, damping: 22 },
      }}
      whileTap={{ scale: 0.985 }}
      className={`
        group relative cursor-default overflow-hidden rounded-xl border border-slate-200/88 bg-gradient-to-br p-3.5 sm:rounded-2xl sm:p-5
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
    </motion.div>
  );
}

export default function KPISection({ metrics }) {
  const k = metrics ?? ctoDashboardKPIs;
  const totalProjects = Math.max(k.totalProjects || 0, 1);
  const totalTasks = Math.max(k.totalSubtasks || 0, 1);

  const cards = [
    {
      title: 'Total Projects',
      value: k.totalProjects,
      subtitle: `${k.trendTotalProjects} from last quarter`,
      icon: 'ri-folder-3-line',
      theme: KPI_THEME.total,
      trend: { value: k.trendTotalProjects, positive: true },
    },
    {
      title: 'Active Projects',
      value: k.activeProjects,
      subtitle: `${Math.round((k.activeProjects / totalProjects) * 100)}% of total`,
      icon: 'ri-notification-3-line',
      theme: KPI_THEME.active,
      trend: { value: `${k.activeProjects} running`, positive: true },
    },
    {
      title: 'Completed Projects',
      value: k.completedProjects,
      subtitle: `${Math.round((k.completedProjects / totalProjects) * 100)}% completion rate`,
      icon: 'ri-checkbox-circle-line',
      theme: KPI_THEME.completed,
      trend: { value: `${k.completedProjects} done`, positive: true },
    },
    {
      title: 'Delayed Projects',
      value: k.delayedProjects,
      subtitle: `${Math.round((k.delayedProjects / totalProjects) * 100)}% at risk`,
      icon: 'ri-error-warning-line',
      theme: KPI_THEME.delayed,
      trend: { value: `${k.delayedProjects} flagged`, positive: false },
    },
    {
      title: 'Total Subtasks',
      value: k.totalSubtasks,
      subtitle: 'Across all active projects',
      icon: 'ri-list-check-3',
      theme: KPI_THEME.subtasks,
      trend: { value: `${k.totalSubtasks} tracked`, positive: true },
    },
    {
      title: 'Open Tasks',
      value: k.openTasks,
      subtitle: `${Math.round((k.openTasks / totalTasks) * 100)}% of total tasks`,
      icon: 'ri-folder-open-line',
      theme: KPI_THEME.open,
      trend: { value: `${k.openTasks} pending`, positive: false },
    },
    {
      title: 'Completed Tasks',
      value: k.completedTasks,
      subtitle: `${Math.round((k.completedTasks / totalTasks) * 100)}% task completion rate`,
      icon: 'ri-check-double-line',
      theme: KPI_THEME.tasksDone,
      trend: { value: `${k.completedTasks} closed`, positive: true },
    },
    {
      title: 'Overdue Tasks',
      value: k.overdueTasks,
      subtitle: 'Requires immediate action',
      icon: 'ri-alarm-warning-line',
      theme: KPI_THEME.overdue,
      trend: { value: `${k.overdueTasks} overdue`, positive: false },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 xl:grid-cols-4">
      {cards.map((card, index) => (
        <PremiumKPICard
          key={card.title}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          theme={card.theme}
          trend={card.trend}
          index={index}
        />
      ))}
    </div>
  );
}
