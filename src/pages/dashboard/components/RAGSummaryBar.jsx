import { motion } from 'framer-motion';

const ragCards = (green, amber, red, total) => {
  const pct = (n) => Math.round((n / total) * 100);
  return [
    {
      key: 'on-track',
      label: 'On Track',
      value: green,
      icon: '🟢',
      pct: pct(green),
      footnote: '% of projects',
      valueColor: 'text-[#22C55E]',
      iconWrap: 'bg-emerald-500/15 ring-1 ring-emerald-500/25',
      barColor: '#22C55E',
      barTrack: 'bg-emerald-100/80',
      cardBg: 'from-emerald-50/95 via-white to-green-50/80',
      borderHover: 'hover:border-emerald-300/60',
      ringHover: 'group-hover:ring-emerald-400/25',
      glow: 'rgba(34,197,94,0.22)',
      shadow: 'shadow-emerald-900/5',
    },
    {
      key: 'at-risk',
      label: 'At Risk',
      value: amber,
      icon: '🟡',
      pct: pct(amber),
      footnote: '% of projects',
      valueColor: 'text-[#F59E0B]',
      iconWrap: 'bg-amber-500/15 ring-1 ring-amber-500/30',
      barColor: '#F59E0B',
      barTrack: 'bg-amber-100/80',
      cardBg: 'from-amber-50/95 via-white to-yellow-50/70',
      borderHover: 'hover:border-amber-300/60',
      ringHover: 'group-hover:ring-amber-400/25',
      glow: 'rgba(245,158,11,0.2)',
      shadow: 'shadow-amber-900/5',
    },
    {
      key: 'delayed',
      label: 'Delayed',
      value: red,
      icon: '🔴',
      pct: pct(red),
      footnote: '% of projects',
      valueColor: 'text-[#EF4444]',
      iconWrap: 'bg-red-500/15 ring-1 ring-red-500/30',
      barColor: '#EF4444',
      barTrack: 'bg-red-100/80',
      cardBg: 'from-rose-50/95 via-white to-red-50/75',
      borderHover: 'hover:border-red-300/55',
      ringHover: 'group-hover:ring-red-400/25',
      glow: 'rgba(239,68,68,0.2)',
      shadow: 'shadow-red-900/5',
    },
  ];
};

