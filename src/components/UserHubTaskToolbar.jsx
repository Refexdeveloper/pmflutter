import { memo } from 'react'

/** LeadsManagementPage-style task toolbar for User Hub tasks page. */

/** "Tasks Assigned to me" → "Assigned to me" (mobile keeps tabs on one line). */
function toShortLabel(label) {
  const short = String(label || '').replace(/^(sub)?tasks\s+/i, '');
  if (!short) return label;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

function PrimaryTab({ active, onClick, label, count, testId }) {
  const shortLabel = toShortLabel(label);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={testId}
      onClick={onClick}
      className={`inline-flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 touch-manipulation sm:min-h-[42px] sm:px-5 ${
        active
          ? 'bg-white text-slate-800 shadow-sm'
          : 'bg-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      <span className="min-w-0 truncate leading-tight sm:hidden">{shortLabel}</span>
      <span className="hidden min-w-0 truncate leading-tight sm:inline">{label}</span>
      {count != null ? (
        <span
          className={`inline-flex h-5 min-w-[1.375rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
            active ? 'bg-slate-100 text-slate-800' : 'text-slate-500'
          }`}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </button>
  );
}

function StatusChip({ active, onClick, label, count, testId }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`inline-flex min-h-[36px] min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all duration-200 touch-manipulation sm:min-h-[38px] sm:px-3.5 sm:text-sm ${
        active
          ? 'border-[#1E88E5] bg-[#1E88E5]/10 text-[#1E88E5]'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-white'
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className={`font-bold tabular-nums ${active ? 'text-[#1E88E5]' : 'text-slate-500'}`}>
        {count ?? 0}
      </span>
    </button>
  );
}

function UserHubTaskToolbar({
  taskScope,
  onTaskScopeChange,
  createdTotal,
  assignedTotal,
  createdStatusFilter,
  onCreatedStatusChange,
  statusCounts,
  assignedStatus,
  onAssignedStatusChange,
  assignedOpenCount,
  assignedClosedCount,
  showDeleteDrafts,
  selectedDraftCount,
  deletingDrafts,
  onDeleteDrafts,
  assignedLabel = 'Tasks Assigned to me',
  createdLabel = 'Tasks Created by Me',
  ownershipAriaLabel = 'Task ownership',
  openClosedOnly = false,
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div
          className="flex w-full min-w-0 items-center rounded-full border border-slate-200 bg-slate-50/90 p-1 sm:max-w-xl"
          role="tablist"
          aria-label={ownershipAriaLabel}
        >
          <PrimaryTab
            active={taskScope === 'assigned'}
            onClick={() => onTaskScopeChange('assigned')}
            label={assignedLabel}
            count={assignedTotal}
            testId="pm-task-scope-assigned"
          />
          <PrimaryTab
            active={taskScope === 'created'}
            onClick={() => onTaskScopeChange('created')}
            label={createdLabel}
            count={createdTotal}
            testId="pm-task-scope-created"
          />
        </div>

        {showDeleteDrafts && selectedDraftCount > 0 ? (
          <button
            type="button"
            onClick={onDeleteDrafts}
            disabled={deletingDrafts}
            className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:text-sm"
          >
            <i className="ri-delete-bin-6-line shrink-0" aria-hidden />
            {deletingDrafts ? 'Deleting…' : `Delete (${selectedDraftCount})`}
          </button>
        ) : null}
      </div>

      {taskScope === 'created' && !openClosedOnly ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            {['Draft', 'In progress', 'Completed', 'Withdrawn', 'Rejected'].map((status) => (
              <StatusChip
                key={status}
                active={createdStatusFilter === status}
                onClick={() => onCreatedStatusChange(status)}
                label={status}
                count={statusCounts?.[status] ?? 0}
              />
            ))}
          </div>
          <div className="hidden min-w-0 items-center gap-2 overflow-x-auto pr-1 sm:flex [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {['Draft', 'In progress', 'Completed', 'Withdrawn', 'Rejected'].map((status) => (
              <StatusChip
                key={status}
                active={createdStatusFilter === status}
                onClick={() => onCreatedStatusChange(status)}
                label={status}
                count={statusCounts?.[status] ?? 0}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <StatusChip
            active={assignedStatus === 'open'}
            onClick={() => onAssignedStatusChange('open')}
            label="Open"
            count={assignedOpenCount}
            testId="pm-task-status-open"
          />
          <StatusChip
            active={assignedStatus === 'closed'}
            onClick={() => onAssignedStatusChange('closed')}
            label="Closed"
            count={assignedClosedCount}
            testId="pm-task-status-closed"
          />
        </div>
      )}
    </div>
  );
}

export default memo(UserHubTaskToolbar);
