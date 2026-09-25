import { toInitials } from '../lib/kfProjectDashboard.js';

export function isEmptyPersonName(name) {
  const v = String(name ?? '').trim();
  return !v || v === '—' || v === '-' || v.toLowerCase() === 'n/a';
}

/**
 * Initials-only avatar; themed full-name tip on hover (same pattern as UserSpecificPT).
 */
export default function PtUserAvatar({
  name,
  initials,
  sizeClass = 'h-7 w-7',
  textClass = 'text-[11px]',
}) {
  const label = String(name ?? '').trim();
  const empty = isEmptyPersonName(label);
  const shown = String(initials || toInitials(label) || '—').trim() || '—';

  if (empty) {
    return (
      <span
        className={`inline-flex ${sizeClass} items-center justify-center rounded-full bg-slate-100 text-[10px] font-medium text-slate-400`}
        aria-label="Unassigned"
      >
        —
      </span>
    );
  }

  return (
    <span className="group/avatar relative inline-flex shrink-0">
      <span
        className={`inline-flex ${sizeClass} cursor-default items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 ring-1 ring-blue-200/70 transition group-hover/avatar:bg-[#E8F0FE] group-hover/avatar:ring-[#1E88E5]/35 ${textClass}`}
        aria-label={label}
      >
        {shown}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 w-max max-w-[14rem] -translate-y-1/2 rounded-xl border border-slate-200/90 bg-white/95 px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug text-slate-700 opacity-0 shadow-[0_4px_6px_-1px_rgba(15,23,42,0.06),0_12px_28px_-10px_rgba(30,136,229,0.22)] backdrop-blur-sm transition duration-150 group-hover/avatar:opacity-100"
      >
        <span
          className="absolute right-full top-1/2 h-0 w-0 -translate-y-1/2 border-y-[5px] border-r-[6px] border-y-transparent border-r-white"
          aria-hidden
        />
        {label}
      </span>
    </span>
  );
}
