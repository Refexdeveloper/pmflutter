/**
 * Shared nested-subtask row for task accordions across dashboards.
 * Prefer Sub_task_Name (form title), then SubTask_Summary; never raw process Name.
 */

import PtUserAvatar from './PtUserAvatar.jsx';
import { resolveSubtaskDisplayName } from '../lib/kfSubtaskTracker.js';

export function formatSubtaskDisplayFields(sub) {
  const summary = resolveSubtaskDisplayName(sub, '');
  const raw = sub?.raw && typeof sub.raw === 'object' ? sub.raw : {};
  const assignee = String(
    sub?.assignedTo ||
      sub?.assigneeName ||
      raw?.Assignee_1?.Name ||
      sub?.people?.[0]?.name ||
      '',
  ).trim() || '—';
  const createdBy = String(
    sub?.createdBy ||
      raw?._created_by?.Name ||
      '',
  ).trim() || '—';

  return {
    summary: summary || 'Untitled subtask',
    assignee,
    createdBy,
    status: sub?.status || raw?._status || '—',
  };
}

export default function SubtaskAccordionRow({
  sub,
  onClick,
  statusSlot = null,
  compact = false,
  className = '',
}) {
  const { summary, assignee, createdBy } = formatSubtaskDisplayFields(sub);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center justify-between gap-2 border border-slate-200/80 bg-white text-left shadow-none transition hover:bg-slate-50 ${
        compact ? 'rounded-lg px-2 py-1.5' : 'gap-3 rounded-xl px-3 py-2.5'
      } ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <i className={`ri-node-tree shrink-0 text-[#FB8C00] ${compact ? 'text-xs' : 'text-sm'}`} aria-hidden />
        <div className="min-w-0">
          <p className={`truncate font-medium text-[#2C3E50] ${compact ? 'text-[11px] leading-snug' : 'text-[12px] sm:text-sm'}`}>
            {summary}
          </p>
          <div
            className={`mt-0.5 flex flex-wrap items-center gap-1.5 text-[#7F8C8D] ${
              compact ? 'text-[9px]' : 'text-[10px] sm:text-xs'
            }`}
          >
            <span className="inline-flex min-w-0 items-center gap-1">
              <span className="shrink-0">Assignee</span>
              <PtUserAvatar
                name={assignee}
                sizeClass={compact ? 'h-4 w-4' : 'h-5 w-5'}
                textClass={compact ? 'text-[8px]' : 'text-[9px]'}
              />
            </span>
            {!compact ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1">
                  <span>Created by</span>
                  <PtUserAvatar name={createdBy} sizeClass="h-5 w-5" textClass="text-[9px]" />
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>
      {statusSlot}
    </button>
  );
}