function AnimatedBar({ widthPct, color, trackClass, delay }) {
  const x = Math.min(100, Math.max(0, widthPct)) / 100;
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full ${trackClass}`}>
      <motion.div
        className="h-full w-full origin-left rounded-full"
        style={{ backgroundColor: color }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: x }}
        transition={{
          type: 'spring',
          stiffness: 120,
          damping: 18,
          delay,
        }}
      />
    </div>
  );
}

export default function RAGSummaryBar({ data }) {
  const total = Math.max(data.length, 1);
  const red = data.filter((p) => p.rag === 'Red').length;
  const amber = data.filter((p) => p.rag === 'Amber').length;
  const green = data.filter((p) => p.rag === 'Green').length;
  const overdue = data.reduce((acc, p) => acc + (p.delayDays > 0 ? 1 : 0), 0);
  const totalRevisions = data.reduce((acc, p) => acc + p.revisedCount, 0);
  const avgProgress = Math.round(data.reduce((acc, p) => acc + p.progress, 0) / total);
  const projectCount = data.length;
  const overduePct = Math.round((overdue / total) * 100);

  const revisionBarPct = Math.min(100, totalRevisions <= 0 ? 0 : Math.min(100, (totalRevisions / Math.max(projectCount * 8, 8)) * 100));

  const metricCards = [
    {
      key: 'avg-progress',
      label: 'Avg Progress',
      display: `${avgProgress}%`,
      footnote: 'Portfolio average',
      barPct: avgProgress,
      iconClass: 'ri-pie-chart-2-line',
      valueColor: 'text-[#2B5AED]',
      iconBg: 'bg-[#2B5AED]/12 text-[#2B5AED] ring-[#2B5AED]/25',
      barColor: '#2B5AED',
      barTrack: 'bg-blue-100/90',
      cardBg: 'from-sky-50/90 via-white to-indigo-50/70',
      borderHover: 'hover:border-blue-300/55',
      ringHover: 'group-hover:ring-blue-400/25',
      glow: 'rgba(43,90,237,0.18)',
      shadow: 'shadow-blue-900/5',
      delay: 0.15,
    },
    {
      key: 'revisions',
      label: 'Total Revisions',
      display: String(totalRevisions),
      footnote: `Across ${projectCount} project${projectCount === 1 ? '' : 's'}`,
      barPct: revisionBarPct,
      iconClass: 'ri-refresh-line',
      valueColor: 'text-[#EA580C]',
      iconBg: 'bg-orange-500/12 text-[#EA580C] ring-orange-500/25',
      barColor: '#F97316',
      barTrack: 'bg-orange-100/90',
      cardBg: 'from-orange-50/90 via-white to-amber-50/75',
      borderHover: 'hover:border-orange-300/55',
      ringHover: 'group-hover:ring-orange-400/25',
      glow: 'rgba(249,115,22,0.18)',
      shadow: 'shadow-orange-900/5',
      delay: 0.2,
    },
    {
      key: 'overdue',
      label: 'Overdue Projects',
      display: String(overdue),
      footnote: `${overduePct}% of portfolio`,
      barPct: overduePct,
      iconClass: 'ri-alarm-warning-line',
      valueColor: 'text-[#E11D48]',
      iconBg: 'bg-rose-500/12 text-rose-600 ring-rose-500/25',
      barColor: '#E11D48',
      barTrack: 'bg-rose-100/90',
      cardBg: 'from-rose-50/92 via-white to-fuchsia-50/65',
      borderHover: 'hover:border-rose-300/55',
      ringHover: 'group-hover:ring-rose-400/25',
      glow: 'rgba(225,29,72,0.16)',
      shadow: 'shadow-rose-900/5',
      delay: 0.25,
    },
  ];

  const items = ragCards(green, amber, red, total);

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5 xl:grid-cols-6"
      data-aos="fade-up"
      data-aos-duration="700"
    >
      {items.map((item, index) => (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 28,
            delay: index * 0.05,
          }}
          whileHover={{
            y: -6,
            scale: 1.025,
            transition: { type: 'spring', stiffness: 420, damping: 22 },
          }}
          whileTap={{ scale: 0.985 }}
          data-aos="zoom-in"
          data-aos-duration="550"
          className={`
            group relative col-span-1 cursor-default overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br p-3.5 sm:rounded-2xl sm:p-5
            ${item.cardBg}
            shadow-md ${item.shadow}
            transition-shadow duration-300 hover:shadow-xl hover:shadow-slate-300/35
            hover:ring-2 ring-transparent ${item.ringHover}
            ${item.borderHover}
          `}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
            style={{ background: item.glow }}
          />

          <div className="relative flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:text-[11px] sm:tracking-[0.12em]">
                {item.label}
              </span>
              <motion.span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm sm:h-9 sm:w-9 sm:rounded-xl sm:text-base ${item.iconWrap} shadow-sm backdrop-blur-sm`}
                whileHover={{ scale: 1.12, rotate: [0, -6, 6, 0] }}
                transition={{ duration: 0.45 }}
              >
                {item.icon}
              </motion.span>
            </div>

            <motion.p
              className={`text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${item.valueColor}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.08 + index * 0.05 }}
            >
              {item.value}
            </motion.p>

            <AnimatedBar
              widthPct={item.pct}
              color={item.barColor}
              trackClass={item.barTrack}
              delay={0.12 + index * 0.06}
            />

            <p className="text-[11px] font-medium text-slate-500 sm:text-xs">
              {item.pct}
              {item.footnote}
            </p>
          </div>
        </motion.div>
      ))}

      {metricCards.map((m, index) => (
        <motion.div
          key={m.key}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 28,
            delay: 0.12 + index * 0.05,
          }}
          whileHover={{
            y: -6,
            scale: 1.025,
            transition: { type: 'spring', stiffness: 420, damping: 22 },
          }}
          whileTap={{ scale: 0.985 }}
          data-aos="zoom-in"
          data-aos-duration="650"
          className={`
            group relative col-span-1 cursor-default overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br p-3.5 sm:rounded-2xl sm:p-5
            ${m.cardBg}
            shadow-md ${m.shadow}
            transition-shadow duration-300 hover:shadow-xl hover:shadow-slate-300/35
            hover:ring-2 ring-transparent ${m.ringHover}
            ${m.borderHover}
          `}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
            style={{ background: m.glow }}
          />

          <div className="relative flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:text-[11px] sm:tracking-[0.12em]">
                {m.label}
              </span>
              <motion.div
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ring-1 sm:h-9 sm:w-9 sm:rounded-xl sm:text-lg ${m.iconBg}`}
                whileHover={{ scale: 1.1, rotate: -8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              >
                <i className={m.iconClass} />
              </motion.div>
            </div>

            <motion.p
              className={`text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${m.valueColor}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22, delay: m.delay }}
            >
              {m.display}
            </motion.p>

            <AnimatedBar
              widthPct={m.barPct}
              color={m.barColor}
              trackClass={m.barTrack}
              delay={m.delay + 0.05}
            />

            <p className="text-[11px] font-medium text-slate-500 sm:text-xs">{m.footnote}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
