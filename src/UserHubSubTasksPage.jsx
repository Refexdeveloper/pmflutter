/**
 * User Hub — subtasks page (Sub_Task_Process_A00).
 * Assigned / Created follow the login email:
 * - Assigned → $assignee_email={login email} (assignee is externalemail when Assignee_1 is missing)
 * - Created  → $requester_email={login email}
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import UserHubWelcome from './components/UserHubWelcome.jsx';
import UserHubTaskToolbar from './components/UserHubTaskToolbar.jsx';
import TablePaginationBar, { PT_TABLE_PAGE_SIZE } from './components/TablePaginationBar.jsx';
import PtUserAvatar from './components/PtUserAvatar.jsx';
import DashboardPeriodPicker, { getEmptyPeriodState } from './components/DashboardPeriodPicker.jsx';
import { useUserHubSession } from './lib/useUserHubSession.js';
import {
  deleteSubtaskDraftRecords,
  resolveSubtaskDraftDeleteId,
} from './lib/kfPmSubtaskProcessItems.js';
import { fetchEmployeeSubtasksByScope } from './lib/kfEmployeeSubtasksReport.js';
import { PM_SUBTASK_DETAILS_SAVED } from './lib/pmSubtaskDetails.js';
import { useHubLoginScopeLists } from './lib/useHubLoginScopeLists.js';
import {
  openUserHubSubtaskProcessCreatePopup,
  openUserHubSubtaskProcessPopup,
} from './lib/kfUserHubPopups.js';
import { isSubtaskCompleted } from './lib/kfSubtaskTracker.js';
import { matchesCreatedDateRange } from './lib/dashboardCreatedDateFilters.js';

function resolveSubtaskCreatedRanges(periodFrom, periodTo, periodRanges) {
  if (Array.isArray(periodRanges) && periodRanges.length > 0) {
    return periodRanges
      .map((r) => {
        const fromStr = String(r?.from || '').trim();
        const toStr = String(r?.to || '').trim();
        if (!fromStr || !toStr) return null;
        const from = new Date(`${fromStr}T00:00:00`);
        const to = new Date(`${toStr}T23:59:59.999`);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
        return { from, to };
      })
      .filter(Boolean);
  }
  const fromStr = String(periodFrom || '').trim();
  const toStr = String(periodTo || '').trim();
  if (!fromStr || !toStr) return [];
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.999`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];
  return [{ from, to }];
}

function getSubtaskCreatedValue(row) {
  return (
    row?.raw?._created_at ||
    row?._created_at ||
    row?.createdAt ||
    row?.createdDate ||
    null
  );
}

const EMPTY_LIST = [];

function statusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('complete') || s.includes('closed') || s.includes('done')) {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (s.includes('progress') || s.includes('review')) {
    return 'bg-blue-50 text-[#1E88E5]';
  }
  if (s.includes('hold') || s.includes('block')) {
    return 'bg-orange-50 text-[#FB8C00]';
  }
  if (s.includes('draft')) {
    return 'bg-slate-100 text-slate-600';
  }
  return 'bg-violet-50 text-violet-700';
}

export default function UserHubSubTasksPage({
  useLayout = false,
  embedded = false,
  /** When true, show manager-scoped MyTeam_A00 rows instead of hub myitems/pending. */
  myTeamMode = false,
  myTeamRows = null,
  myTeamLoading = false,
  selectedMembers = EMPTY_LIST,
  /** Optional row opener (e.g. My Team custom detail modal). */
  onOpenRow = null,
  /** Override Kissflow popup id for open/create (ActivityID + InstanceID). */
  processPopupId = null,
  isActive = true,
}) {
  const { kfInstance, scopeUser, loginEmail, firstName, greeting } = useUserHubSession();
  void useLayout;

  const [taskScope, setTaskScope] = useState('assigned');
  const [createdStatusFilter, setCreatedStatusFilter] = useState('Draft');
  const [assignedStatus, setAssignedStatus] = useState('open');
  const emptyPeriod = getEmptyPeriodState();
  const [periodMode, setPeriodMode] = useState(emptyPeriod.mode);
  const [periodFrom, setPeriodFrom] = useState(emptyPeriod.range.from);
  const [periodTo, setPeriodTo] = useState(emptyPeriod.range.to);
  const [periodLabel, setPeriodLabel] = useState(emptyPeriod.summaryLabel);
  const [periodRanges, setPeriodRanges] = useState([]);
  const [periodParts, setPeriodParts] = useState([]);
  const [periodFyStartYear, setPeriodFyStartYear] = useState(null);

  const [selectedDraftIds, setSelectedDraftIds] = useState(() => new Set());
  const [deletingDrafts, setDeletingDrafts] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchByScope = useCallback(
    (kf, options) => fetchEmployeeSubtasksByScope(kf, options),
    [],
  );

  const {
    scopedRows: loginScopedRows,
    loading: processSubtasksLoading,
    statusCounts,
    scopeCounts: subtaskCounts,
    bumpRefresh,
    removeRowsByIds,
  } = useHubLoginScopeLists({
    kfInstance,
    loginEmail,
    fetchByScope,
    listKey: 'subtasks',
    enabled: !myTeamMode,
    taskScope,
    assignedStatus,
    createdStatusFilter,
  });

  const selectedMembersKey = Array.isArray(selectedMembers) ? selectedMembers.join('\0') : '';

  useEffect(() => {
    setSelectedDraftIds(new Set());
    setTablePage(1);
  }, [taskScope, createdStatusFilter, assignedStatus, myTeamMode, search, periodFrom, periodTo, periodMode, selectedMembersKey]);

  const handleTaskScopeChange = useCallback((scope) => {
    setTaskScope(scope);
    if (scope === 'assigned') setAssignedStatus('open');
    if (scope === 'created') setCreatedStatusFilter('Draft');
  }, []);

  const showDraftBulkSelect =
    !myTeamMode && taskScope === 'created' && createdStatusFilter === 'Draft';

  const sourceRows = useMemo(() => {
    if (myTeamMode) return Array.isArray(myTeamRows) ? myTeamRows : [];
    return loginScopedRows;
  }, [myTeamMode, myTeamRows, loginScopedRows]);

  const filteredRows = useMemo(() => {
    let rows = sourceRows;
    if (myTeamMode && Array.isArray(selectedMembers) && selectedMembers.length > 0) {
      const allow = new Set(selectedMembers.map((n) => String(n || '').trim()));
      rows = rows.filter((row) => allow.has(String(row.assignedTo || row.assignee || '').trim()));
    }

    const createdRanges = resolveSubtaskCreatedRanges(periodFrom, periodTo, periodRanges);
    if (createdRanges.length) {
      rows = rows.filter((row) =>
        createdRanges.some((range) =>
          matchesCreatedDateRange(row, range, getSubtaskCreatedValue),
        ),
      );
    }

    const q = String(search || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.subtaskName,
        row.summary,
        row.parentTaskName,
        row.parentTaskId,
        row.assignedTo,
        row.assignee,
        row.status,
        row.createdBy,
        row.projectId,
      ]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }, [
    sourceRows,
    search,
    myTeamMode,
    selectedMembers,
    periodFrom,
    periodTo,
    periodRanges,
  ]);

  const handlePeriodChange = useCallback((next) => {
    const period = next && typeof next === 'object' ? next : getEmptyPeriodState();
    setPeriodMode(period.mode || 'all');
    setPeriodFrom(period.range?.from || '');
    setPeriodTo(period.range?.to || '');
    setPeriodLabel(period.summaryLabel || 'All time');
    setPeriodRanges(Array.isArray(period.ranges) ? period.ranges : []);
    setPeriodParts(Array.isArray(period.parts) ? period.parts : []);
    setPeriodFyStartYear(
      Number.isFinite(Number(period.fyStartYear)) ? Number(period.fyStartYear) : null,
    );
  }, []);

  const periodPickerState = useMemo(
    () => ({
      mode: periodMode || 'all',
      range: { from: periodFrom || '', to: periodTo || '' },
      ranges: periodRanges,
      parts: periodParts,
      fyStartYear: periodFyStartYear,
      summaryLabel: periodLabel || 'All time',
    }),
    [periodMode, periodFrom, periodTo, periodRanges, periodParts, periodFyStartYear, periodLabel],
  );

  const tableTotal = filteredRows.length;
  const tableTotalPages = Math.max(1, Math.ceil(tableTotal / PT_TABLE_PAGE_SIZE));
  const safeTablePage = Math.min(Math.max(1, tablePage), tableTotalPages);

  useEffect(() => {
    if (tablePage !== safeTablePage) setTablePage(safeTablePage);
  }, [tablePage, safeTablePage]);
  const pageRows = useMemo(() => {
    const start = (safeTablePage - 1) * PT_TABLE_PAGE_SIZE;
    return filteredRows.slice(start, start + PT_TABLE_PAGE_SIZE);
  }, [filteredRows, safeTablePage]);

  const draftPageRowIds = useMemo(() => {
    if (!showDraftBulkSelect) return [];
    return pageRows.map((row) => resolveSubtaskDraftDeleteId(row)).filter(Boolean);
  }, [showDraftBulkSelect, pageRows]);

  const allDraftPageSelected =
    showDraftBulkSelect &&
    draftPageRowIds.length > 0 &&
    draftPageRowIds.every((id) => selectedDraftIds.has(id));

  const handleToggleDraftSelect = useCallback((id) => {
    if (!id) return;
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAllDraftsSelect = useCallback((checked, pageRowIds) => {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      (pageRowIds || []).forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }, []);

  const handleDeleteDrafts = useCallback(async () => {
    const ids = Array.from(selectedDraftIds).filter(Boolean);
    if (!ids.length || !kfInstance) return;
    const confirmed = window.confirm(
      `Delete ${ids.length} selected draft subtask(s)? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingDrafts(true);
    try {
      const { successIds, failed } = await deleteSubtaskDraftRecords(kfInstance, ids);
      if (successIds.length) {
        removeRowsByIds(successIds, resolveSubtaskDraftDeleteId);
        setSelectedDraftIds((prev) => {
          const next = new Set(prev);
          successIds.forEach((id) => next.delete(id));
          return next;
        });
      }
      if (failed > 0) {
        window.alert(`${successIds.length} draft(s) deleted, ${failed} failed.`);
      } else if (successIds.length) {
        window.alert(`${successIds.length} draft(s) deleted successfully.`);
      }
    } catch (e) {
      console.warn('UserHub subtask draft delete failed:', e?.message || e);
      window.alert('Delete failed. Please try again.');
    } finally {
      setDeletingDrafts(false);
    }
  }, [kfInstance, selectedDraftIds, removeRowsByIds]);

  const scheduleRefreshAfterPopup = useCallback(() => {
    setTimeout(bumpRefresh, 300);
  }, [bumpRefresh]);

  useEffect(() => {
    const onSaved = () => scheduleRefreshAfterPopup();
    window.addEventListener(PM_SUBTASK_DETAILS_SAVED, onSaved);
    return () => window.removeEventListener(PM_SUBTASK_DETAILS_SAVED, onSaved);
  }, [scheduleRefreshAfterPopup]);

  const handleOpenRow = useCallback(
    (row) => {
      if (typeof onOpenRow === 'function') {
        onOpenRow(row);
        return;
      }
      openUserHubSubtaskProcessPopup(kfInstance, row, {
        onClosed: scheduleRefreshAfterPopup,
        ...(processPopupId ? { popupId: processPopupId } : {}),
      });
    },
    [kfInstance, onOpenRow, processPopupId, scheduleRefreshAfterPopup],
  );

  const handleCreate = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      await openUserHubSubtaskProcessCreatePopup(kfInstance, {
        onClosed: scheduleRefreshAfterPopup,
        ...(processPopupId ? { popupId: processPopupId } : {}),
      });
    } finally {
      setCreating(false);
    }
  }, [creating, kfInstance, processPopupId, scheduleRefreshAfterPopup]);

  const tableTitle = myTeamMode
    ? 'My Team subtasks'
    : taskScope === 'created'
      ? 'Subtasks Created by Me'
      : 'Subtasks Assigned to me';

  const colSpan = (showDraftBulkSelect ? 1 : 0) + 7;
  const isTableLoading = myTeamMode ? Boolean(myTeamLoading) : processSubtasksLoading;

  return (
    <div
      className={
        embedded
          ? 'min-w-0'
          : 'min-h-screen overflow-x-clip bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff]'
      }
    >
      <div className={embedded ? 'space-y-4' : 'mx-auto min-w-0 max-w-[1800px] space-y-4 p-3 pb-6 sm:p-6'}>
        {!embedded ? (
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <UserHubWelcome
              greeting={greeting}
              firstName={firstName}
              displayRole="Employee"
              email={loginEmail || scopeUser?.Email}
              subtitle="Your subtasks · Employee"
              className="mb-0"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex min-h-[40px] w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1E88E5] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-auto sm:rounded-2xl sm:text-sm"
            >
              {creating ? (
                <i className="ri-loader-4-line animate-spin" aria-hidden />
              ) : (
                <i className="ri-add-line" aria-hidden />
              )}
              {creating ? 'Creating…' : 'Create subtask'}
            </button>
          </div>
        ) : null}

        {myTeamMode ? (
          isTableLoading ? (
            <p className="text-[11px] font-medium text-slate-500">
              <i className="ri-loader-4-line mr-1 inline-block animate-spin" />
              Loading My Team subtasks…
            </p>
          ) : null
        ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-sm sm:p-4">
          <UserHubTaskToolbar
            taskScope={taskScope}
            onTaskScopeChange={handleTaskScopeChange}
            createdTotal={subtaskCounts.created}
            assignedTotal={subtaskCounts.assignedOpen + subtaskCounts.assignedClosed}
            createdStatusFilter={createdStatusFilter}
            onCreatedStatusChange={setCreatedStatusFilter}
            statusCounts={statusCounts}
            assignedStatus={assignedStatus}
            onAssignedStatusChange={setAssignedStatus}
            assignedOpenCount={subtaskCounts.assignedOpen}
            assignedClosedCount={subtaskCounts.assignedClosed}
            showDeleteDrafts={showDraftBulkSelect}
            selectedDraftCount={selectedDraftIds.size}
            deletingDrafts={deletingDrafts}
            onDeleteDrafts={handleDeleteDrafts}
            assignedLabel="Subtasks Assigned to me"
            createdLabel="Subtasks Created by Me"
            ownershipAriaLabel="Subtask ownership"
          />
          {isTableLoading ? (
            <p className="mt-2 text-[11px] font-medium text-slate-500">
              <i className="ri-loader-4-line mr-1 inline-block animate-spin" />
              Loading {taskScope === 'created' ? 'created' : 'assigned'} subtasks…
            </p>
          ) : null}
        </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-200/40">
          <div className="flex flex-col gap-2 border-b border-slate-100 bg-gradient-to-r from-white to-indigo-50/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-800 sm:text-base">{tableTitle}</h3>
              <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
                {tableTotal} subtask{tableTotal === 1 ? '' : 's'}
                {tableTotalPages > 1 ? ` · ${PT_TABLE_PAGE_SIZE} per page` : ''}
                <span className="hidden sm:inline">{' · tap a row to open'}</span>
              </p>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-end sm:gap-2">
              <div className="relative w-full sm:order-2 sm:w-56">
                <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search subtasks..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none shadow-sm focus:border-[#1E88E5] sm:h-[2.25rem]"
                />
              </div>
              <label className="flex min-w-0 flex-col gap-1 sm:order-1 sm:min-w-[11rem]">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Period
                </span>
                <DashboardPeriodPicker
                  mode={periodPickerState.mode}
                  range={periodPickerState.range}
                  ranges={periodPickerState.ranges}
                  parts={periodPickerState.parts}
                  fyStartYear={periodPickerState.fyStartYear}
                  summaryLabel={periodPickerState.summaryLabel}
                  onChange={handlePeriodChange}
                  className="w-full sm:min-w-[11rem]"
                  triggerClassName="rounded-xl bg-white py-2 shadow-sm text-xs sm:text-sm min-h-[2.5rem] sm:min-h-[2.25rem]"
                />
              </label>
            </div>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {showDraftBulkSelect ? (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all draft subtasks on this page"
                        checked={allDraftPageSelected}
                        onChange={(e) => handleToggleAllDraftsSelect(e.target.checked, draftPageRowIds)}
                        className="h-4 w-4 rounded border-slate-300 text-[#1E62F0] focus:ring-[#1E62F0]"
                      />
                    </th>
                  ) : null}
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Subtask
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Parent task
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Assigned to
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Priority
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Created
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Aging
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-slate-500">
                      No subtasks found
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => {
                    const draftId = showDraftBulkSelect ? resolveSubtaskDraftDeleteId(row) : '';
                    return (
                      <tr
                        key={row.id}
                        onClick={() => handleOpenRow(row)}
                        className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/80"
                      >
                        {showDraftBulkSelect ? (
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Select draft ${row.subtaskName || ''}`}
                              checked={draftId ? selectedDraftIds.has(draftId) : false}
                              onChange={() => handleToggleDraftSelect(draftId)}
                              className="h-4 w-4 rounded border-slate-300 text-[#1E62F0] focus:ring-[#1E62F0]"
                            />
                          </td>
                        ) : null}
                        <td className="px-5 py-3">
                          <p className="max-w-[220px] truncate text-sm text-slate-800">{row.subtaskName}</p>
                          {row.parentTaskId && row.parentTaskId !== '—' ? (
                            <p className="mt-0.5 text-[10px] text-slate-400">{row.parentTaskId}</p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-block max-w-[160px] truncate rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] text-[#1E88E5]">
                            {row.parentTaskName || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <PtUserAvatar
                            name={row.assignedTo}
                            initials={row.assigneeAvatar}
                            sizeClass="h-6 w-6"
                            textClass="text-[10px]"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 sm:text-xs">
                            {row.priority && row.priority !== '—' ? row.priority : '—'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-700">
                          {row.createdDate || '—'}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              !isSubtaskCompleted(row.status) && (row.agingDays ?? 0) > 21
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {row.agingDays ?? 0}d
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex rounded-lg px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${statusBadgeClass(row.status)}`}
                          >
                            {row.status || '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 p-3 lg:hidden">
            {pageRows.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">No subtasks found</p>
            ) : (
              pageRows.map((row) => {
                const draftId = showDraftBulkSelect ? resolveSubtaskDraftDeleteId(row) : '';
                return (
                  <div
                    key={row.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-start gap-2">
                      {showDraftBulkSelect ? (
                        <input
                          type="checkbox"
                          aria-label={`Select draft ${row.subtaskName || ''}`}
                          checked={draftId ? selectedDraftIds.has(draftId) : false}
                          onChange={() => handleToggleDraftSelect(draftId)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1E62F0] focus:ring-[#1E62F0]"
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleOpenRow(row)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                            {row.subtaskName}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(row.status)}`}
                          >
                            {row.status || '—'}
                          </span>
                        </div>
                        {row.parentTaskName && row.parentTaskName !== '—' ? (
                          <p className="mt-0.5 truncate text-[11px] text-[#1E88E5]">
                            {row.parentTaskName}
                          </p>
                        ) : null}
                        <div className="mt-2 flex min-w-0 items-center gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                          <PtUserAvatar
                            name={row.assignedTo}
                            initials={row.assigneeAvatar}
                            sizeClass="h-6 w-6"
                            textClass="text-[10px]"
                          />
                          <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                            {row.priority && row.priority !== '—' ? row.priority : '—'}
                          </span>
                          <span className="shrink-0 whitespace-nowrap">{row.agingDays ?? 0}d aging</span>
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <TablePaginationBar
            page={safeTablePage}
            total={tableTotal}
            pageSize={PT_TABLE_PAGE_SIZE}
            onPageChange={setTablePage}
          />
        </div>
      </div>
    </div>
  );
}
