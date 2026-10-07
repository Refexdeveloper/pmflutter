import { useCallback, useContext, useEffect, useMemo, useState, useRef, Fragment } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AppLayout from './components/feature/AppLayout.jsx';
import DashboardDetailModal from './components/DashboardDetailModal.jsx';
import PtSelect from './components/PtSelect.jsx';
import DashboardPeriodPicker, { getEmptyPeriodState } from './components/DashboardPeriodPicker.jsx';
import TablePaginationBar, { PT_TABLE_PAGE_SIZE } from './components/TablePaginationBar.jsx';
import {
  TableColumnHeader,
  distinctFilterOptions,
  toggleSortState,
  compareText,
  compareNumber,
  compareDateValue,
} from './components/TableColumnHeaders.jsx';
import SatelliteOrbitMenu from './components/SatelliteOrbitMenu.jsx';
import SubtaskAccordionRow from './components/SubtaskAccordionRow.jsx';
import CompletedStatusUpdate from './components/CompletedStatusUpdate.jsx';
import PtUserAvatar from './components/PtUserAvatar.jsx';
import UserHubSubTasksPage from './UserHubSubTasksPage.jsx';
import { PROJECT_TASK_SATELLITE_OPTIONS } from './lib/kfSatelliteCreate.js';
import { KissflowSDKContext, kf } from './sdk/index.js';
import {
  toInitials,
  enrichProjectScheduleHealth,
  isClosedProjectStatus,
} from './lib/kfProjectDashboard.js';
import { fetchEmployeeDashboardProjects } from './lib/kfEmployeeProjectsReport.js';
import {
  createTaskInstance,
  createSubtaskInstance,
  fetchAllSubtasks,
  filterSubtasksForTask,
} from './lib/kfProjectTrackerKarthika.js';
import { fetchMyTeamProjects } from './lib/kfMyTeamProjects.js';
import {
  fetchMyTeamTasks,
} from './lib/kfMyTeamTasks.js';
import { fetchMyTeamSubtasks } from './lib/kfMyTeamSubtasks.js';
import { fetchSubtaskAdminDetailById } from './lib/kfSubtaskTracker.js';
import {
  deleteTaskDraftRecords,
  resolveTaskDraftDeleteId,
} from './lib/kfPmTaskProcessItems.js';
import { fetchEmployeeTasksByScope } from './lib/kfEmployeeTasksReport.js';
import { countCreatedStatuses, filterHubScopeRows, isClosedWorkRow } from './lib/pmHubLoginLists.js';
import {
  fetchTaskTrackerData,
  mapProcessSubtaskItem,
  resolveTaskBusinessIdFromRow,
  isTaskCompleted,
  resolveProjectFieldsFromRaw,
  enrichTasksWithProjectCatalog,
} from './lib/kfTaskTracker.js';
import {
  matchesCreatedDateRange,
} from './lib/dashboardCreatedDateFilters.js';
import {
  collectUniqueDimensionValues,
  hasActivePortfolioDimensionFilters,
  isInformationTechnologyCategory,
  rowMatchesPortfolioDimensions,
  taskMatchesPortfolioDimensions,
} from './lib/dashboardDimensionFilters.js';
import { requestOpenTaskDetails } from './lib/pmTaskDetails.js';
import { requestOpenSubtaskDetails } from './lib/pmSubtaskDetails.js';
import { taskRowToFormDefaults, subtaskRowToFormDefaults } from './lib/pmFormDefaults.js';

/** Adaptive Period picker → single range or multi-window (FY H/Q multi-select). */
function resolveUsptPeriodCreatedRanges(periodFrom, periodTo, periodRanges) {
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

function rowMatchesAnyCreatedRange(row, ranges) {
  if (!Array.isArray(ranges) || ranges.length === 0) return true;
  return ranges.some((range) => matchesCreatedDateRange(row, range));
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Kissflow popup ids for UserSpecificPT — My Work view/create + My Team create only */
const USPT_POPUP_IDS = {
  project: 'Popup_OBRKd64ROV',
  task: 'Popup_V6Y6naBre6',
  subtask: 'Popup_RJMQ6gy18i',
};

const USPT_POPUP_SIZE = {
  width: 960,
  height: 720,
  popupWidth: '960px',
  popupHeight: '720px',
};

/** Kissflow app global — persists UserSpecificPT table column filters across refresh. */
const USPT_PAGE_FILTERS_VAR = 'PageFilters';

const USPT_DEFAULT_TABLE_FILTERS = {
  nameFilter: 'all',
  ownerOrProjectFilter: 'all',
  assigneeFilter: 'all',
  priorityOrHealthFilter: 'all',
  statusFilter: 'all',
  taskOwnershipScope: 'assigned',
  assignedStatus: 'open',
  createdStatusFilter: 'Draft',
};

function usptPageFiltersViewKey(scope, mode) {
  return `${String(scope || 'My Work')}|${String(mode || 'Tasks')}`;
}

function normalizeUsptPageFilters(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readUsptPageFilters(kfInstance) {
  const sdk = resolveKfSdk(kfInstance);
  if (!sdk?.app?.getVariable) return null;
  try {
    return normalizeUsptPageFilters(await sdk.app.getVariable(USPT_PAGE_FILTERS_VAR));
  } catch {
    return null;
  }
}

async function writeUsptPageFilters(kfInstance, data) {
  const sdk = resolveKfSdk(kfInstance);
  if (!sdk?.app?.setVariable) return;
  try {
    await sdk.app.setVariable(USPT_PAGE_FILTERS_VAR, JSON.stringify(data ?? {}));
  } catch {
    /* ignore — variable may be missing in local/dev */
  }
}

function pickUsptTableFilters(source = {}) {
  const pick = (key, fallback) => {
    const v = source?.[key];
    return v == null || v === '' ? fallback : v;
  };
  return {
    nameFilter: pick('nameFilter', USPT_DEFAULT_TABLE_FILTERS.nameFilter),
    ownerOrProjectFilter: pick('ownerOrProjectFilter', USPT_DEFAULT_TABLE_FILTERS.ownerOrProjectFilter),
    assigneeFilter: pick('assigneeFilter', USPT_DEFAULT_TABLE_FILTERS.assigneeFilter),
    priorityOrHealthFilter: pick(
      'priorityOrHealthFilter',
      USPT_DEFAULT_TABLE_FILTERS.priorityOrHealthFilter,
    ),
    statusFilter: pick('statusFilter', USPT_DEFAULT_TABLE_FILTERS.statusFilter),
    taskOwnershipScope: pick('taskOwnershipScope', USPT_DEFAULT_TABLE_FILTERS.taskOwnershipScope),
    assignedStatus: pick('assignedStatus', USPT_DEFAULT_TABLE_FILTERS.assignedStatus),
    createdStatusFilter: pick('createdStatusFilter', USPT_DEFAULT_TABLE_FILTERS.createdStatusFilter),
  };
}

/** After Kissflow remounts this page (popup close refresh), jump back to the table. */
const USPT_RETURN_TO_TABLE_KEY = 'userSpecificPT:returnToTable';

function markUsptReturnToTable() {
  try {
    sessionStorage.setItem(USPT_RETURN_TO_TABLE_KEY, '1');
  } catch {
    /* ignore */
  }
}

function peekUsptReturnToTable() {
  try {
    return sessionStorage.getItem(USPT_RETURN_TO_TABLE_KEY) === '1';
  } catch {
    return false;
  }
}

function clearUsptReturnToTable() {
  try {
    sessionStorage.removeItem(USPT_RETURN_TO_TABLE_KEY);
  } catch {
    /* ignore */
  }
}

function resolveKfSdk(kfInstance) {
  return kfInstance ?? (typeof window !== 'undefined' ? window.kf : null) ?? kf;
}

function resolveRowPopupIds(row) {
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

function openUsptInAppForm(popupId, row) {
  const isSubtask = popupId === USPT_POPUP_IDS.subtask || /subtask/i.test(String(popupId || ''));
  const hasRow = Boolean(row && (row.id || row.InstanceID || row.taskName || row.subtaskName || row.name));
  if (isSubtask) {
    requestOpenSubtaskDetails(hasRow ? subtaskRowToFormDefaults(row) : {});
    return;
  }
  requestOpenTaskDetails(hasRow ? taskRowToFormDefaults(row) : {});
}

function openUsptKissflowPopup(kfInstance, popupId, instanceId, activityId, row = null) {
  const sdk = resolveKfSdk(kfInstance);
  if (typeof sdk?.app?.page?.openPopup !== 'function') {
    openUsptInAppForm(popupId, row);
    return true;
  }
  if (!instanceId || !activityId) {
    openUsptInAppForm(popupId, row);
    return true;
  }
  try {
    markUsptReturnToTable();
    const p = sdk.app.page.openPopup(popupId, {
      ActivityID: activityId,
      ActivityInstanceID: activityId,
      InstanceID: instanceId,
      ...USPT_POPUP_SIZE,
    });
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('UserSpecificPT popup failed:', err));
    }
    return true;
  } catch (err) {
    console.warn('UserSpecificPT popup threw', err);
    return false;
  }
}

/** My Work project open — CaseID only (same pattern as EmployeeDashboard). */
function resolveUsptProjectCaseId(row) {
  const raw = row?.raw ?? row ?? {};
  return String(
    raw?._id ??
      raw?._item_id ??
      row?.CaseID ??
      row?.caseId ??
      row?.id ??
      '',
  ).trim();
}

function openUsptProjectPopup(kfInstance, caseId) {
  const sdk = resolveKfSdk(kfInstance);
  if (typeof sdk?.app?.page?.openPopup !== 'function') {
    console.warn('UserSpecificPT project popup: openPopup not available');
    return false;
  }
  if (!caseId) {
    console.warn('UserSpecificPT project popup: missing CaseID');
    sdk?.client?.showInfo?.('Missing CaseID for this project.');
    return false;
  }
  try {
    markUsptReturnToTable();
    const p = sdk.app.page.openPopup(USPT_POPUP_IDS.project, {
      CaseID: caseId,
      ...USPT_POPUP_SIZE,
    });
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('UserSpecificPT project popup failed:', err));
    }
    return true;
  } catch (err) {
    console.warn('UserSpecificPT project popup threw', err);
    return false;
  }
}

function mapUsptTaskToDetailRow(row) {
  return {
    id: row.id,
    taskId: row.id,
    taskName: row.name,
    projectName: row.project,
    projectId: row.projectId,
    assignedTo: row.assignee,
    startDate: row.start,
    endDate: row.end,
    priority: row.priority,
    status: row.status,
    raw: row.raw ?? row,
  };
}

function mapUsptSubtaskToDetailRow(sub) {
  const r = sub?.raw && typeof sub.raw === 'object' ? sub.raw : {};
  const name =
    String(
      r?.Sub_task_Name ||
        r?.Sub_Task_Name ||
        r?.Subtask_Name ||
        sub.subtaskName ||
        sub.taskName ||
        sub.name ||
        '',
    ).trim() ||
    String(r?.SubTask_Summary || sub.summary || '').trim() ||
    'Untitled subtask';
  const parentFromTaskId =
    r?.Task_ID && typeof r.Task_ID === 'object'
      ? String(r.Task_ID.Sub_Task_Name || r.Task_ID.Sub_task_Name || r.Task_ID.Name || '').trim()
      : '';

  return {
    id: sub.id || r._id,
    taskId: String(r?.Task_ID_Hidden || sub.parentTaskBusinessId || sub.parentTaskId || '').trim() || '—',
    taskName: name,
    summary: String(r?.SubTask_Summary || sub.summary || name || '—').trim() || '—',
    parentTaskName: parentFromTaskId || sub.parentTaskName || '—',
    parentTaskId: String(r?.Task_ID_Hidden || sub.parentTaskId || '').trim() || '—',
    projectName: sub.projectName || '—',
    projectId: sub.projectId || '—',
    assignedTo:
      (r?.Assignee_1 && typeof r.Assignee_1 === 'object' ? r.Assignee_1.Name : '') ||
      sub.assignedTo ||
      sub.assignee ||
      '—',
    createdBy:
      (r?._created_by && typeof r._created_by === 'object' ? r._created_by.Name : '') ||
      sub.createdBy ||
      '—',
    createdDate: sub.createdDate || '—',
    priority: String(r?.Sub_task_Priority || sub.priority || '—').trim() || '—',
    status: String(r?.TStatus || sub.status || '—').trim() || '—',
    delayDays: Number(sub.delayDays ?? 0),
    agingDays: Number(sub.agingDays ?? 0),
    InstanceID: sub.InstanceID || r._id || sub._id || sub.id,
    ActivityID: sub.ActivityID || r._activity_instance_id || sub._activity_instance_id,
    raw: Object.keys(r).length ? r : (sub.raw ?? sub),
  };
}

function UsptTaskSubtasksPanel({
  task,
  processSubtasks,
  onOpenSubtask,
  onCreateSubtask,
  creating = false,
  compact = false,
}) {
  const subtasks = useMemo(
    () => filterSubtasksForTask(processSubtasks, resolveTaskBusinessIdFromRow(task)),
    [processSubtasks, task],
  );
  const completed = isTaskCompleted(task?.status);
  const canAddSubtask = typeof onCreateSubtask === 'function' && !completed;

  return (
    <div className={`space-y-2 ${compact ? 'pl-1 sm:pl-2' : 'pl-2 sm:pl-4'}`}>
      {subtasks.length === 0 ? (
        <p className="text-[11px] text-[#7F8C8D]">
          {completed ? 'No subtasks on this completed task.' : 'No subtasks yet.'}
        </p>
      ) : (
        subtasks.map((sub) => (
            <SubtaskAccordionRow
              key={sub.id}
              sub={sub}
              compact={compact}
              onClick={() => onOpenSubtask?.(sub)}
              statusSlot={
                <span className="inline-flex items-center gap-2">
                  <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeColor(sub.status)}`}>
                    {sub.status}
                  </span>
                  <CompletedStatusUpdate status={sub.status} onUpdate={() => onOpenSubtask?.(sub)} />
                </span>
              }
            />
          ))
      )}
      {canAddSubtask ? (
        <button
          type="button"
          disabled={creating}
          onClick={(e) => {
            e.stopPropagation();
            onCreateSubtask(task);
          }}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-[#1E88E5]/30 bg-[#E8F0FE] px-3 py-1.5 text-[11px] font-semibold text-[#1E88E5] transition hover:bg-[#dbeafe] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? <i className="ri-loader-4-line animate-spin" aria-hidden /> : <i className="ri-add-line" aria-hidden />}
          Add subtask
        </button>
      ) : completed && subtasks.length > 0 ? (
        <p className="text-[10px] font-medium text-slate-400">
          Subtask creation is closed for completed tasks.
        </p>
      ) : null}
    </div>
  );
}

/** Fixed-width chevron slot so task names stay aligned when expand is unavailable. */
function TaskExpandToggle({
  visible,
  expanded,
  onToggle,
  sizeClass = 'h-6 w-6',
  iconClass = 'text-base',
  ariaLabelExpand = 'Expand subtasks',
  ariaLabelCollapse = 'Collapse subtasks',
}) {
  if (!visible) {
    return <span className={`${sizeClass} shrink-0`} aria-hidden />;
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex ${sizeClass} shrink-0 items-center justify-center self-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-[#1E88E5]`}
      aria-label={expanded ? ariaLabelCollapse : ariaLabelExpand}
      aria-expanded={expanded}
    >
      <i
        className={`ri-arrow-${expanded ? 'down' : 'right'}-s-line leading-none ${iconClass}`}
        aria-hidden
      />
    </button>
  );
}

function healthToRag(health) {
  const h = String(health || '').trim();
  if (h === 'On Track' || h === 'Completed') return 'Green';
  if (h === 'At Risk') return 'Amber';
  if (h === 'Delayed') return 'Red';
  return undefined;
}

function mapUsptProjectToDetailRow(row) {
  const enriched = enrichProjectScheduleHealth(row);
  const dashboardRaw = enriched?.raw;
  if (
    dashboardRaw &&
    typeof dashboardRaw === 'object' &&
    (dashboardRaw.displayId || dashboardRaw.revisionHistory || dashboardRaw.originalEndDate)
  ) {
    return enrichProjectScheduleHealth({
      ...dashboardRaw,
      status: enriched.status ?? dashboardRaw.status,
      progress: enriched.progress ?? dashboardRaw.progress,
      startDate: enriched.start ?? dashboardRaw.startDate,
      end: enriched.end,
      originalEndDate: enriched.end || dashboardRaw.originalEndDate,
      revisedEndDate: enriched.revisedEndDate ?? dashboardRaw.revisedEndDate,
    });
  }
  return {
    id: enriched.id,
    displayId: enriched.projectId || enriched.id,
    name: enriched.name,
    owner: enriched.owner,
    ownerAvatar: toInitials(enriched.owner),
    progress: enriched.progress,
    rag: enriched.rag || healthToRag(enriched.health),
    status: enriched.status,
    delayDays: Number(enriched.delayDays ?? 0),
    originalEndDate: enriched.end,
    revisedEndDate: enriched.revisedEndDate || null,
    revisedCount: Number(enriched.revisedCount ?? enriched.raw?.revisedCount ?? 0) || 0,
    hasRevision:
      Boolean(enriched.hasRevision) ||
      Number(enriched.revisedCount ?? enriched.raw?.revisedCount ?? 0) > 0,
    revisionHistory: Array.isArray(enriched.revisionHistory)
      ? enriched.revisionHistory
      : Array.isArray(enriched.raw?.revisionHistory)
        ? enriched.raw.revisionHistory
        : [],
    startDate: enriched.start,
    priority: enriched.priority,
    lineOfBusiness: enriched.category,
    entity: enriched.category,
    raw: enriched.raw ?? enriched,
  };
}

function mapTaskForUserSpecificPT(t) {
  const delayDays = Number(t?.delayDays ?? 0);
  const raw = t?.raw ?? t;
  const assignedRef = raw?.Assigned_To || raw?._created_by || {};

  const fromMapped = resolveProjectFieldsFromRaw({
    ...(raw && typeof raw === 'object' ? raw : {}),
    Project_ID: raw?.Project_ID ?? t?.projectId,
    Project_Name: t?.projectName,
  });

  // Prefer an already-mapped human title; otherwise resolve from Kissflow lookup fields.
  let project = String(t?.projectName || t?.project || '').trim();
  if (!project || project === '—' || project === '-' || project.toLowerCase() === 'n/a') {
    project = fromMapped.projectName;
  }
  if (!project || project === '—') project = '—';

  const projectId = String(
    t?.projectId
      || fromMapped.projectId
      || '',
  ).trim();

    return {
    id: String(t?.taskId || t?.id || '').trim(),
    taskId: String(t?.taskId || t?.id || '').trim(),
    InstanceID: String(t?.InstanceID || t?._id || '').trim(),
    ActivityID: String(t?.ActivityID || '').trim(),
      projectId,
    project,
    name: t?.taskName || '—',
    assignee: t?.assignedTo || '—',
    assigneeId: String(assignedRef?._id || assignedRef?.Id || '').trim(),
    assigneeEmail: String(assignedRef?.Email || assignedRef?.email || '').trim(),
    initials: t?.assigneeAvatar || toInitials(t?.assignedTo),
    start: t?.startDate || '—',
    end: t?.revisedEndDate || t?.endDate || '—',
    revisedEndDate: t?.revisedEndDate || null,
    originalEndDate: t?.originalEndDate || t?.endDate || null,
    revisedCount: Number(t?.revisedCount ?? 0) || 0,
    hasRevision: Boolean(t?.hasRevision),
    revisionHistory: Array.isArray(t?.revisionHistory) ? t.revisionHistory : [],
    agingDays: Number(t?.agingDays ?? 0),
    delayDays,
      delay: delayDays > 0 ? `+${delayDays}d` : 'On time',
    priority: String(t?.raw?.Task_Priority || t?.raw?.Priority || t?.priority || 'Medium').trim() || 'Medium',
    status: t?.status || '—',
    companyName: String(t?.companyName || t?.entity || '').trim(),
    lineOfBusiness: String(t?.lineOfBusiness || t?.functions || '').trim(),
    functionType: String(t?.functionType || '').trim(),
    createdAt: t?.createdAt || null,
    raw,
  };
}

const TASK_ROWS_MY = [
  { name: 'Check The Filed', id: 'Task-PRJ-RIL_101-0005-001', project: 'Expense Management', assignee: 'Pravin R', initials: 'PR', start: '2026-04-05', end: '2026-04-05', delay: '+25d', priority: 'High', status: 'Open' },
  { name: 'Review Budget Sheet', id: 'Task-PRJ-RIL_101-0006-002', project: 'Expense Management', assignee: 'Suriya V', initials: 'SV', start: '2026-04-15', end: '2026-04-20', delay: '+5d', priority: 'Medium', status: 'In Progress' },
  { name: 'Update Vendor List', id: 'Task-PRJ-RIL_101-0006-003', project: 'Expense Management', assignee: 'Pravin R', initials: 'PR', start: '2026-04-18', end: '2026-04-20', delay: '+2d', priority: 'Low', status: 'Open' },
  { name: 'Data Validation', id: 'Task-PRJ-RIL_101-0007-001', project: 'Project Red', assignee: 'Raghul J E', initials: 'RJ', start: '2026-04-01', end: '2026-04-30', delay: '+4d', priority: 'High', status: 'Open' },
  { name: 'Testing Module', id: 'Task-PRJ-RIL_101-0008-001', project: 'Project two', assignee: 'Pravin R', initials: 'PR', start: '2026-04-01', end: '2026-04-11', delay: '+19d', priority: 'Medium', status: 'Under Review' },
];

const TASK_ROWS_TEAM = [
  { name: 'Design Approval', id: 'Task-PRJ-RIL_101-0006-001', project: 'Refex Towers 7 & 8', assignee: 'Pravin R', initials: 'PR', start: '2026-04-05', end: '2026-04-12', delay: '+2d', priority: 'Medium', status: 'Open' },
  { name: 'Client Feedback Round 2', id: 'Task-PRJ-RIL_101-0006-002', project: 'Refex Towers 7 & 8', assignee: 'Raghul J E', initials: 'RJ', start: '2026-04-05', end: '2026-04-12', delay: '+6d', priority: 'High', status: 'In Progress' },
  { name: 'Site Inspection', id: 'Task-PRJ-RIL_101-0006-003', project: 'Asset Management', assignee: 'Suriya V', initials: 'SV', start: '2026-04-01', end: '2026-04-17', delay: '+3d', priority: 'Low', status: 'Open' },
  { name: 'Cost Estimation', id: 'Task-PRJ-RIL_101-0006-004', project: 'Asset Management', assignee: 'Raghul J E', initials: 'RJ', start: '2026-04-03', end: '2026-04-20', delay: 'On time', priority: 'Low', status: 'Completed' },
  { name: 'Monthly Report', id: 'Task-PRJ-RIL_101-0006-005', project: 'Expense Management', assignee: 'Suriya V', initials: 'SV', start: '2026-04-20', end: '2026-05-07', delay: 'On time', priority: 'Low', status: 'Completed' },
];

const PROJECT_ROWS_MY = [
  { name: 'Expense Management', owner: 'Raghul J E', progress: 89, tasks: 8, completed: 5, pending: 3, delay: 'On time', end: '2026-05-05', health: 'On Track' },
  { name: 'Asset management', owner: 'Raghul J E', progress: 42, tasks: 12, completed: 3, pending: 9, delay: '+12d', end: '2026-04-23', health: 'At Risk' },
  { name: 'Refex Towers 7 & 8', owner: 'Raghul J E', progress: 74, tasks: 7, completed: 4, pending: 3, delay: 'On time', end: '2026-05-12', health: 'On Track' },
  { name: 'PMT', owner: 'Raghul J E', progress: 36, tasks: 9, completed: 2, pending: 7, delay: '+18d', end: '2026-04-19', health: 'Delayed' },
  { name: 'Travel Management', owner: 'Raghul J E', progress: 30, tasks: 6, completed: 1, pending: 5, delay: '+14d', end: '2026-04-16', health: 'Delayed' },
];

const PROJECT_ROWS_TEAM = [
  { name: 'Refex Towers 7 & 8', owner: 'Raghul J E', progress: 89, tasks: 10, completed: 7, pending: 3, delay: 'On time', end: '2026-05-20', health: 'On Track' },
  { name: 'Expense Management', owner: 'Pravin R', progress: 47, tasks: 11, completed: 5, pending: 6, delay: '+5d', end: '2026-05-02', health: 'At Risk' },
  { name: 'Asset management', owner: 'Suriya V', progress: 67, tasks: 8, completed: 5, pending: 3, delay: '+2d', end: '2026-05-04', health: 'At Risk' },
  { name: 'PMT', owner: 'Raghul J E', progress: 30, tasks: 9, completed: 2, pending: 7, delay: '+14d', end: '2026-04-15', health: 'Delayed' },
  { name: 'Travel Management', owner: 'Pravin R', progress: 40, tasks: 9, completed: 3, pending: 6, delay: '+9d', end: '2026-04-12', health: 'Delayed' },
];

const TEAM_ROWS = [
  { name: 'Pravin R', role: 'Project Manager', initials: 'PR', tasks: 12, completed: 4, overdue: 3, color: 'bg-blue-500' },
  { name: 'Raghul J E', role: 'You', initials: 'RJ', tasks: 8, completed: 3, overdue: 1, color: 'bg-violet-500' },
  { name: 'Suriya V', role: 'Team Member', initials: 'SV', tasks: 6, completed: 2, overdue: 1, color: 'bg-amber-500' },
  { name: 'Shravan', role: 'Team Member', initials: 'S', tasks: 5, completed: 2, overdue: 0, color: 'bg-cyan-500' },
];

function badgeColor(status) {
  const s = String(status || '').trim().toLowerCase();
  if (!s) return 'bg-slate-100 text-slate-700';
  if (s.includes('complete') || s === 'closed' || s === 'done') return 'bg-emerald-100 text-emerald-700';
  if (s.includes('overdue')) return 'bg-rose-100 text-rose-700';
  if (s.includes('progress')) return 'bg-blue-100 text-blue-700';
  if (s.includes('pending') || s.includes('plan') || s.includes('not start')) return 'bg-amber-100 text-amber-700';
  return 'bg-violet-100 text-violet-700';
}

const myWorkRowCreateLock = new Set();

function resolveProjectBusinessId(project) {
  const raw = project?.raw ?? project ?? {};
  const displayId = String(raw?.displayId ?? project?.displayId ?? project?.projectId ?? '').trim();
  if (displayId && !displayId.startsWith('Pk')) return displayId;

  const candidates = [
    raw?.Project_ID,
    raw?.Project_Code,
    project?.Project_ID,
    project?.Project_Code,
    project?.projectId,
  ];
  for (const candidate of candidates) {
    const value = String(typeof candidate === 'object' ? (candidate?.Project_ID || candidate?._item_id || '') : candidate ?? '').trim();
    if (value && !value.startsWith('Pk')) return value;
  }

  return displayId || String(project?.id ?? '').trim();
}

function filterTasksForProject(allTasks, project) {
  const rows = Array.isArray(allTasks) ? allTasks : [];
  const projectIds = new Set(
    [
      ...(Array.isArray(project?.projectIds) ? project.projectIds : []),
      project?.id,
      project?.projectId,
      project?.displayId,
    ]
      .map((v) => String(v || '').trim())
      .filter(Boolean),
  );
  const pname = String(project?.name ?? '').trim().toLowerCase();
  if (!projectIds.size && !pname) return [];

  return rows.filter((t) => {
    const taskIds = [
      ...(Array.isArray(t?.projectIds) ? t.projectIds : []),
      t?.projectId,
    ]
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    if (taskIds.some((id) => projectIds.has(id))) return true;
    const tProject = String(t?.project ?? '').trim().toLowerCase();
    return Boolean(pname && tProject && tProject === pname);
  });
}

function isEmptyProjectName(projectName) {
  const v = String(projectName ?? '').trim();
  return !v || v === '—' || v === '-' || v.toLowerCase() === 'n/a';
}

function UsptProjectCell({ projectName }) {
  if (isEmptyProjectName(projectName)) {
    return (
      <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-normal text-violet-700 ring-1 ring-violet-200/80">
        Individual Task
      </span>
    );
  }
  return (
    <span className="inline-block max-w-[160px] truncate rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-normal text-[#1E88E5]" title={projectName}>
      {projectName}
    </span>
  );
}

function parseDelayDays(row) {
  if (row?.delayDays != null && row.delayDays !== '') return Number(row.delayDays) || 0;
  const s = String(row?.delay ?? '');
  const m = s.match(/([+-]?\d+)/);
  return m ? Number(m[1]) : 0;
}

function MyWorkProjectTasksPanel({
  project,
  allTasks,
  processSubtasks = [],
  onCreateTask,
  onOpenTask,
  onCreateSubtask,
  onOpenSubtask,
  creating,
  creatingSubtaskTaskId = null,
}) {
  const linkedTasks = useMemo(() => filterTasksForProject(allTasks, project), [allTasks, project]);
  const [nameFilter, setNameFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [expandedTaskIds, setExpandedTaskIds] = useState(() => new Set());

  const nameOptions = useMemo(
    () => distinctFilterOptions(linkedTasks, (t) => t.name, { allLabel: 'All Tasks' }),
    [linkedTasks],
  );
  const assigneeOptions = useMemo(
    () => distinctFilterOptions(linkedTasks, (t) => t.assignee, { allLabel: 'All Assignees' }),
    [linkedTasks],
  );
  const statusOptions = useMemo(
    () => distinctFilterOptions(linkedTasks, (t) => t.status, { allLabel: 'All Status' }),
    [linkedTasks],
  );

  const filtered = useMemo(
    () =>
      linkedTasks.filter((t) => {
        if (nameFilter !== 'all' && t.name !== nameFilter) return false;
        if (assigneeFilter !== 'all' && t.assignee !== assigneeFilter) return false;
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        return true;
      }),
    [linkedTasks, nameFilter, assigneeFilter, statusFilter],
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return compareText(a.name, b.name, dir);
        case 'assignee':
          return compareText(a.assignee, b.assignee, dir);
        case 'start':
          return compareDateValue(a.start, b.start, dir, sortDir);
        case 'end':
          return compareDateValue(a.end, b.end, dir, sortDir);
        case 'revised':
        case 'revisedCount':
          return compareNumber(a.revisedCount, b.revisedCount, dir);
        case 'delay':
          return compareNumber(parseDelayDays(a), parseDelayDays(b), dir);
        case 'status':
          return compareText(a.status, b.status, dir);
        default:
          return 0;
      }
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key) => {
    const next = toggleSortState(sortKey, sortDir, key);
    setSortKey(next.sortKey);
    setSortDir(next.sortDir);
  };

  const toggleTaskExpand = (taskId, event) => {
    event?.stopPropagation?.();
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const NESTED_COLUMNS = [
    { key: 'name', label: 'Task', filter: 'name' },
    { key: 'assignee', label: 'Assignee', filter: 'assignee' },
    { key: 'start', label: 'Start' },
    { key: 'end', label: 'End' },
    { key: 'revised', label: 'Revised' },
    { key: 'delay', label: 'Delay' },
    { key: 'status', label: 'Status', filter: 'status' },
  ];
  const nestedColSpan = NESTED_COLUMNS.length;

  const columnFilterProps = {
    name: { filterValue: nameFilter, onFilterChange: setNameFilter, filterOptions: nameOptions },
    assignee: { filterValue: assigneeFilter, onFilterChange: setAssigneeFilter, filterOptions: assigneeOptions },
    status: { filterValue: statusFilter, onFilterChange: setStatusFilter, filterOptions: statusOptions },
  };

  return (
    <div className="border-t border-slate-200/80 bg-slate-50/95 px-3 py-3 sm:px-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-600 sm:text-xs">
          {sorted.length} task{sorted.length === 1 ? '' : 's'} on this project · chevron expands subtasks
        </p>
        {typeof onCreateTask === 'function' ? (
          <button
            type="button"
            disabled={creating}
            onClick={() => onCreateTask?.(project)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E88E5] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#1565C0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? <i className="ri-loader-4-line animate-spin" aria-hidden /> : <i className="ri-add-line" aria-hidden />}
            Create Task
          </button>
        ) : null}
      </div>

      {linkedTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500">
          {typeof onCreateTask === 'function'
            ? 'No tasks linked yet. Use Create Task to add one.'
            : 'No tasks linked to this project.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                {NESTED_COLUMNS.map((col) => {
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
                      className="px-3 py-2"
                    />
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={nestedColSpan} className="px-3 py-6 text-center text-xs text-slate-500">
                    No tasks match these filters.
                  </td>
                </tr>
              ) : (
                sorted.map((task) => {
                  const childSubtasks = filterSubtasksForTask(
                    processSubtasks,
                    resolveTaskBusinessIdFromRow(task),
                  );
                  const hasExistingSubtasks = childSubtasks.length > 0;
                  const canAddSubtask =
                    typeof onCreateSubtask === 'function' && !isTaskCompleted(task.status);
                  // Keep expand when subtasks already exist (even on completed); only block create.
                  const showNested = hasExistingSubtasks || canAddSubtask;
                  const isExpanded = expandedTaskIds.has(task.id);

                  return (
                    <Fragment key={task.id}>
                      <tr
                        onClick={() => onOpenTask?.(task)}
                        className="cursor-pointer border-t border-slate-100 transition hover:bg-blue-50/40"
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-start gap-1.5">
                            <TaskExpandToggle
                              visible={showNested}
                              expanded={isExpanded}
                              onToggle={(e) => toggleTaskExpand(task.id, e)}
                              sizeClass="h-5 w-5"
                              iconClass="text-sm"
                            />
                            <div className="min-w-0">
                              <p className="text-[11px] font-normal text-slate-800">{task.name}</p>
                              {hasExistingSubtasks ? (
                                <p className="text-[10px] font-medium text-[#FB8C00]">
                                  {childSubtasks.length} subtask{childSubtasks.length === 1 ? '' : 's'}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <PtUserAvatar
                            name={task.assignee}
                            initials={task.initials}
                            sizeClass="h-6 w-6"
                            textClass="text-[9px]"
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-[11px] text-slate-700">{task.start}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-[11px] text-slate-700">{task.end}</td>
                        <td className="px-3 py-2">
                          {Number(task.revisedCount) > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-[#FB8C00]">
                              <i className="ri-refresh-line text-[10px]" />
                              {task.revisedCount}x
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              String(task.delay).includes('+') ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                            }`}
                          >
                            {task.delay}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeColor(task.status)}`}>
                              {task.status}
                            </span>
                            <CompletedStatusUpdate status={task.status} onUpdate={() => onOpenTask?.(task)} />
                          </div>
                        </td>
                      </tr>
                      {showNested && isExpanded ? (
                        <tr className="border-t border-slate-100 bg-slate-50/80">
                          <td colSpan={nestedColSpan} className="px-3 py-3">
                            <UsptTaskSubtasksPanel
                              task={task}
                              processSubtasks={processSubtasks}
                              onOpenSubtask={onOpenSubtask}
                              onCreateSubtask={onCreateSubtask}
                              creating={creatingSubtaskTaskId === task.id}
                              compact
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
      )}
    </div>
  );
}

/** --- KPI section (copied styling from ProjectDashboardPage) --- */
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

function PremiumKPICard({ title, value, subtitle, trend, icon, theme, index, active = false, onClick }) {
  const trendValue = String(trend?.value ?? '').trim();
  const isNegativeTrend = trendValue.startsWith('-');
  return (
    <motion.button
      type="button"
      initial={false}
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
      onClick={onClick}
      className={`
        group relative w-full overflow-hidden rounded-xl border bg-gradient-to-br p-3 text-left sm:rounded-2xl sm:p-4
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

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-[11px] sm:tracking-[0.14em]">
            {title}
          </p>
          <p
            className={`mt-1.5 text-2xl font-bold tabular-nums leading-none tracking-tight sm:mt-2 sm:text-3xl ${theme.valueClass}`}
          >
            {value}
          </p>
          {subtitle ? (
            <p className="mt-1.5 line-clamp-2 text-[11px] font-medium text-slate-400 sm:mt-2 sm:text-xs">{subtitle}</p>
          ) : null}
          {trend ? (
            <p
              className={`mt-2 flex items-center gap-1 text-[11px] font-semibold sm:mt-2.5 sm:text-xs ${
                trend.positive ? 'text-[#22C55E]' : 'text-[#EF4444]'
              }`}
            >
              <i className={`${isNegativeTrend ? 'ri-arrow-down-line' : 'ri-arrow-up-line'} text-xs sm:text-sm`} />
              {trend.value}
            </p>
          ) : null}
          {onClick ? (
            <p className="mt-2 text-[10px] font-semibold text-[#1E88E5] opacity-0 transition-opacity group-hover:opacity-100">
              Click to view →
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
    </motion.button>
  );
}

/** KPI → main table focus (UserSpecificPT) */
const USPT_TASK_KPI_FOCUS = {
  'total-tasks': { status: 'all', label: 'All tasks' },
  completed: { status: 'Completed', label: 'Completed tasks' },
  pending: { status: '__pending__', label: 'Pending tasks' },
  overdue: { status: 'Overdue', label: 'Overdue tasks' },
  delayed: { status: '__delayed__', label: 'Delayed tasks' },
};

const USPT_PROJECT_KPI_FOCUS = {
  'total-projects': { status: 'all', label: 'All projects' },
  'on-track': { status: 'On Track', label: 'On Track projects' },
  completed: { status: 'Completed', label: 'Completed projects' },
  'at-risk': { status: 'At Risk', label: 'At Risk projects' },
  delayed: { status: 'Delayed', label: 'Delayed projects' },
};

const USPT_FOCUS_AREA_KEYS = {
  tasks: {
    'Overdue Tasks': 'overdue',
    'Pending Tasks': 'pending',
    Completed: 'completed',
  },
  projects: {
    'Delayed / At Risk': '__attention__',
    'High Priority': '__high__',
    Completed: 'completed',
  },
};

const EMPTY_HUB_STATUS_COUNTS = {
  Draft: 0,
  'In progress': 0,
  Completed: 0,
  Withdrawn: 0,
  Rejected: 0,
};

const USPT_MODES = ['Projects', 'Tasks', 'SubTasks'];

export default function UserSpecificPT({
  useLayout = false,
  forcedMode = null,
  onModeChange,
} = {}) {
  const { kf: kfFromContext } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null) ?? (typeof kf !== 'undefined' ? kf : null);
  const userName = String(kfInstance?.user?.Name || kfInstance?.user?.FirstName || 'Raghul J E').trim();
  const greetName = String(
    kfInstance?.user?.FirstName || userName.split(/\s+/)[0] || userName,
  ).trim();
  const userEmail = String(kfInstance?.user?.Email || '').trim();
  const userId = String(kfInstance?.user?._id || kfInstance?.user?.Id || '').trim();

  const readSessionJson = (key) => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(key) || 'null');
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const cachedTasksInit = readSessionJson('userSpecificPT:tasks');
  const cachedProjectsInit = readSessionJson('userSpecificPT:projects:v3');

  const [scope, setScope] = useState('My Work');
  const [mode, setMode] = useState(
    USPT_MODES.includes(forcedMode) ? forcedMode : 'Tasks',
  );
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [apiTasks, setApiTasks] = useState(() => cachedTasksInit || []);
  const [apiProjects, setApiProjects] = useState(() => cachedProjectsInit || []);
  // Don't flash empty KPIs when cache already has rows.
  const [apiTasksLoading, setApiTasksLoading] = useState(() => !(cachedTasksInit && cachedTasksInit.length));
  const [apiProjectsLoading, setApiProjectsLoading] = useState(() => !(cachedProjectsInit && cachedProjectsInit.length));
  const [apiError, setApiError] = useState(null);
  const [myTeamProjects, setMyTeamProjects] = useState([]);
  const [myTeamProjectsLoading, setMyTeamProjectsLoading] = useState(false);
  const [myTeamProjectsError, setMyTeamProjectsError] = useState(null);
  const [myTeamTasks, setMyTeamTasks] = useState([]);
  const [myTeamTasksLoading, setMyTeamTasksLoading] = useState(false);
  const [myTeamTasksError, setMyTeamTasksError] = useState(null);
  const [myTeamSubtasks, setMyTeamSubtasks] = useState([]);
  const [myTeamSubtasksLoading, setMyTeamSubtasksLoading] = useState(false);
  const [myTeamSubtasksError, setMyTeamSubtasksError] = useState(null);
  /** My Work → Tasks: same Assigned / Created split as UserHubTasksPage */
  const [taskOwnershipScope, setTaskOwnershipScope] = useState('assigned');
  const [assignedStatus, setAssignedStatus] = useState('open');
  const [createdStatusFilter, setCreatedStatusFilter] = useState('Draft');
  const [hubTableTasks, setHubTableTasks] = useState([]);
  const [hubTableTasksLoading, setHubTableTasksLoading] = useState(false);

  // Pending/myitems often omit Project_Name on the lookup — join to project catalog / admin twins.
  const hubTasksWithProjects = useMemo(
    () => enrichTasksWithProjectCatalog(hubTableTasks, apiProjects, apiTasks),
    [hubTableTasks, apiProjects, apiTasks],
  );
  const [hubTaskCounts, setHubTaskCounts] = useState({
    created: 0,
    assignedOpen: 0,
    assignedClosed: 0,
  });
  const [hubStatusCounts, setHubStatusCounts] = useState(EMPTY_HUB_STATUS_COUNTS);
  const [selectedDraftIds, setSelectedDraftIds] = useState(() => new Set());
  const [deletingDrafts, setDeletingDrafts] = useState(false);
  const emptyPeriod = getEmptyPeriodState();
  const [periodMode, setPeriodMode] = useState(emptyPeriod.mode);
  const [periodFrom, setPeriodFrom] = useState(emptyPeriod.range.from);
  const [periodTo, setPeriodTo] = useState(emptyPeriod.range.to);
  const [periodLabel, setPeriodLabel] = useState(emptyPeriod.summaryLabel);
  const [periodRanges, setPeriodRanges] = useState([]);
  const [periodParts, setPeriodParts] = useState([]);
  const [periodFyStartYear, setPeriodFyStartYear] = useState(null);
  const [companyFilter, setCompanyFilter] = useState('');
  const [lineOfBusinessFilter, setLineOfBusinessFilter] = useState('');
  const [functionTypeFilter, setFunctionTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(USPT_DEFAULT_TABLE_FILTERS.statusFilter);
  const [search, setSearch] = useState('');
  const [ownerOrProjectFilter, setOwnerOrProjectFilter] = useState(
    USPT_DEFAULT_TABLE_FILTERS.ownerOrProjectFilter,
  ); // tasks: project, projects: owner
  const [priorityOrHealthFilter, setPriorityOrHealthFilter] = useState(
    USPT_DEFAULT_TABLE_FILTERS.priorityOrHealthFilter,
  ); // tasks: priority, projects: health
  const [nameFilter, setNameFilter] = useState(USPT_DEFAULT_TABLE_FILTERS.nameFilter);
  const [assigneeFilter, setAssigneeFilter] = useState(USPT_DEFAULT_TABLE_FILTERS.assigneeFilter);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [expandedProjectId, setExpandedProjectId] = useState(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState(() => new Set());
  const [creatingTaskProjectId, setCreatingTaskProjectId] = useState(null);
  const [creatingSubtaskTaskId, setCreatingSubtaskTaskId] = useState(null);
  const [apiProcessSubtasks, setApiProcessSubtasks] = useState([]);
  const [detailModal, setDetailModal] = useState(null);
  const [tablePage, setTablePage] = useState(1);
  const [insightFocus, setInsightFocus] = useState(null);
  const [pageFiltersReady, setPageFiltersReady] = useState(false);
  const tableSectionRef = useRef(null);
  const insightPulseTimerRef = useRef(null);
  const headerStickyRef = useRef(null);
  const pageFiltersCacheRef = useRef(null);
  const skipNextViewFilterResetRef = useRef(false);
  const didRestoreTableScrollRef = useRef(false);

  const isMyWork = scope === 'My Work';
  const isMyWorkTasksHub = isMyWork && mode === 'Tasks';

  const applyUsptTableFilters = useCallback((source) => {
    const next = pickUsptTableFilters(source);
    setNameFilter(next.nameFilter);
    setOwnerOrProjectFilter(next.ownerOrProjectFilter);
    setAssigneeFilter(next.assigneeFilter);
    setPriorityOrHealthFilter(next.priorityOrHealthFilter);
    setStatusFilter(next.statusFilter);
    setTaskOwnershipScope(next.taskOwnershipScope);
    setAssignedStatus(next.assignedStatus);
    setCreatedStatusFilter(next.createdStatusFilter);
  }, []);

  // Restore table filters from Kissflow global `PageFilters` on mount / refresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await readUsptPageFilters(kfInstance);
      if (cancelled) return;
      if (saved) {
        pageFiltersCacheRef.current = saved;
        const nextScope = saved.scope === 'My Team' || saved.scope === 'My Work' ? saved.scope : null;
        const nextMode =
          saved.mode === 'Projects' || saved.mode === 'Tasks' || saved.mode === 'SubTasks'
            ? saved.mode
            : null;
        const viewScope = nextScope || 'My Work';
        const viewMode = nextMode || 'Tasks';
        const viewKey = usptPageFiltersViewKey(viewScope, viewMode);
        const viewFilters =
          saved.byView?.[viewKey] ||
          (saved.nameFilter != null ||
          saved.ownerOrProjectFilter != null ||
          saved.assigneeFilter != null
            ? saved
            : null);
        // Prevent the scope/mode effect from wiping restored filters on first ready tick.
        skipNextViewFilterResetRef.current = true;
        if (nextScope) setScope(nextScope);
        if (nextMode && !USPT_MODES.includes(forcedMode)) setMode(nextMode);
        if (viewFilters) applyUsptTableFilters(viewFilters);
      }
      if (!cancelled) setPageFiltersReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [kfInstance, applyUsptTableFilters, forcedMode]);

  useEffect(() => {
    if (!USPT_MODES.includes(forcedMode)) return;
    setMode((prev) => (prev === forcedMode ? prev : forcedMode));
  }, [forcedMode]);

  // When switching My Work / My Team or Tasks / Projects, restore that view's saved filters.
  useEffect(() => {
    if (!pageFiltersReady) return;
    if (skipNextViewFilterResetRef.current) {
      skipNextViewFilterResetRef.current = false;
      setSortKey('name');
      setSortDir('asc');
      return;
    }
    const viewKey = usptPageFiltersViewKey(scope, mode);
    const viewFilters = pageFiltersCacheRef.current?.byView?.[viewKey];
    applyUsptTableFilters(viewFilters || USPT_DEFAULT_TABLE_FILTERS);
    setSortKey('name');
    setSortDir('asc');
  }, [scope, mode, pageFiltersReady, applyUsptTableFilters]);

  // Persist active table filters into Kissflow global `PageFilters`.
  useEffect(() => {
    if (!pageFiltersReady || !kfInstance) return;
    const viewKey = usptPageFiltersViewKey(scope, mode);
    const viewFilters = pickUsptTableFilters({
      nameFilter,
      ownerOrProjectFilter,
      assigneeFilter,
      priorityOrHealthFilter,
      statusFilter,
      taskOwnershipScope,
      assignedStatus,
      createdStatusFilter,
    });
    const snapshot = {
      v: 1,
      scope,
      mode,
      byView: {
        ...(pageFiltersCacheRef.current?.byView || {}),
        [viewKey]: viewFilters,
      },
    };
    pageFiltersCacheRef.current = snapshot;
    const timer = setTimeout(() => {
      void writeUsptPageFilters(kfInstance, snapshot);
    }, 200);
    return () => clearTimeout(timer);
  }, [
    pageFiltersReady,
    kfInstance,
    scope,
    mode,
    nameFilter,
    ownerOrProjectFilter,
    assigneeFilter,
    priorityOrHealthFilter,
    statusFilter,
    taskOwnershipScope,
    assignedStatus,
    createdStatusFilter,
  ]);

  useEffect(() => {
    setExpandedProjectId(null);
    setExpandedTaskIds(new Set());
    setDetailModal(null);
    setTablePage(1);
    setSelectedDraftIds(new Set());
  }, [scope, mode, search, statusFilter, ownerOrProjectFilter, priorityOrHealthFilter, periodFrom, periodTo, periodMode, nameFilter, assigneeFilter, taskOwnershipScope, assignedStatus, createdStatusFilter]);

  useEffect(() => () => {
    if (insightPulseTimerRef.current) clearTimeout(insightPulseTimerRef.current);
  }, []);

  const scrollToTable = useCallback(() => {
    const align = () => {
      const el = tableSectionRef.current;
      if (!el) return;
      // Header is sticky only from sm+; skip sticky offset on mobile.
      const stickyHeader =
        typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;
      const headerH = stickyHeader
        ? (headerStickyRef.current?.getBoundingClientRect().height ?? 0)
        : 0;
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
    // Wait for filter re-render / layout, then scroll the real page scrollport (.rootDiv).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        align();
        window.setTimeout(align, 80);
      });
    });
  }, []);

  const pulseTableHighlight = useCallback(
    (key, label) => {
      const token = Date.now();
      setInsightFocus({ key, token, pulse: true, label });
      scrollToTable();
      if (insightPulseTimerRef.current) clearTimeout(insightPulseTimerRef.current);
      insightPulseTimerRef.current = setTimeout(() => {
        setInsightFocus((prev) => (prev?.token === token ? { ...prev, pulse: false } : prev));
      }, 2400);
    },
    [scrollToTable],
  );

  const handleKpiClick = useCallback(
    (key) => {
      const map = mode === 'Tasks' ? USPT_TASK_KPI_FOCUS : USPT_PROJECT_KPI_FOCUS;
      const focus = map[key];
      if (!focus) return;
      setStatusFilter(focus.status);
      pulseTableHighlight(key, focus.label);
    },
    [mode, pulseTableHighlight],
  );

  const handleFocusAreaClick = useCallback(
    (title) => {
      const map = mode === 'Tasks' ? USPT_FOCUS_AREA_KEYS.tasks : USPT_FOCUS_AREA_KEYS.projects;
      const mapped = map[title];
      if (!mapped) return;
      if (mapped === '__high__') {
        setStatusFilter('__high_priority__');
        pulseTableHighlight('high-priority', 'High priority');
        return;
      }
      if (mapped === '__attention__') {
        setStatusFilter('__attention__');
        pulseTableHighlight('attention', 'Delayed / At Risk');
        return;
      }
      handleKpiClick(mapped);
    },
    [mode, handleKpiClick, pulseTableHighlight],
  );

  const reloadTasks = useCallback(async () => {
    if (!kfInstance) return;
    try {
      // No per-row instance enrich — those GETs 400 and flood the tenant.
      const tasksRaw = (await fetchTaskTrackerData(kfInstance, { enrichDetails: false })).map(
        mapTaskForUserSpecificPT,
      );
      setApiTasks(tasksRaw);
      try {
        sessionStorage.setItem('userSpecificPT:tasks', JSON.stringify(tasksRaw));
      } catch { /* ignore */ }
    } catch (err) {
      console.warn('Reload tasks failed:', err?.message || err);
    }
  }, [kfInstance]);

  const loadHubTableTasks = useCallback(async () => {
    const email = String(userEmail || '').trim().toLowerCase();
    if (!kfInstance || !email) return;
    setHubTableTasksLoading(true);
    try {
      const [assigned, created] = await Promise.all([
        fetchEmployeeTasksByScope(kfInstance, { email, scope: 'assigned' }),
        fetchEmployeeTasksByScope(kfInstance, { email, scope: 'created' }),
      ]);
      const assignedRows = Array.isArray(assigned?.rows) ? assigned.rows : [];
      const createdRows = Array.isArray(created?.rows) ? created.rows : [];
      const assignedOpen = assignedRows.filter((row) => !isClosedWorkRow(row)).length;
      setHubTaskCounts({
        created: createdRows.length,
        assignedOpen,
        assignedClosed: assignedRows.length - assignedOpen,
      });
      setHubStatusCounts(countCreatedStatuses(createdRows));
      const scoped = filterHubScopeRows(
        taskOwnershipScope === 'created' ? createdRows : assignedRows,
        {
          scope: taskOwnershipScope,
          assignedStatus,
          createdStatusFilter,
        },
      );
      setHubTableTasks(scoped.map(mapTaskForUserSpecificPT));
    } catch (e) {
      console.warn('USPT hub table tasks failed', e?.message || e);
      setHubTableTasks([]);
    } finally {
      setHubTableTasksLoading(false);
    }
  }, [kfInstance, userEmail, taskOwnershipScope, createdStatusFilter, assignedStatus]);

  const handleTaskOwnershipScopeChange = useCallback((next) => {
    setTaskOwnershipScope(next);
    if (next === 'assigned') {
      setAssignedStatus('open');
      pulseTableHighlight('hub-assigned', 'Tasks Assigned to me · Open');
    } else if (next === 'created') {
      setCreatedStatusFilter('Draft');
      pulseTableHighlight('hub-created', 'Tasks Created by Me · Draft');
    }
  }, [pulseTableHighlight]);

  const handleAssignedStatusChange = useCallback((next) => {
    setAssignedStatus(next);
    pulseTableHighlight(
      `hub-assigned-${next}`,
      next === 'closed' ? 'Assigned · Closed' : 'Assigned · Open',
    );
  }, [pulseTableHighlight]);

  const handleCreatedStatusChange = useCallback((next) => {
    setCreatedStatusFilter(next);
    pulseTableHighlight(`hub-created-${next}`, `Created · ${next}`);
  }, [pulseTableHighlight]);

  const showDraftBulkSelect = false;

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
    const confirmed = window.confirm(`Delete ${ids.length} selected draft task(s)? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingDrafts(true);
    try {
      const { successIds, failed } = await deleteTaskDraftRecords(kfInstance, ids);
      if (successIds.length) {
        setHubTableTasks((prev) =>
          prev.filter((row) => !successIds.includes(resolveTaskDraftDeleteId(row))),
        );
        setSelectedDraftIds((prev) => {
          const next = new Set(prev);
          successIds.forEach((id) => next.delete(id));
          return next;
        });
        setHubStatusCounts((prev) => ({
          ...prev,
          Draft: Math.max(0, (prev.Draft || 0) - successIds.length),
        }));
        setHubTaskCounts((prev) => ({
          ...prev,
          created: Math.max(0, prev.created - successIds.length),
        }));
      }
      if (failed > 0) {
        window.alert(`${successIds.length} draft(s) deleted, ${failed} failed.`);
      } else if (successIds.length) {
        window.alert(`${successIds.length} draft(s) deleted successfully.`);
      }
    } catch (e) {
      console.warn('USPT draft delete failed:', e?.message || e);
      window.alert('Delete failed. Please try again.');
    } finally {
      setDeletingDrafts(false);
    }
  }, [kfInstance, selectedDraftIds]);

  const reloadProcessSubtasks = useCallback(async () => {
    if (!kfInstance) return;
    try {
      const res = await fetchAllSubtasks(kfInstance);
      setApiProcessSubtasks((res?.items ?? []).map(mapProcessSubtaskItem));
    } catch (err) {
      console.warn('Reload process subtasks failed:', err?.message || err);
    }
  }, [kfInstance]);

  const handleCreateTaskForProject = useCallback(
    async (project) => {
      const sdk = kfInstance ?? (typeof window !== 'undefined' ? window.kf : null) ?? kf;
      if (!sdk) {
        console.warn('Create task: Kissflow SDK not available');
        return false;
      }

      const projectId = resolveProjectBusinessId(project);
      if (!projectId) {
        sdk?.client?.showInfo?.('Missing project id on this row (expected e.g. PRJ-...).');
        return false;
      }

      if (typeof sdk?.app?.page?.openPopup !== 'function') {
        requestOpenTaskDetails({
          projectName: project?.name || project?.projectName || '',
          projectId,
        });
        return true;
      }

      const lockKey = `proj-${project?.id ?? projectId}`;
      if (myWorkRowCreateLock.has(lockKey)) return false;

      myWorkRowCreateLock.add(lockKey);
      setCreatingTaskProjectId(project?.id ?? projectId);
      try {
        const created = await createTaskInstance(sdk, projectId);
        if (created?.webhookOnly) {
          sdk?.client?.showInfo?.('Task sent to the Kissflow integration.');
          return true;
        }
        const opened = openUsptKissflowPopup(
          sdk,
          USPT_POPUP_IDS.task,
          created.instanceId,
          created.activityInstanceId,
        );
        if (!opened) {
          sdk?.client?.showInfo?.('Task created but the form could not be opened.');
        }
        void reloadTasks();
        return true;
      } catch (error) {
        console.warn('Create task failed:', error);
        sdk?.client?.showInfo?.(error?.message || 'Failed to create task.');
        return false;
      } finally {
        myWorkRowCreateLock.delete(lockKey);
        setCreatingTaskProjectId(null);
      }
    },
    [kfInstance, reloadTasks],
  );

  const handleCreateSubtaskForTask = useCallback(
    async (taskRow) => {
      const sdk = resolveKfSdk(kfInstance);
      if (isTaskCompleted(taskRow?.status)) {
        sdk?.client?.showInfo?.('Cannot add a subtask to a completed task.');
        return false;
      }
      if (!sdk) {
        console.warn('Create subtask: Kissflow SDK not available');
        return false;
      }

      const taskId = resolveTaskBusinessIdFromRow(taskRow);
      if (!taskId) {
        sdk?.client?.showInfo?.('Missing task id on this row (expected e.g. Task-PRJ-...).');
        return false;
      }

      if (typeof sdk?.app?.page?.openPopup !== 'function') {
        requestOpenSubtaskDetails({ taskId });
        return true;
      }

      const lockKey = `task-${taskRow?.id ?? taskId}`;
      if (myWorkRowCreateLock.has(lockKey)) return false;

      myWorkRowCreateLock.add(lockKey);
      setCreatingSubtaskTaskId(taskRow?.id ?? taskId);
      try {
        const created = await createSubtaskInstance(sdk, taskId);
        if (created?.webhookOnly) {
          sdk?.client?.showInfo?.('Subtask sent to the Kissflow integration.');
          return true;
        }
        const opened = openUsptKissflowPopup(
          sdk,
          USPT_POPUP_IDS.subtask,
          created.instanceId,
          created.activityInstanceId,
        );
        if (!opened) {
          sdk?.client?.showInfo?.('Subtask created but the form could not be opened.');
        }
        void reloadProcessSubtasks();
        return true;
      } catch (error) {
        console.warn('Create subtask failed:', error);
        sdk?.client?.showInfo?.(error?.message || 'Failed to create subtask.');
        return false;
      } finally {
        myWorkRowCreateLock.delete(lockKey);
        setCreatingSubtaskTaskId(null);
      }
    },
    [kfInstance, reloadProcessSubtasks],
  );

  const toggleProjectExpand = useCallback((row) => {
    setExpandedProjectId((id) => (id === row.id ? null : row.id));
  }, []);

  const toggleTaskExpand = useCallback((taskId, event) => {
    event?.stopPropagation?.();
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!kfInstance?.user) {
          // Avoid leaving My Work → Tasks with empty KPIs (loading + no cache).
          if (!cancelled) {
            setApiTasksLoading(false);
            setApiProjectsLoading(false);
          }
          return;
        }
        setApiError(null);

        const hasCachedTasks = Array.isArray(apiTasks) && apiTasks.length > 0;
        const hasCachedProjects = Array.isArray(apiProjects) && apiProjects.length > 0;

        if (!hasCachedProjects) setApiProjectsLoading(true);
        if (!hasCachedTasks) setApiTasksLoading(true);

        const projectsPromise = (async () => {
          const proj = await fetchEmployeeDashboardProjects(kfInstance, { email: userEmail });
          if (cancelled) return;
          const projectsRaw = proj?.rows ?? [];
          const projectsMapped = projectsRaw.map((p) => {
            const end = p.revisedEndDate ?? p.originalEndDate ?? null;
            return enrichProjectScheduleHealth({
              id: String(p.id ?? '').trim(),
              name: p.name ?? '—',
              owner: p.owner ?? '—',
              ownerId: p.ownerId ?? '',
              ownerEmail: p.ownerEmail ?? '',
              projectOwner: p.projectOwner ?? p.owner ?? '',
              projectOwnerId: p.projectOwnerId ?? p.ownerId ?? '',
              projectOwnerEmail: p.projectOwnerEmail ?? p.ownerEmail ?? '',
              businessOwner: p.businessOwner ?? '',
              businessOwnerId: p.businessOwnerId ?? '',
              businessOwnerEmail: p.businessOwnerEmail ?? '',
              sponsor: p.sponsor ?? '',
              sponsorId: p.sponsorId ?? '',
              sponsorEmail: p.sponsorEmail ?? '',
              cosOwner: p.cosOwner ?? '',
              cosOwnerId: p.cosOwnerId ?? '',
              cosOwnerEmail: p.cosOwnerEmail ?? '',
              developer: p.developer ?? '',
              developerId: p.developerId ?? '',
              developerEmail: p.developerEmail ?? '',
              createdBy: p.createdBy ?? '',
              createdById: p.createdById ?? '',
              createdByEmail: p.createdByEmail ?? '',
              companyName: (() => {
                const v = p.companyName ?? p.raw?.Company_Name ?? '';
                if (v && typeof v === 'object') return String(v.Name || v.name || '').trim();
                return String(v || '').trim();
              })(),
              lineOfBusiness: (() => {
                const v = p.lineOfBusiness ?? p.category ?? p.raw?.Project_Category ?? '';
                if (v && typeof v === 'object') return String(v.Name || v.name || '').trim();
                return String(v || '').trim();
              })(),
              category: (() => {
                const v = p.lineOfBusiness ?? p.category ?? '';
                if (v && typeof v === 'object') return String(v.Name || v.name || '').trim();
                return String(v || '').trim();
              })(),
              functionType: (() => {
                const v = p.functionType ?? p.raw?.Function_Type ?? '';
                if (v && typeof v === 'object') return String(v.Name || v.name || '').trim();
                return String(v || '').trim();
              })(),
              progress: Number(p.progress ?? 0),
              tasks: Number(p.totalTasks ?? 0),
              completed: Number(p.completedTasks ?? 0),
              pending: Math.max(0, Number(p.totalTasks ?? 0) - Number(p.completedTasks ?? 0)),
              delayDays: Number(p.delayDays ?? 0),
              end: end ? String(end) : '—',
              start: p.startDate ? String(p.startDate) : '—',
              revisedEndDate: p.revisedEndDate || null,
              originalEndDate: p.originalEndDate || null,
              revisedCount: Number(p.revisedCount ?? 0) || 0,
              hasRevision: Boolean(p.hasRevision) || Number(p.revisedCount ?? 0) > 0,
              revisionHistory: Array.isArray(p.revisionHistory) ? p.revisionHistory : [],
              status: p.status,
              rag: p.rag,
              createdAt: p.createdAt || null,
              raw: p,
            });
          });
          setApiProjects(projectsMapped);
        try {
          sessionStorage.setItem('userSpecificPT:projects:v3', JSON.stringify(projectsMapped));
        } catch { /* ignore */ }
          setApiProjectsLoading(false);
        })();

        const tasksPromise = (async () => {
          const tasksRaw = (await fetchTaskTrackerData(kfInstance, {
            enrichDetails: false,
            onProgress: (rows) => {
              if (cancelled) return;
              const mapped = (Array.isArray(rows) ? rows : []).map(mapTaskForUserSpecificPT);
              if (!mapped.length) return;
              setApiTasks(mapped);
              setApiTasksLoading(false);
            },
          })).map(mapTaskForUserSpecificPT);
          if (cancelled) return;
          setApiTasks(tasksRaw);
          try {
            sessionStorage.setItem('userSpecificPT:tasks', JSON.stringify(tasksRaw));
          } catch { /* ignore */ }
          setApiTasksLoading(false);
        })();

        const [projectsResult, tasksResult] = await Promise.allSettled([projectsPromise, tasksPromise]);
        if (cancelled) return;
        if (projectsResult.status === 'rejected') {
          setApiError(projectsResult.reason?.message || 'Failed to load');
          if (!hasCachedProjects) setApiProjects([]);
          setApiProjectsLoading(false);
        }
        if (tasksResult.status === 'rejected') {
          console.warn('UserSpecificPT: task list fetch failed', tasksResult.reason?.message || tasksResult.reason);
          setApiTasksLoading(false);
        }
    }

    run();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per SDK instance
  }, [kfInstance]);

  // Process subtasks are a third admin list — load only when that tab is open.
  useEffect(() => {
    if (!kfInstance?.user || mode !== 'SubTasks') return;
    let cancelled = false;
    (async () => {
      try {
        const subRes = await fetchAllSubtasks(kfInstance);
        if (cancelled) return;
        setApiProcessSubtasks((subRes?.items ?? []).map(mapProcessSubtaskItem));
      } catch (subErr) {
        console.warn('UserSpecificPT: process subtasks fetch failed', subErr?.message || subErr);
        if (!cancelled) setApiProcessSubtasks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kfInstance, mode]);

  // Stable key for intentional UI transitions (filters / scope) — NOT loading toggles.
  const filterKey = useMemo(
    () =>
      [
        scope,
        mode,
        selectedMembers.join('|'),
        periodMode,
        periodFrom,
        periodTo,
        companyFilter,
        lineOfBusinessFilter,
        functionTypeFilter,
        statusFilter,
        ownerOrProjectFilter,
        priorityOrHealthFilter,
        search,
      ].join('::'),
    [
      scope,
      mode,
      selectedMembers,
      periodMode,
      periodFrom,
      periodTo,
      companyFilter,
      lineOfBusinessFilter,
      functionTypeFilter,
      statusFilter,
      ownerOrProjectFilter,
      priorityOrHealthFilter,
      search,
    ],
  );

  // My Team → projects then tasks (sequential — avoids race where tasks fetch before projects).
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (scope !== 'My Team') return;
      if (!kfInstance?.user) return;

      const emailKey = String(userEmail || userId || 'me').toLowerCase();
      const projectsCacheKey = `userSpecificPT:myTeamProjects:v6:${emailKey}`;
      const tasksCacheKey = `userSpecificPT:myTeamTasks:v6:${emailKey}`;
      const subtasksCacheKey = `userSpecificPT:myTeamSubtasks:v2:${emailKey}`;

      let hasProjectsCache = false;
      let hasTasksCache = false;
      let hasSubtasksCache = false;
      try {
        const cached = JSON.parse(sessionStorage.getItem(projectsCacheKey) || 'null');
        if (Array.isArray(cached) && cached.length > 0) {
          setMyTeamProjects(cached);
          hasProjectsCache = true;
        }
      } catch { /* ignore */ }

      try {
        const cachedTasks = JSON.parse(sessionStorage.getItem(tasksCacheKey) || 'null');
        if (Array.isArray(cachedTasks) && cachedTasks.length > 0) {
          setMyTeamTasks(cachedTasks);
          hasTasksCache = true;
        }
      } catch { /* ignore */ }

      try {
        const cachedSubs = JSON.parse(sessionStorage.getItem(subtasksCacheKey) || 'null');
        if (Array.isArray(cachedSubs) && cachedSubs.length > 0) {
          setMyTeamSubtasks(cachedSubs);
          hasSubtasksCache = true;
        }
      } catch { /* ignore */ }

      if (!hasProjectsCache) setMyTeamProjectsLoading(true);
      if (!hasTasksCache) setMyTeamTasksLoading(true);
      if (!hasSubtasksCache) setMyTeamSubtasksLoading(true);
      setMyTeamProjectsError(null);
      setMyTeamTasksError(null);
      setMyTeamSubtasksError(null);

      try {
        const { projects } = await fetchMyTeamProjects(kfInstance, {
          loggedInEmail: userEmail,
        });
        if (cancelled) return;
        setMyTeamProjects(projects);
        try {
          sessionStorage.setItem(projectsCacheKey, JSON.stringify(projects));
        } catch { /* ignore */ }

        const allowedProjectIds = new Set();
        (Array.isArray(projects) ? projects : []).forEach((p) => {
          const ids = [
            ...(Array.isArray(p?.projectIds) ? p.projectIds : []),
            p?.id,
            p?.projectId,
          ];
          ids.forEach((id) => {
            const s = String(id || '').trim();
            if (s) allowedProjectIds.add(s);
          });
        });

        const [taskResult, subtaskResult] = await Promise.all([
          fetchMyTeamTasks(kfInstance, {
            loggedInEmail: userEmail,
            allowedProjectIds,
          }),
          fetchMyTeamSubtasks(kfInstance, {
            loggedInEmail: userEmail,
            allowedProjectIds,
          }),
        ]);
        if (cancelled) return;
        const tasks = taskResult?.tasks || [];
        const subtasks = subtaskResult?.subtasks || [];
        setMyTeamTasks(tasks);
        setMyTeamSubtasks(subtasks);
        try {
          sessionStorage.setItem(tasksCacheKey, JSON.stringify(tasks));
        } catch { /* ignore */ }
        try {
          sessionStorage.setItem(subtasksCacheKey, JSON.stringify(subtasks));
        } catch { /* ignore */ }
      } catch (e) {
        console.warn('UserSpecificPT: My Team fetch failed', e);
        if (!cancelled) {
          const msg = e?.message || 'Failed to load My Team data';
          setMyTeamProjectsError(msg);
          setMyTeamTasksError(msg);
          setMyTeamSubtasksError(msg);
          if (!hasProjectsCache) setMyTeamProjects([]);
          setMyTeamTasks([]);
          setMyTeamSubtasks([]);
        }
      } finally {
        if (!cancelled) {
          setMyTeamProjectsLoading(false);
          setMyTeamTasksLoading(false);
          setMyTeamSubtasksLoading(false);
        }
      }
    }

    run();
    return () => { cancelled = true; };
  }, [scope, kfInstance, userEmail, userId]);

  const current = useMemo(() => {
    if (mode === 'SubTasks') {
      return {
        isTasks: false,
        isTeam: false,
        rows: [],
        optionRows: [],
        total: 0,
        kpis: [],
        legend: [],
        hubLoading: false,
      };
    }

    const isTeam = scope === 'My Team';
    const isTasks = mode === 'Tasks';

    const safeTotal = (arr) => Array.isArray(arr) ? arr.length : 0;
    const pctOf = (n, total) => (total > 0 ? Number(((n / total) * 100).toFixed(1)) : 0);
    const pctRound = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);

    const createdRanges = resolveUsptPeriodCreatedRanges(periodFrom, periodTo, periodRanges);
    const dimensionFilters = {
      company: companyFilter,
      lineOfBusiness: lineOfBusinessFilter,
      functionType: functionTypeFilter,
    };

    const norm = (v) => String(v ?? '').trim().toLowerCase();
    const matchesSearch = (hay) => {
      const q = norm(search);
      if (!q) return true;
      return norm(hay).includes(q);
    };

    /** Projects after ownership/team scope — used for task dimension linkage + options. */
    const ownershipScopedProjects = (() => {
      const base =
        (scope === 'My Team'
          ? (Array.isArray(myTeamProjects) ? myTeamProjects : [])
          : (Array.isArray(apiProjects) ? apiProjects : [])
        ).map((p) => enrichProjectScheduleHealth(p));

      if (selectedMembers.length > 0) {
        return base.filter((p) => selectedMembers.includes(String(p.owner || '').trim()));
      }
      return base;
    })();

    const dimensionScopedProjects = ownershipScopedProjects.filter((p) =>
      rowMatchesPortfolioDimensions(p, dimensionFilters),
    );

    if (isTasks) {
      // My Team → process-report My_Team_A04
      // My Work → full Project_Sub_Task_A01 admin list (not scoped to the signed-in user)
      const baseTasks = (() => {
        if (scope === 'My Team') return Array.isArray(myTeamTasks) ? myTeamTasks : [];
        return Array.isArray(apiTasks) ? apiTasks : [];
      })();

      const myTasks = baseTasks;

      let tasks =
        isTeam && selectedMembers.length > 0
          ? myTasks.filter((t) => selectedMembers.includes(String(t.assignee || '').trim()))
          : myTasks;

      const applySharedTaskFilters = (
        list,
        {
          applyStatus = true,
          applyProject = true,
          applyPriority = true,
          applySearch = true,
        } = {},
      ) => {
        let next = list;
        next = next.filter((t) => rowMatchesAnyCreatedRange(t, createdRanges));
        next = next.filter((t) =>
          taskMatchesPortfolioDimensions(t, dimensionFilters, dimensionScopedProjects),
        );

        if (applyStatus) {
          if (statusFilter === '__pending__') {
            next = next.filter((t) => {
              const s = String(t?.status || '').trim().toLowerCase();
              const completed = s === 'completed' || s === 'closed' || s === 'done' || s.includes('complete');
              const overdue = s.includes('overdue') || (Number(t.delayDays) > 0 && !completed);
              return !completed && !overdue;
            });
          } else if (statusFilter === '__delayed__') {
            next = next.filter((t) => Number(t.delayDays) > 0);
          } else if (statusFilter === 'Overdue') {
            next = next.filter((t) => {
              const s = String(t?.status || '').trim().toLowerCase();
              const completed = s === 'completed' || s === 'closed' || s === 'done' || s.includes('complete');
              return s.includes('overdue') || (Number(t.delayDays) > 0 && !completed);
            });
          } else if (statusFilter === 'Completed') {
            next = next.filter((t) => {
              const s = String(t?.status || '').trim().toLowerCase();
              return s === 'completed' || s === 'closed' || s === 'done' || s.includes('complete');
            });
          } else if (statusFilter !== 'all') {
            next = next.filter((t) => String(t.status || '').trim() === statusFilter);
          }
        }

        if (applyProject) {
          if (ownerOrProjectFilter === '__individual__') {
            next = next.filter((t) => isEmptyProjectName(t.project));
          } else if (ownerOrProjectFilter !== 'all') {
            next = next.filter((t) => String(t.project || '').trim() === ownerOrProjectFilter);
          }
        }

        if (applyPriority && priorityOrHealthFilter !== 'all') {
          next = next.filter((t) => String(t.priority || '').trim() === priorityOrHealthFilter);
        }

        if (applySearch) {
          next = next.filter((t) => matchesSearch(`${t.name} ${t.id} ${t.project} ${t.assignee} ${t.status}`));
        }
        return next;
      };

      // Column filter menus must use pre-column-filter rows, otherwise selecting
      // "Asset management" collapses Project options to only that one value.
      const optionRows = applySharedTaskFilters(tasks, {
        applyStatus: false,
        applyProject: false,
        applyPriority: false,
      });

      tasks = applySharedTaskFilters(tasks);

      const metricsSource = tasks;

      const total = safeTotal(metricsSource);
      const tableTotal = safeTotal(tasks);

      const isCompleted = (t) => {
        const s = String(t?.status || '').trim().toLowerCase();
        return s === 'completed' || s === 'closed' || s === 'done' || s.includes('complete');
      };

      const isOverdue = (t) => {
        const s = String(t?.status || '').trim().toLowerCase();
        return s.includes('overdue');
      };

      const completedCount = metricsSource.filter(isCompleted).length;
      let overdueCount = metricsSource.filter(isOverdue).length;
      if (overdueCount === 0) {
        overdueCount = metricsSource.filter((t) => Number(t.delayDays) > 0 && !isCompleted(t)).length;
      }

      const delayedCount = metricsSource.filter((t) => Number(t.delayDays) > 0).length;
      const pendingCount = Math.max(0, total - completedCount - overdueCount);
      const highPriorityCount = metricsSource.filter(
        (t) => String(t.priority || '').trim().toLowerCase() === 'high',
      ).length;
      const openCount = metricsSource.filter((t) => {
        const s = String(t?.status || '').trim().toLowerCase();
        return s === 'open' || s.includes('progress') || s.includes('pending') || s.includes('review');
      }).length;

      const completedPct = pctRound(completedCount, total);
      const pendingPct = pctRound(pendingCount, total);
      const overduePct = pctRound(overdueCount, total);
      const delayedPct = total > 0 ? `${pctRound(delayedCount, total)}%` : '0%';
      const scopeLabel = isTeam ? 'My Team report' : 'All tasks';

      return {
        isTasks,
        isTeam,
        rows: tasks,
        optionRows,
        total: tableTotal,
        metricsTotal: total,
        completedCount,
        pendingCount,
        overdueCount,
        delayedCount,
        highPriorityCount,
        openCount,
        hubLoading: !isTeam && apiTasksLoading && (!Array.isArray(apiTasks) || apiTasks.length === 0),
        kpis: [
          {
            key: 'total-tasks',
            title: 'Total Tasks',
            value: total,
            subtitle: isTeam ? 'From My Team report' : scopeLabel,
            trend: { value: isTeam ? 'My Team report' : 'My Work', positive: true },
            icon: 'ri-list-check-3',
            theme: KPI_THEME.subtasks,
          },
          {
            key: 'completed',
            title: 'Completed',
            value: completedCount,
            subtitle: `${completedPct}% of total tasks`,
            trend: { value: `${completedCount} done`, positive: true },
            icon: 'ri-check-double-line',
            theme: KPI_THEME.tasksDone,
          },
          {
            key: 'pending',
            title: 'Pending',
            value: pendingCount,
            subtitle: `${pendingPct}% open / in progress`,
            trend: { value: `${openCount} active`, positive: pendingCount === 0 },
            icon: 'ri-folder-open-line',
            theme: KPI_THEME.open,
          },
          {
            key: 'overdue',
            title: 'Overdue',
            value: overdueCount,
            subtitle: `${overduePct}% of total tasks`,
            trend: { value: overdueCount > 0 ? `${overdueCount} overdue` : 'None overdue', positive: overdueCount === 0 },
            icon: 'ri-alarm-warning-line',
            theme: KPI_THEME.overdue,
          },
          {
            key: 'delayed',
            title: 'Delayed %',
            value: delayedPct,
            subtitle: `${delayedCount} tasks with delay days`,
            trend: { value: `${highPriorityCount} high priority`, positive: highPriorityCount === 0 },
            icon: 'ri-error-warning-line',
            theme: KPI_THEME.delayed,
          },
        ],
        legend: [
          { label: 'Completed', value: completedCount, pct: pctOf(completedCount, total), color: 'bg-emerald-500' },
          { label: 'Pending', value: pendingCount, pct: pctOf(pendingCount, total), color: 'bg-amber-500' },
          { label: 'Overdue', value: overdueCount, pct: pctOf(overdueCount, total), color: 'bg-rose-500' },
        ],
      };
    }

    // Projects
    // My Team → use case-report My_Team_A05 (already manager-scoped).
    // My Work → full project case list from the API.
    // Re-apply schedule health so cached / API rows match ProjectDashboardPage RAG rules.
    if (
      scope === 'My Team' &&
      myTeamProjectsLoading &&
      (!Array.isArray(myTeamProjects) || myTeamProjects.length === 0)
    ) {
      return {
        isTasks,
        isTeam,
        rows: [],
        optionRows: [],
        total: 0,
        completedCount: 0,
        pendingCount: 0,
        overdueCount: 0,
        delayedCount: 0,
        onTrackCount: 0,
        atRiskCount: 0,
        completedProjects: 0,
        kpis: [],
        legend: [],
      };
    }

    let projects = dimensionScopedProjects.slice();

    // Date range: include project if start OR end falls in range.
    projects = projects.filter((p) => rowMatchesAnyCreatedRange(p, createdRanges));

    // Column menus use rows before owner/health/status filters (same bug as Project on Tasks).
    const optionRows = projects.filter((p) =>
      matchesSearch(`${p.name} ${p.id} ${p.owner} ${p.health} ${p.status}`),
    );

    // Status filter (match either health or raw status)
    // Status / health filter (supports KPI tokens)
    if (statusFilter === '__attention__') {
      projects = projects.filter((p) => p.health === 'At Risk' || p.health === 'Delayed');
    } else if (statusFilter === '__high_priority__') {
      projects = projects.filter((p) => String(p.priority || '').trim().toLowerCase() === 'high');
    } else if (statusFilter !== 'all') {
      projects = projects.filter(
        (p) => String(p.health || '').trim() === statusFilter || String(p.status || '').trim() === statusFilter,
      );
    }

    // Owner filter
    if (ownerOrProjectFilter !== 'all') {
      projects = projects.filter((p) => String(p.owner || '').trim() === ownerOrProjectFilter);
    }

    // Project health filter
    if (priorityOrHealthFilter !== 'all') {
      projects = projects.filter((p) => String(p.health || '').trim() === priorityOrHealthFilter);
    }

    // Search filter
    projects = projects.filter((p) => matchesSearch(`${p.name} ${p.id} ${p.owner} ${p.health} ${p.status}`));

    const total = safeTotal(projects);

    const onTrackCount = projects.filter((p) => p.health === 'On Track').length;
    const atRiskCount = projects.filter((p) => p.health === 'At Risk').length;
    const delayedCount = projects.filter((p) => p.health === 'Delayed').length;
    const completedProjects = projects.filter(
      (p) => p.health === 'Completed' || isClosedProjectStatus(p.status),
    ).length;
    const highPriorityCount = projects.filter((p) => String(p.priority || '').trim().toLowerCase() === 'high').length;
    const avgProgress = total > 0
      ? Math.round(projects.reduce((sum, p) => sum + Number(p.progress || 0), 0) / total)
      : 0;
    const scopeLabel = isTeam ? 'My Team report' : 'My Work';

    return {
      isTasks,
      isTeam,
      rows: projects,
      optionRows,
      total,
      onTrackCount,
      atRiskCount,
      delayedCount,
      completedProjects,
      highPriorityCount,
      kpis: [
        {
          key: 'total-projects',
          title: 'Total Projects',
          value: total,
          subtitle: isTeam ? 'From My Team report' : 'All projects',
          trend: { value: scopeLabel, positive: true },
          icon: 'ri-folder-3-line',
          theme: KPI_THEME.total,
        },
        {
          key: 'on-track',
          title: 'On Track',
          value: onTrackCount,
          subtitle: `${pctRound(onTrackCount, total)}% of total projects`,
          trend: { value: `Avg ${avgProgress}% complete`, positive: true },
          icon: 'ri-notification-3-line',
          theme: KPI_THEME.active,
        },
        {
          key: 'completed',
          title: 'Completed',
          value: completedProjects,
          subtitle: `${pctRound(completedProjects, total)}% of total projects`,
          trend: { value: `${completedProjects} closed`, positive: true },
          icon: 'ri-checkbox-circle-line',
          theme: KPI_THEME.completed,
        },
        {
          key: 'at-risk',
          title: 'At Risk',
          value: atRiskCount,
          subtitle: `${pctRound(atRiskCount, total)}% of total projects`,
          trend: { value: atRiskCount > 0 ? `${atRiskCount} amber` : 'None at risk', positive: atRiskCount === 0 },
          icon: 'ri-error-warning-line',
          theme: KPI_THEME.open,
        },
        {
          key: 'delayed',
          title: 'Delayed Projects',
          value: delayedCount,
          subtitle: `${highPriorityCount} high priority`,
          trend: { value: delayedCount > 0 ? `${delayedCount} red` : 'None delayed', positive: delayedCount === 0 },
          icon: 'ri-error-warning-line',
          theme: KPI_THEME.delayed,
        },
      ],
      legend: [
        { label: 'On Track', value: onTrackCount, pct: pctOf(onTrackCount, total), color: 'bg-emerald-500' },
        { label: 'At Risk', value: atRiskCount, pct: pctOf(atRiskCount, total), color: 'bg-amber-500' },
        { label: 'Delayed', value: delayedCount, pct: pctOf(delayedCount, total), color: 'bg-rose-500' },
      ],
    };
  }, [
    scope,
    mode,
    selectedMembers,
    apiTasks,
    apiProjects,
    myTeamProjects,
    myTeamProjectsLoading,
    myTeamTasks,
    apiTasksLoading,
    periodFrom,
    periodTo,
    periodRanges,
    companyFilter,
    lineOfBusinessFilter,
    functionTypeFilter,
    statusFilter,
    search,
    ownerOrProjectFilter,
    priorityOrHealthFilter,
  ]);

  // After Kissflow remounts (popup close refresh), return the user to the tasks/projects table.
  useEffect(() => {
    if (!pageFiltersReady || didRestoreTableScrollRef.current) return;

    const tableBusy =
      Boolean(current.hubLoading) ||
      (scope === 'My Team' && mode === 'Tasks' && myTeamTasksLoading) ||
      (scope === 'My Team' && mode === 'Projects' && myTeamProjectsLoading) ||
      (scope === 'My Work' && mode === 'Projects' && apiProjectsLoading) ||
      (scope === 'My Work' && mode === 'Tasks' && apiTasksLoading);

    if (tableBusy) return;

    const fromPopup = peekUsptReturnToTable();
    const fromActiveFilters =
      nameFilter !== 'all' ||
      ownerOrProjectFilter !== 'all' ||
      assigneeFilter !== 'all' ||
      priorityOrHealthFilter !== 'all' ||
      (statusFilter !== 'all' && statusFilter !== USPT_DEFAULT_TABLE_FILTERS.statusFilter);

    if (!fromPopup && !fromActiveFilters) {
      didRestoreTableScrollRef.current = true;
      return;
    }

    didRestoreTableScrollRef.current = true;
    clearUsptReturnToTable();
    // Let restored filters + table paint first.
    const t1 = window.setTimeout(() => scrollToTable(), 60);
    const t2 = window.setTimeout(() => scrollToTable(), 320);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [
    pageFiltersReady,
    current.hubLoading,
    scope,
    mode,
    myTeamTasksLoading,
    myTeamProjectsLoading,
    apiProjectsLoading,
    apiTasksLoading,
    nameFilter,
    ownerOrProjectFilter,
    assigneeFilter,
    priorityOrHealthFilter,
    statusFilter,
    scrollToTable,
  ]);

  const portfolioDimensionSource = useMemo(() => {
    const base =
      (scope === 'My Team'
        ? (Array.isArray(myTeamProjects) ? myTeamProjects : [])
        : (Array.isArray(apiProjects) ? apiProjects : [])
      ).map((p) => enrichProjectScheduleHealth(p));

    if (selectedMembers.length > 0) {
      return base.filter((p) => selectedMembers.includes(String(p.owner || '').trim()));
    }
    return base;
  }, [scope, selectedMembers, apiProjects, myTeamProjects]);

  const companyOptions = useMemo(
    () => collectUniqueDimensionValues(portfolioDimensionSource, 'companyName'),
    [portfolioDimensionSource],
  );
  const lineOfBusinessOptions = useMemo(
    () => collectUniqueDimensionValues(portfolioDimensionSource, 'lineOfBusiness'),
    [portfolioDimensionSource],
  );
  const functionTypeOptions = useMemo(() => {
    const itRows = portfolioDimensionSource.filter((p) =>
      isInformationTechnologyCategory(p.lineOfBusiness || p.category),
    );
    return collectUniqueDimensionValues(itRows, 'functionType');
  }, [portfolioDimensionSource]);

  useEffect(() => {
    if (companyFilter && !companyOptions.includes(companyFilter)) setCompanyFilter('');
  }, [companyFilter, companyOptions]);
  useEffect(() => {
    if (lineOfBusinessFilter && !lineOfBusinessOptions.includes(lineOfBusinessFilter)) {
      setLineOfBusinessFilter('');
      setFunctionTypeFilter('');
    }
  }, [lineOfBusinessFilter, lineOfBusinessOptions]);
  useEffect(() => {
    if (functionTypeFilter && !functionTypeOptions.includes(functionTypeFilter)) {
      setFunctionTypeFilter('');
    }
  }, [functionTypeFilter, functionTypeOptions]);

  const hasActiveDimensionFilters =
    hasActivePortfolioDimensionFilters({
      company: companyFilter,
      lineOfBusiness: lineOfBusinessFilter,
      functionType: functionTypeFilter,
    }) || Boolean(periodFrom && periodTo && periodMode !== 'all') || (Array.isArray(periodRanges) && periodRanges.length > 0 && periodMode !== 'all');

  const clearDimensionFilters = useCallback(() => {
    const empty = getEmptyPeriodState();
    setCompanyFilter('');
    setLineOfBusinessFilter('');
    setFunctionTypeFilter('');
    setPeriodMode(empty.mode);
    setPeriodFrom(empty.range.from);
    setPeriodTo(empty.range.to);
    setPeriodLabel(empty.summaryLabel);
    setPeriodRanges([]);
    setPeriodParts([]);
    setPeriodFyStartYear(null);
  }, []);

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

  const teamOverviewRows = useMemo(() => {
    if (!current.isTasks) return [];

    const isCompleted = (t) => {
      const s = String(t?.status || '').trim().toLowerCase();
      return s === 'completed' || s === 'closed' || s === 'done' || s.includes('complete');
    };
    const isOverdue = (t) => {
      const s = String(t?.status || '').trim().toLowerCase();
      if (s.includes('overdue')) return true;
      return Number(t?.delayDays) > 0 && !isCompleted(t);
    };

    const colors = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-emerald-500'];
    const pickColor = (name) => {
      const txt = String(name || '');
      let hash = 0;
      for (let i = 0; i < txt.length; i += 1) hash = (hash * 31 + txt.charCodeAt(i)) % 997;
      return colors[hash % colors.length];
    };

    // Overview from the same filtered rows as the table/KPIs (full API list on My Work).
    const filteredTasks = Array.isArray(current.rows) ? current.rows : [];
    const uniqueMembers = Array.from(
      new Set(filteredTasks.map((t) => String(t.assignee || '').trim()).filter(Boolean)),
    );
    const membersToShow = selectedMembers.length > 0 ? selectedMembers : uniqueMembers;

    return membersToShow.map((name) => {
      const memberTasks = filteredTasks.filter((t) => String(t.assignee || '').trim() === name);
      const completed = memberTasks.filter(isCompleted).length;
      const overdue = memberTasks.filter(isOverdue).length;

      return {
        name,
        role: 'Team Member',
        initials: toInitials(name),
        color: pickColor(name),
        tasks: memberTasks.length,
        completed,
        overdue,
      };
    });
  }, [current.isTasks, current.rows, selectedMembers]);

  const teamMembers = useMemo(() => {
    // My Team: reportees/people come from the active report response only.
    if (scope === 'My Team') {
      const rows =
        mode === 'Tasks'
          ? (Array.isArray(myTeamTasks) ? myTeamTasks : [])
          : mode === 'SubTasks'
            ? (Array.isArray(myTeamSubtasks) ? myTeamSubtasks : [])
            : (Array.isArray(myTeamProjects) ? myTeamProjects : []);

      const unique = new Map();
      rows.forEach((row) => {
        const name = String(
          mode === 'Tasks' || mode === 'SubTasks'
            ? (row?.assignee || row?.assignedTo)
            : row?.owner,
        ).trim();
        if (!name || name === '—') return;
        const id = String(
          mode === 'Tasks' || mode === 'SubTasks' ? row?.assigneeId : row?.ownerId || '',
        ).trim();
        const email = String(
          mode === 'Tasks' || mode === 'SubTasks' ? row?.assigneeEmail : row?.ownerEmail || '',
        ).trim();
        const key = id || name.toLowerCase();
        if (!unique.has(key)) {
          unique.set(key, { name, initials: toInitials(name), id, email });
        }
      });

      const counts = rows.reduce((acc, row) => {
        const name = String(
          mode === 'Tasks' || mode === 'SubTasks'
            ? (row?.assignee || row?.assignedTo)
            : row?.owner,
        ).trim();
        if (!name || name === '—') return acc;
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});

      return Array.from(unique.values()).sort(
        (a, b) => (counts[b.name] || 0) - (counts[a.name] || 0),
      );
    }

    const tasks = Array.isArray(apiTasks) ? apiTasks : [];
    const unique = new Map();
    tasks.forEach((t) => {
      const name = String(t?.assignee || '').trim();
      if (!name) return;
      if (!unique.has(name)) unique.set(name, { name, initials: toInitials(name) });
    });
    const counts = tasks.reduce((acc, t) => {
      const name = String(t?.assignee || '').trim();
      if (!name) return acc;
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    return Array.from(unique.values()).sort((a, b) => (counts[b.name] || 0) - (counts[a.name] || 0));
  }, [apiTasks, myTeamTasks, myTeamProjects, myTeamSubtasks, scope, mode]);

  useEffect(() => {
    // If selected members are no longer available (org list refreshed), clear invalid selections.
    if (scope !== 'My Team') return;
    if (!Array.isArray(teamMembers)) return;
    const allowed = new Set(teamMembers.map((m) => m.name));
    if (selectedMembers.length > 0 && selectedMembers.some((n) => !allowed.has(n))) {
      setSelectedMembers((prev) => prev.filter((n) => allowed.has(n)));
    }
  }, [teamMembers, scope, selectedMembers]);

  const openUsptTaskPopup = useCallback(
    (row) => {
      const { instanceId, activityId } = resolveRowPopupIds(row);
      return openUsptKissflowPopup(kfInstance, USPT_POPUP_IDS.task, instanceId, activityId, row);
    },
    [kfInstance],
  );

  const handleOpenTaskDetail = useCallback(
    (row) => {
      if (!row) return false;
      if (openUsptTaskPopup(row)) return true;
      requestOpenTaskDetails(taskRowToFormDefaults(mapUsptTaskToDetailRow(row)));
      return true;
    },
    [openUsptTaskPopup],
  );

  const openMyWorkProjectAccordionTaskDetail = useCallback(
    (row) => {
      if (!row) return false;
      requestOpenTaskDetails(taskRowToFormDefaults(mapUsptTaskToDetailRow(row)));
      return true;
    },
    [],
  );

  const handleOpenMyTeamSubtaskDetail = useCallback(
    async (row) => {
      if (!row) return false;
      const instanceId = String(row.InstanceID || row._id || row.id || '').trim();
      if (instanceId && kfInstance?.api) {
        try {
          const detail = await fetchSubtaskAdminDetailById(kfInstance, instanceId);
          const detailRow = detail && typeof detail === 'object' ? detail : null;
          if (detailRow && (detailRow._id || detailRow.Sub_task_Name || detailRow.Name)) {
            const activityFromList = row.ActivityID || row._activity_instance_id;
            requestOpenSubtaskDetails(
              subtaskRowToFormDefaults(
                mapUsptSubtaskToDetailRow({
                  ...row,
                  raw: {
                    ...detailRow,
                    _activity_instance_id:
                      detailRow._activity_instance_id || activityFromList || undefined,
                  },
                }),
              ),
            );
            return true;
          }
        } catch (e) {
          console.warn('My Team subtask detail fetch failed; using report row', e?.message || e);
        }
      }
      requestOpenSubtaskDetails(subtaskRowToFormDefaults(mapUsptSubtaskToDetailRow(row)));
      return true;
    },
    [kfInstance],
  );

  const openUsptSubtaskDetail = useCallback((sub) => {
    if (!sub) return false;
    requestOpenSubtaskDetails(subtaskRowToFormDefaults(mapUsptSubtaskToDetailRow(sub)));
    return true;
  }, []);

  const handleOpenProjectDetail = useCallback(
    (row) => {
      if (!row) return false;
      // My Team: custom detail modal. My Work project name uses CaseID popup separately.
      if (isMyWork) return false;
      setDetailModal({ type: 'project', row: mapUsptProjectToDetailRow(row) });
      return true;
    },
    [isMyWork],
  );

  const openMyWorkProjectPopup = useCallback(
    (row) => {
      if (!row) return false;
      return openUsptProjectPopup(kfInstance, resolveUsptProjectCaseId(row));
    },
    [kfInstance],
  );

  const handleCloseDetailModal = useCallback(() => {
    setDetailModal(null);
  }, []);

  const sortedTableRows = useMemo(() => {
    let rows = Array.isArray(current.rows) ? [...current.rows] : [];
    if (nameFilter !== 'all') {
      rows = rows.filter((r) => String(r.name || '').trim() === nameFilter);
    }
    if (current.isTasks && assigneeFilter !== 'all') {
      rows = rows.filter((r) => String(r.assignee || '').trim() === assigneeFilter);
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const isTasks = current.isTasks;
    rows.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return compareText(a.name, b.name, dir);
        case 'project':
          return compareText(
            isEmptyProjectName(a.project) ? 'Individual Task' : a.project,
            isEmptyProjectName(b.project) ? 'Individual Task' : b.project,
            dir,
          );
        case 'assignee':
        case 'owner':
          return compareText(isTasks ? a.assignee : a.owner, isTasks ? b.assignee : b.owner, dir);
        case 'start':
          return compareDateValue(a.start, b.start, dir, sortDir);
        case 'end':
          return compareDateValue(a.end, b.end, dir, sortDir);
        case 'revised':
        case 'revisedCount':
          return compareNumber(a.revisedCount, b.revisedCount, dir);
        case 'delay':
          return compareNumber(parseDelayDays(a), parseDelayDays(b), dir);
        case 'priority':
          return compareText(a.priority, b.priority, dir);
        case 'status':
          return compareText(a.status, b.status, dir);
        case 'progress':
          return compareNumber(a.progress, b.progress, dir);
        case 'tasks':
          return compareNumber(a.tasks, b.tasks, dir);
        case 'completed':
          return compareNumber(a.completed, b.completed, dir);
        case 'pending':
          return compareNumber(a.pending, b.pending, dir);
        case 'health':
          return compareText(a.health, b.health, dir);
        default:
          return 0;
      }
    });
    return rows;
  }, [current.rows, current.isTasks, sortKey, sortDir, nameFilter, assigneeFilter]);

  const handleTableSort = useCallback((key) => {
    const next = toggleSortState(sortKey, sortDir, key);
    setSortKey(next.sortKey);
    setSortDir(next.sortDir);
  }, [sortKey, sortDir]);

  const tableTotal = sortedTableRows.length;
  const tableTotalPages = Math.max(1, Math.ceil(tableTotal / PT_TABLE_PAGE_SIZE));
  const safeTablePage = Math.min(tablePage, tableTotalPages);

  const pageRows = useMemo(() => {
    const start = (safeTablePage - 1) * PT_TABLE_PAGE_SIZE;
    return sortedTableRows.slice(start, start + PT_TABLE_PAGE_SIZE);
  }, [sortedTableRows, safeTablePage]);

  const draftPageRowIds = useMemo(() => {
    if (!showDraftBulkSelect) return [];
    return pageRows.map((row) => resolveTaskDraftDeleteId(row)).filter(Boolean);
  }, [showDraftBulkSelect, pageRows]);

  const allDraftPageSelected =
    showDraftBulkSelect &&
    draftPageRowIds.length > 0 &&
    draftPageRowIds.every((id) => selectedDraftIds.has(id));

  const taskNameOptions = useMemo(
    () =>
      distinctFilterOptions(current.isTasks ? current.optionRows || current.rows : [], (t) => t.name, {
        allLabel: 'All Tasks',
      }),
    [current.isTasks, current.optionRows, current.rows],
  );
  const projectOrOwnerOptions = useMemo(() => {
    const source = current.optionRows || current.rows || [];
    if (current.isTasks) {
      return distinctFilterOptions(source, (t) => t.project, {
        allLabel: 'All Projects',
        emptyValue: '__individual__',
        emptyLabel: 'Individual Task',
      });
    }
    return distinctFilterOptions(source, (p) => p.owner, { allLabel: 'All Owners' });
  }, [current.isTasks, current.optionRows, current.rows]);
  const assigneeOptions = useMemo(
    () =>
      distinctFilterOptions(current.isTasks ? current.optionRows || current.rows : [], (t) => t.assignee, {
        allLabel: 'All Assignees',
      }),
    [current.isTasks, current.optionRows, current.rows],
  );
  const priorityOrHealthOptions = useMemo(() => {
    if (current.isTasks) {
      return distinctFilterOptions(current.optionRows || current.rows || [], (t) => t.priority, {
        allLabel: 'All Priority',
      });
    }
    return [
      { value: 'all', label: 'Project Health' },
      { value: 'On Track', label: 'On Track' },
      { value: 'At Risk', label: 'At Risk' },
      { value: 'Delayed', label: 'Delayed' },
      { value: 'Completed', label: 'Completed' },
    ];
  }, [current.isTasks, current.optionRows, current.rows]);
  const statusColumnOptions = useMemo(
    () =>
      distinctFilterOptions(current.isTasks ? current.optionRows || current.rows : [], (t) => t.status, {
        allLabel: 'All Status',
      }),
    [current.isTasks, current.optionRows, current.rows],
  );
  const projectNameOptions = useMemo(
    () =>
      distinctFilterOptions(!current.isTasks ? current.optionRows || current.rows : [], (p) => p.name, {
        allLabel: 'All Projects',
      }),
    [current.isTasks, current.optionRows, current.rows],
  );

  const mainTableColumns = useMemo(() => {
    if (current.isTasks) {
      return [
        { key: 'name', label: 'Task Name', filter: 'name' },
        { key: 'project', label: 'Project', filter: 'project' },
        { key: 'assignee', label: 'Assigned By', filter: 'assignee' },
        { key: 'start', label: 'Start Date' },
        { key: 'end', label: 'End Date' },
        { key: 'revised', label: 'Revised' },
        { key: 'delay', label: 'Delay' },
        { key: 'priority', label: 'Priority', filter: 'priority' },
        { key: 'status', label: 'Status', filter: 'status' },
      ];
    }
    // Same project columns for My Work and My Team
    return [
      { key: 'name', label: 'Project Name', filter: 'name' },
      { key: 'owner', label: 'Owner', filter: 'owner' },
      { key: 'progress', label: 'Progress' },
      { key: 'delay', label: 'Delay' },
      { key: 'end', label: 'End Date' },
      { key: 'revised', label: 'Revised' },
      { key: 'health', label: 'Health', filter: 'health' },
    ];
  }, [current.isTasks]);

  const mainTableColSpan = mainTableColumns.length + (showDraftBulkSelect ? 1 : 0);

  const mainColumnFilterProps = {
    name: {
      filterValue: nameFilter,
      onFilterChange: setNameFilter,
      filterOptions: current.isTasks ? taskNameOptions : projectNameOptions,
    },
    project: {
      filterValue: ownerOrProjectFilter,
      onFilterChange: setOwnerOrProjectFilter,
      filterOptions: projectOrOwnerOptions,
    },
    owner: {
      filterValue: ownerOrProjectFilter,
      onFilterChange: setOwnerOrProjectFilter,
      filterOptions: projectOrOwnerOptions,
    },
    assignee: {
      filterValue: assigneeFilter,
      onFilterChange: setAssigneeFilter,
      filterOptions: assigneeOptions,
    },
    priority: {
      filterValue: priorityOrHealthFilter,
      onFilterChange: setPriorityOrHealthFilter,
      filterOptions: priorityOrHealthOptions,
    },
    health: {
      filterValue: priorityOrHealthFilter,
      onFilterChange: setPriorityOrHealthFilter,
      filterOptions: priorityOrHealthOptions,
    },
    status: {
      filterValue: statusFilter,
      onFilterChange: setStatusFilter,
      filterOptions: [
        { value: 'all', label: 'All Status' },
        { value: '__pending__', label: 'Pending (open)' },
        { value: '__delayed__', label: 'With delay days' },
        { value: 'Overdue', label: 'Overdue' },
        { value: 'Completed', label: 'Completed' },
        ...statusColumnOptions.slice(1).filter((o) => !['Overdue', 'Completed'].includes(o.value)),
      ],
    },
  };

  useEffect(() => {
    if (tablePage > tableTotalPages) setTablePage(tableTotalPages);
  }, [tablePage, tableTotalPages]);

  const content = (
    <div className="min-w-0 bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff]">
      <div className="min-w-0 p-2 pb-5 sm:p-4 sm:pb-6">
        <div
          className="relative z-20 -mx-2 mb-3 min-w-0 overflow-visible border-b border-slate-200/60 bg-[#edf1ff]/95 px-3 py-2.5 sm:sticky sm:top-0 sm:z-30 sm:-mx-4 sm:mb-4 sm:bg-[#edf1ff]/90 sm:px-4 sm:py-2.5 sm:backdrop-blur-md"
          ref={headerStickyRef}
        >
          <div className="mx-auto flex max-w-[1800px] min-w-0 flex-col gap-2.5">
            {/* Identity left · scope / mode controls right (stacked on mobile) */}
            <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-w-0 items-center gap-2.5 sm:max-w-md sm:shrink">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1E62F0] text-sm font-bold text-white shadow-sm">
                  {(greetName || userName || 'U').charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-base font-semibold leading-snug tracking-tight text-slate-900">
                    {getGreeting()}, {greetName}
                  </h1>
                  <p className="mt-0.5 truncate text-[11px] leading-snug text-slate-500">
                    Project Manager · {scope === 'My Team' ? 'My Team' : 'My Work'} ·{' '}
                    {mode === 'SubTasks' ? 'Subtasks' : mode}
                  </p>
                </div>
              </div>

              <div className="flex w-full min-w-0 flex-col gap-2.5 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
                <div
                  className="grid w-full grid-cols-2 gap-0.5 rounded-xl border border-slate-200/90 bg-white p-0.5 shadow-sm sm:inline-flex sm:w-auto sm:shrink-0 sm:rounded-lg"
                  role="group"
                  aria-label="Work scope"
                >
                  {['My Work', 'My Team'].map((x) => (
                    <button
                      key={x}
                      onClick={() => {
                        setScope(x);
                        if (x === 'My Team') setSelectedMembers([]);
                      }}
                      type="button"
                      className={`min-h-[40px] rounded-lg px-2.5 text-[12px] font-semibold transition-all sm:min-h-0 sm:rounded-md sm:px-3 sm:py-1.5 sm:text-[11px] ${
                        scope === x
                          ? 'bg-[#1E62F0] text-white shadow-sm'
                          : 'bg-transparent text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {x}
                    </button>
                  ))}
                </div>

                {scope === 'My Team' ? (
                  teamMembers.length > 0 ? (
                    <PtSelect
                      value={selectedMembers.length === 1 ? selectedMembers[0] : ''}
                      onChange={(e) => {
                        const next = e.target.value;
                        setSelectedMembers(next ? [next] : []);
                      }}
                      leadingIcon="ri-team-line"
                      aria-label="Filter by team member"
                      className="w-full min-w-0 sm:min-w-[9.5rem] sm:max-w-[14rem] sm:shrink-0"
                      triggerClassName="text-xs py-1.5 h-auto min-h-[2.5rem] sm:min-h-[2rem]"
                      options={[
                        { value: '', label: `All Members (${teamMembers.length})` },
                        ...teamMembers.map((m) => ({ value: m.name, label: m.name })),
                      ]}
                    />
                  ) : (
                    <div className="inline-flex w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-medium text-slate-500 shadow-sm sm:w-auto sm:py-1.5">
                      {((mode === 'Tasks' && myTeamTasksLoading) ||
                        (mode === 'Projects' && myTeamProjectsLoading) ||
                        (mode === 'SubTasks' && myTeamSubtasksLoading)) ? (
                        <>
                          <i className="ri-loader-4-line animate-spin" />
                          Loading…
                        </>
                      ) : (
                        <>
                          <i className={
                            (mode === 'Tasks'
                              ? myTeamTasksError
                              : mode === 'SubTasks'
                                ? myTeamSubtasksError
                                : myTeamProjectsError)
                              ? 'ri-error-warning-line text-rose-500'
                              : 'ri-user-unfollow-line'
                          } />
                          {(mode === 'Tasks'
                            ? myTeamTasksError
                            : mode === 'SubTasks'
                              ? myTeamSubtasksError
                              : myTeamProjectsError)
                            ? 'Team unavailable'
                            : 'No members'}
                        </>
                      )}
                    </div>
                  )
                ) : null}

                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <div
                    className="grid min-w-0 flex-1 grid-cols-3 gap-0.5 rounded-xl border border-slate-200/90 bg-white p-0.5 shadow-sm sm:inline-flex sm:w-auto sm:flex-none sm:rounded-lg"
                    role="group"
                    aria-label="View mode"
                  >
                    {['Projects', 'Tasks', 'SubTasks'].map((x) => (
                      <button
                        key={x}
                        onClick={() => {
                          setMode(x);
                          if (scope === 'My Team') setSelectedMembers([]);
                          onModeChange?.(x);
                        }}
                        type="button"
                        className={`min-h-[40px] rounded-lg px-2 text-[11px] font-semibold transition-all sm:min-h-0 sm:rounded-md sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                          mode === x
                            ? 'bg-[#1E62F0] text-white shadow-sm'
                            : 'bg-transparent text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {x === 'SubTasks' ? 'Subtasks' : x}
                      </button>
                    ))}
                  </div>

                  <div className="shrink-0">
                    <SatelliteOrbitMenu
                      kfInstance={kfInstance}
                      placement="inline"
                      fanDirection="down"
                      options={PROJECT_TASK_SATELLITE_OPTIONS}
                      popupIds={USPT_POPUP_IDS}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Filters — Projects / Tasks only (Subtasks hub has its own toolbar) */}
            {mode !== 'SubTasks' ? (
            <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white/95 p-2 shadow-sm sm:flex sm:items-center sm:gap-2 sm:px-2 sm:py-1.5">
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-1 sm:items-center sm:gap-1.5 sm:overflow-x-auto sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
                <PtSelect
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  leadingIcon="ri-building-2-line"
                  aria-label="Filter by company"
                  className="min-w-0 w-full max-w-full sm:min-w-[9.5rem] sm:w-auto sm:shrink-0"
                  triggerClassName="text-xs py-1.5 h-auto min-h-[2.5rem] sm:min-h-[2rem] rounded-lg bg-slate-50/90 shadow-none"
                  options={[
                    { value: '', label: 'Company' },
                    ...companyOptions.map((opt) => ({ value: opt, label: opt })),
                  ]}
                />
                <PtSelect
                  value={lineOfBusinessFilter}
                  onChange={(e) => {
                    const next = e.target.value;
                    setLineOfBusinessFilter(next);
                    if (!isInformationTechnologyCategory(next)) setFunctionTypeFilter('');
                  }}
                  leadingIcon="ri-briefcase-line"
                  aria-label="Filter by business function"
                  className="min-w-0 w-full max-w-full sm:min-w-[10rem] sm:w-auto sm:shrink-0"
                  triggerClassName="text-xs py-1.5 h-auto min-h-[2.5rem] sm:min-h-[2rem] rounded-lg bg-slate-50/90 shadow-none"
                  options={[
                    { value: '', label: 'Functions' },
                    ...lineOfBusinessOptions.map((opt) => ({ value: opt, label: opt })),
                  ]}
                />
                {isInformationTechnologyCategory(lineOfBusinessFilter) ? (
                  <PtSelect
                    value={functionTypeFilter}
                    onChange={(e) => setFunctionTypeFilter(e.target.value)}
                    leadingIcon="ri-stack-line"
                    aria-label="Filter by function type"
                    className="min-w-0 w-full max-w-full sm:min-w-[9.5rem] sm:w-auto sm:shrink-0"
                    triggerClassName="text-xs py-1.5 h-auto min-h-[2.5rem] sm:min-h-[2rem] rounded-lg bg-slate-50/90 shadow-none"
                    options={[
                      { value: '', label: 'Function type' },
                      ...functionTypeOptions.map((opt) => ({ value: opt, label: opt })),
                    ]}
                  />
                ) : null}

                <DashboardPeriodPicker
                  mode={periodPickerState.mode}
                  range={periodPickerState.range}
                  ranges={periodPickerState.ranges}
                  parts={periodPickerState.parts}
                  fyStartYear={periodPickerState.fyStartYear}
                  summaryLabel={periodPickerState.summaryLabel}
                  onChange={handlePeriodChange}
                  className="min-w-0 w-full max-w-full sm:min-w-[9.5rem] sm:w-auto sm:shrink-0"
                  triggerClassName="text-xs py-1.5 h-auto min-h-[2.5rem] sm:min-h-[2rem] rounded-lg bg-slate-50/90 shadow-none"
                />

                <PtSelect
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  leadingIcon="ri-filter-3-line"
                  aria-label="Filter by status"
                  className="min-w-0 w-full max-w-full sm:min-w-[8.5rem] sm:w-auto sm:shrink-0"
                  triggerClassName="text-xs py-1.5 h-auto min-h-[2.5rem] sm:min-h-[2rem] rounded-lg bg-slate-50/90 shadow-none"
                  options={[
                    { value: 'all', label: 'Status' },
                    ...(current.isTasks
                      ? [
                          { value: '__pending__', label: 'Pending (open)' },
                          { value: '__delayed__', label: 'With delay days' },
                          { value: 'Overdue', label: 'Overdue' },
                          { value: 'Completed', label: 'Completed' },
                          ...Array.from(new Set(
                            (scope === 'My Team' ? myTeamTasks : apiTasks)
                              .map((t) => String(t.status || '').trim())
                              .filter((s) => s && !['Overdue', 'Completed'].includes(s)),
                          )).map((s) => ({ value: s, label: s })),
                        ]
                      : [
                          { value: '__attention__', label: 'Delayed / At Risk' },
                          { value: '__high_priority__', label: 'High priority' },
                          ...Array.from(new Set(
                            (scope === 'My Team' ? myTeamProjects : apiProjects)
                              .map((p) => String(p.health || '').trim())
                              .filter(Boolean),
                          )).map((s) => ({ value: s, label: s })),
                        ]),
                  ]}
                />
              </div>

              {hasActiveDimensionFilters || statusFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    clearDimensionFilters();
                    setStatusFilter('all');
                  }}
                  className="mt-2 w-full rounded-lg px-2 py-2 text-[11px] font-semibold text-[#1E88E5] transition hover:bg-blue-50 sm:mt-0 sm:w-auto sm:shrink-0 sm:py-1.5"
                >
                  Clear
                </button>
              ) : null}
            </div>
            ) : null}
          </div>
        </div>

        <div className="mx-auto max-w-[1800px] min-w-0 space-y-4">

        {mode === 'SubTasks' ? (
          <>
            {scope === 'My Team' && myTeamSubtasksError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 text-xs font-semibold text-rose-700">
                Failed to load My Team subtasks: {myTeamSubtasksError}
              </div>
            ) : null}
            <UserHubSubTasksPage
              embedded
              myTeamMode={scope === 'My Team'}
              myTeamRows={scope === 'My Team' ? myTeamSubtasks : null}
              myTeamLoading={scope === 'My Team' ? myTeamSubtasksLoading : false}
              selectedMembers={scope === 'My Team' ? selectedMembers : []}
              onOpenRow={scope === 'My Team' ? handleOpenMyTeamSubtaskDetail : undefined}
              processPopupId={scope === 'My Work' ? USPT_POPUP_IDS.subtask : undefined}
            />
          </>
        ) : (
        <>
        {apiError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 text-xs font-semibold text-rose-700">
            Failed to load data: {apiError}
          </div>
        ) : null}

        {scope === 'My Team' && mode === 'Projects' && myTeamProjectsError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 text-xs font-semibold text-rose-700">
            Failed to load My Team projects: {myTeamProjectsError}
          </div>
        ) : null}

        {scope === 'My Team' && mode === 'Tasks' && myTeamTasksError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 text-xs font-semibold text-rose-700">
            Failed to load My Team tasks: {myTeamTasksError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {current.kpis.map((card, idx) => (
              <PremiumKPICard
              key={card.key || card.title}
                title={card.title}
                value={card.value}
                subtitle={card.subtitle}
                trend={card.trend}
                icon={card.icon}
                theme={card.theme}
                index={idx}
              active={insightFocus?.key === card.key}
              onClick={card.key ? () => handleKpiClick(card.key) : undefined}
              />
            ))}
        </div>

        <div className="grid grid-cols-1 gap-3">
          {/* Focus Areas — temporarily disabled
          <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-lg shadow-slate-200/40 backdrop-blur-sm sm:p-4">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Focus Areas</h3>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3" key={`focus-${filterKey}`}>
              {[
                {
                  title: current.isTasks ? 'Overdue Tasks' : 'Delayed / At Risk',
                  sub: current.isTasks
                    ? `${current.overdueCount} tasks overdue in view`
                    : `${(current.atRiskCount || 0) + (current.delayedCount || 0)} projects need attention`,
                  count: current.isTasks ? current.overdueCount : (current.atRiskCount || 0) + (current.delayedCount || 0),
                  valueColor: 'text-[#EF4444]',
                  iconWrap: 'bg-red-500/15 ring-1 ring-red-500/30',
                  cardBg: 'from-rose-50/95 via-white to-red-50/75',
                  ringHover: 'group-hover:ring-red-400/25',
                  borderHover: 'hover:border-red-300/55',
                  glow: 'rgba(239,68,68,0.2)',
                  icon: 'ri-alarm-warning-line',
                },
                {
                  title: current.isTasks
                    ? (current.isTeam ? 'Pending Tasks' : 'Pending Tasks')
                    : 'High Priority',
                  sub: current.isTasks
                    ? `${current.pendingCount} tasks pending / in progress`
                    : `${current.highPriorityCount || 0} high priority projects`,
                  count: current.isTasks ? current.pendingCount : (current.highPriorityCount || 0),
                  valueColor: 'text-[#F59E0B]',
                  iconWrap: 'bg-amber-500/15 ring-1 ring-amber-500/30',
                  cardBg: 'from-amber-50/95 via-white to-yellow-50/70',
                  ringHover: 'group-hover:ring-amber-400/25',
                  borderHover: 'hover:border-amber-300/60',
                  glow: 'rgba(245,158,11,0.2)',
                  icon: current.isTasks ? 'ri-folder-open-line' : 'ri-flag-2-line',
                },
                {
                  title: current.isTasks ? 'Completed' : 'Completed',
                  sub: current.isTasks
                    ? `${current.completedCount} tasks completed`
                    : `${current.completedProjects} projects completed`,
                  count: current.isTasks ? current.completedCount : current.completedProjects,
                  valueColor: 'text-[#22C55E]',
                  iconWrap: 'bg-emerald-500/15 ring-1 ring-emerald-500/25',
                  cardBg: 'from-emerald-50/95 via-white to-green-50/80',
                  ringHover: 'group-hover:ring-emerald-400/25',
                  borderHover: 'hover:border-emerald-300/60',
                  glow: 'rgba(34,197,94,0.22)',
                  icon: 'ri-checkbox-circle-line',
                },
              ].map((x) => (
                <motion.button
                  key={x.title}
                  type="button"
                  onClick={() => handleFocusAreaClick(x.title)}
                  className={`
                    group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-3.5 text-left
                    ${insightFocus?.label === x.title || (x.title === 'Delayed / At Risk' && insightFocus?.key === 'attention') ? 'border-[#1E88E5] ring-2 ring-[#1E88E5]/35' : 'border-slate-200/88'}
                    ${x.cardBg}
                    transition-[box-shadow,border-color] duration-300 ease-out
                    hover:shadow-[0_20px_48px_-16px_rgba(15,23,42,0.22)] hover:shadow-slate-400/20
                    hover:ring-2 ring-transparent
                    ${x.ringHover}
                    ${x.borderHover}
                  `}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div
                    className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                    style={{ background: x.glow }}
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/0 via-transparent to-slate-100/35 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                  <div className="relative flex w-full items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{x.title}</p>
                      <p className={`mt-1 text-2xl font-bold tabular-nums leading-none ${x.valueColor}`}>{x.count}</p>
                      <p className="mt-1 text-[11px] font-medium text-slate-500">{x.sub}</p>
                    </div>
                    <span className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${x.iconWrap} ${x.ringHover}`}>
                      <i className={`${x.icon} text-lg ${x.valueColor}`} />
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          */}

          {/* Workload Summary — hidden so Focus Areas + table use full width
          <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-lg shadow-slate-200/40 backdrop-blur-sm sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">Workload Summary</h3>
              <button type="button" className="rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm transition hover:bg-white/80">This Month <i className="ri-arrow-down-sline" /></button>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex h-24 w-24 items-center justify-center">
                <svg className="absolute inset-0 h-24 w-24" viewBox="0 0 48 48" aria-hidden>
                  {(() => {
                    const radius = 20;
                    const circumference = 2 * Math.PI * radius;
                    const stroke = 7;
                    let acc = 0;
                    const colorFor = (label) => {
                      if (label === 'On Track' || label === 'Completed') return '#43A047';
                      if (label === 'At Risk' || label === 'Pending') return '#FB8C00';
                      return '#E53935';
                    };

                    return (
                      <>
                        <circle
                          cx="24"
                          cy="24"
                          r={radius}
                          fill="none"
                          stroke="#EEF2F7"
                          strokeWidth={stroke}
                        />
                        {current.legend.map((seg) => {
                          const pct = Number(seg.pct) || 0;
                          const len = (pct / 100) * circumference;
                          const dasharray = `${len} ${circumference - len}`;
                          const dashoffset = -acc;
                          acc += len;
                          return (
                            <circle
                              key={seg.label}
                              cx="24"
                              cy="24"
                              r={radius}
                              fill="none"
                              stroke={colorFor(seg.label)}
                              strokeWidth={stroke}
                              strokeDasharray={dasharray}
                              strokeDashoffset={dashoffset}
                              strokeLinecap="round"
                              transform="rotate(-90 24 24)"
                            />
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>

                <div className="relative text-center">
                  <p className="text-2xl font-bold text-slate-900">{current.total}</p>
                  <p className="text-[10px] text-slate-500">{current.isTasks ? 'Total Tasks' : 'Total Projects'}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {current.legend.map((x) => (
                  <div key={x.label} className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${x.color}`} />
                    <span className="text-[11px] font-medium text-slate-700">{x.label}</span>
                    <span className="ml-auto text-[11px] font-bold text-slate-800">{x.value}</span>
                    <span className="text-[11px] text-slate-500">({x.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          */}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div
            ref={tableSectionRef}
            className={`min-w-0 rounded-2xl border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm transition-[box-shadow,ring] duration-500 ${
              insightFocus?.pulse
                ? 'ring-2 ring-[#1E88E5] ring-offset-2 ring-offset-[#edf1ff] shadow-[0_0_0_6px_rgba(30,136,229,0.12)]'
                : ''
            }`}
          >
            <div className="flex flex-col gap-2 border-b border-slate-200/80 px-3 py-3 sm:px-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">
                    {scope === 'My Work' ? `All ${mode}` : `Team ${mode}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {tableTotal} {mode.toLowerCase()} found
                    {tableTotalPages > 1 ? ` · ${PT_TABLE_PAGE_SIZE} per page` : ''}
                    {!current.isTasks ? ' · chevron expands tasks · name opens details' : ''}
                    {current.isTasks ? ' · chevron expands subtasks' : ''}
                  </p>
                </div>
                {showDraftBulkSelect && selectedDraftIds.size > 0 ? (
                  <button
                    type="button"
                    onClick={handleDeleteDrafts}
                    disabled={deletingDrafts}
                    className="inline-flex min-h-[36px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <i className="ri-delete-bin-6-line text-sm" aria-hidden />
                    {deletingDrafts ? 'Deleting…' : `Delete (${selectedDraftIds.size})`}
                  </button>
                ) : null}
              </div>
              <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
                <div className="relative min-w-0 w-full sm:max-w-xs sm:flex-1 lg:w-56 lg:flex-none">
                  <i className="ri-search-line pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={mode === 'Tasks' ? 'Search tasks...' : 'Search projects...'}
                    className="h-9 w-full rounded-xl border border-slate-200/80 bg-white pl-8 pr-3 text-xs outline-none shadow-sm focus:border-[#1E88E5]"
                  />
                </div>
                <PtSelect
                  value={ownerOrProjectFilter}
                  onChange={(e) => setOwnerOrProjectFilter(e.target.value)}
                  className="min-w-0 w-full sm:min-w-[9.5rem] sm:w-auto"
                  aria-label={mode === 'Tasks' ? 'Filter by project' : 'Filter by owner'}
                  options={projectOrOwnerOptions}
                />
                <PtSelect
                  value={priorityOrHealthFilter}
                  onChange={(e) => setPriorityOrHealthFilter(e.target.value)}
                  className="min-w-0 w-full sm:min-w-[9.5rem] sm:w-auto"
                  aria-label={mode === 'Tasks' ? 'Filter by priority' : 'Filter by project health'}
                  options={priorityOrHealthOptions}
                />
              </div>
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table
                className="w-full min-w-[720px]"
                key={`table-${filterKey}`}
              >
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50/80">
                    {showDraftBulkSelect ? (
                      <th className="w-10 px-3 py-3 sm:px-4">
                        <input
                          type="checkbox"
                          aria-label="Select all draft tasks on this page"
                          checked={allDraftPageSelected}
                          onChange={(e) => handleToggleAllDraftsSelect(e.target.checked, draftPageRowIds)}
                          className="h-4 w-4 rounded border-slate-300 text-[#1E62F0] focus:ring-[#1E62F0]"
                        />
                      </th>
                    ) : null}
                    {mainTableColumns.map((col) => {
                      const filterCfg = col.filter ? mainColumnFilterProps[col.filter] : null;
                      return (
                        <TableColumnHeader
                          key={col.key}
                          col={col}
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onSort={handleTableSort}
                          filterValue={filterCfg?.filterValue}
                          filterOptions={filterCfg?.filterOptions}
                          onFilterChange={filterCfg?.onFilterChange}
                          className="px-3 py-3 sm:px-5"
                        />
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={mainTableColSpan}
                        className="px-5 py-12 text-center text-sm text-slate-500"
                      >
                        No {mode.toLowerCase()} found
                      </td>
                    </tr>
                  ) : null}
                  {pageRows.map((row) => {
                    const projectExpanded = !current.isTasks && expandedProjectId === row.id;
                    const projectColSpan = mainTableColSpan;
                    const projectAccordionTasks = isMyWork ? apiTasks : myTeamTasks;
                    const childSubtasks = current.isTasks
                      ? filterSubtasksForTask(apiProcessSubtasks, resolveTaskBusinessIdFromRow(row))
                      : [];
                    const hasExistingSubtasks = childSubtasks.length > 0;
                    const canAddSubtask =
                      current.isTasks &&
                      typeof handleCreateSubtaskForTask === 'function' &&
                      !isTaskCompleted(row.status);
                    // Completed tasks keep expand when they already have subtasks; create stays blocked.
                    const showTaskNested = current.isTasks && (hasExistingSubtasks || canAddSubtask);
                    const taskExpanded = current.isTasks && expandedTaskIds.has(row.id);
                    const draftSelectId = showDraftBulkSelect ? resolveTaskDraftDeleteId(row) : '';

                    return (
                    <Fragment key={row.id}>
                    <motion.tr
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      onClick={() => {
                        if (current.isTasks) {
                          handleOpenTaskDetail(row);
                        }
                      }}
                      className={`border-t border-slate-200/70 hover:bg-slate-50/75 ${
                        current.isTasks ? 'cursor-pointer' : ''
                      } ${projectExpanded || taskExpanded ? 'bg-slate-50/70' : ''}`}
                    >
                      {showDraftBulkSelect ? (
                        <td
                          className="px-3 py-3 sm:px-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select draft ${row.name || ''}`}
                            checked={draftSelectId ? selectedDraftIds.has(draftSelectId) : false}
                            onChange={() => handleToggleDraftSelect(draftSelectId)}
                            className="h-4 w-4 rounded border-slate-300 text-[#1E62F0] focus:ring-[#1E62F0]"
                          />
                        </td>
                      ) : null}
                      {current.isTasks ? (
                        <>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <TaskExpandToggle
                                visible={showTaskNested}
                                expanded={taskExpanded}
                                onToggle={(e) => toggleTaskExpand(row.id, e)}
                              />
                              <div className="min-w-0">
                              <p className="text-[11px] font-normal leading-none text-slate-800">{row.name}</p>
                                {hasExistingSubtasks ? (
                                  <p className="text-[10px] font-medium text-[#FB8C00]">
                                    {childSubtasks.length} subtask{childSubtasks.length === 1 ? '' : 's'}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <UsptProjectCell projectName={row.project} />
                          </td>
                          <td className="px-5 py-3">
                            <PtUserAvatar name={row.assignee} initials={row.initials} />
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-[11px] text-slate-700">{row.start}</td>
                          <td className="whitespace-nowrap px-5 py-3 text-[11px] text-slate-700">{row.end}</td>
                          <td className="px-5 py-3">
                            {row.revisedCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-[#FB8C00]">
                                <i className="ri-refresh-line text-[10px]" />
                                {row.revisedCount}x
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                String(row.delay).includes('+') ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                              }`}
                            >
                              {row.delay}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                row.priority === 'High'
                                  ? 'bg-rose-100 text-rose-700'
                                  : row.priority === 'Medium'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {row.priority}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeColor(row.status)}`}>{row.status}</span>
                              <CompletedStatusUpdate status={row.status} onUpdate={() => handleOpenTaskDetail(row)} />
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 py-3">
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleProjectExpand(row);
                                }}
                                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                aria-label={projectExpanded ? 'Collapse project tasks' : 'Expand project tasks'}
                                aria-expanded={projectExpanded}
                              >
                                <i
                                  className={`ri-arrow-down-s-line text-base transition-transform duration-200 ${projectExpanded ? 'rotate-180' : ''}`}
                                  aria-hidden
                                />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isMyWork) openMyWorkProjectPopup(row);
                                  else handleOpenProjectDetail(row);
                                }}
                                className="text-left text-[11px] font-normal text-slate-800 transition hover:text-[#1E62F0] hover:underline"
                              >
                                {row.name}
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <PtUserAvatar
                              name={row.owner}
                              initials={row.ownerAvatar || toInitials(row.owner)}
                            />
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-[11px] font-bold text-blue-700">{row.progress}%</td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                String(row.delay).includes('+') ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {row.delay}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-[11px] text-slate-700">{row.end}</td>
                          <td className="px-5 py-3">
                            {row.revisedCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-[#FB8C00]">
                                <i className="ri-refresh-line text-[10px]" />
                                {row.revisedCount}x
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                row.health === 'On Track' || row.health === 'Completed'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : row.health === 'At Risk'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {row.health}
                            </span>
                          </td>
                        </>
                      )}
                    </motion.tr>
                    {projectExpanded ? (
                      <tr className="bg-slate-50/95">
                        <td colSpan={projectColSpan} className="p-0 align-top">
                          <MyWorkProjectTasksPanel
                            project={row}
                            allTasks={projectAccordionTasks}
                            processSubtasks={apiProcessSubtasks}
                            onCreateTask={handleCreateTaskForProject}
                            onOpenTask={openMyWorkProjectAccordionTaskDetail}
                            onCreateSubtask={handleCreateSubtaskForTask}
                            onOpenSubtask={openUsptSubtaskDetail}
                            creating={creatingTaskProjectId === row.id}
                            creatingSubtaskTaskId={creatingSubtaskTaskId}
                          />
                        </td>
                      </tr>
                    ) : null}
                    {showTaskNested && taskExpanded ? (
                      <tr className="bg-slate-50/95">
                        <td colSpan={mainTableColSpan} className="px-5 py-4 align-top">
                          <UsptTaskSubtasksPanel
                            task={row}
                            processSubtasks={apiProcessSubtasks}
                            onOpenSubtask={openUsptSubtaskDetail}
                            onCreateSubtask={handleCreateSubtaskForTask}
                            creating={creatingSubtaskTaskId === row.id}
                          />
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                    );
                  })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            <div className="space-y-2.5 p-2.5 sm:p-3 lg:hidden" key={`cards-${filterKey}`}>
              {pageRows.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">No {mode.toLowerCase()} found</p>
              ) : pageRows.map((row) => {
                const projectExpanded = !current.isTasks && expandedProjectId === row.id;
                const projectAccordionTasks = isMyWork ? apiTasks : myTeamTasks;
                if (current.isTasks) {
                  const childSubtasks = filterSubtasksForTask(
                    apiProcessSubtasks,
                    resolveTaskBusinessIdFromRow(row),
                  );
                  const hasExistingSubtasks = childSubtasks.length > 0;
                  const canAddSubtask =
                    typeof handleCreateSubtaskForTask === 'function' && !isTaskCompleted(row.status);
                  const showTaskNested = hasExistingSubtasks || canAddSubtask;
                  const taskExpanded = expandedTaskIds.has(row.id);
                  const draftSelectId = showDraftBulkSelect ? resolveTaskDraftDeleteId(row) : '';

                  return (
                    <div
                      key={row.id}
                      className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100 ${taskExpanded ? 'ring-[#1E88E5]/30' : ''}`}
                    >
                      <div className="flex items-center gap-2 p-3">
                        {showDraftBulkSelect ? (
                          <input
                            type="checkbox"
                            aria-label={`Select draft ${row.name || ''}`}
                            checked={draftSelectId ? selectedDraftIds.has(draftSelectId) : false}
                            onChange={() => handleToggleDraftSelect(draftSelectId)}
                            className="h-4 w-4 shrink-0 rounded border-slate-300 text-[#1E62F0] focus:ring-[#1E62F0]"
                          />
                        ) : null}
                        <TaskExpandToggle
                          visible={showTaskNested}
                          expanded={taskExpanded}
                          onToggle={() => toggleTaskExpand(row.id)}
                          sizeClass="h-7 w-7"
                          iconClass="text-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleOpenTaskDetail(row)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-normal text-slate-900">{row.name}</p>
                              <p className="mt-0.5">
                                {isEmptyProjectName(row.project) ? (
                                  <span className="inline-flex items-center rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-normal text-violet-700 ring-1 ring-violet-200/80">
                                    Individual Task
                                  </span>
                                ) : (
                                  <span className="truncate text-[10px] font-normal text-[#1E88E5]">{row.project}</span>
                                )}
                              </p>
                              {hasExistingSubtasks ? (
                                <p className="mt-0.5 text-[10px] font-medium text-[#FB8C00]">
                                  {childSubtasks.length} subtask{childSubtasks.length === 1 ? '' : 's'}
                                </p>
                              ) : null}
          </div>
                            <span className="inline-flex shrink-0 items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeColor(row.status)}`}>
                                {row.status}
                              </span>
                              <CompletedStatusUpdate status={row.status} onUpdate={() => handleOpenTaskDetail(row)} />
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                            <PtUserAvatar name={row.assignee} initials={row.initials} sizeClass="h-6 w-6" textClass="text-[9px]" />
                            <span className="shrink-0">{row.end || '—'}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                String(row.delay).includes('+') ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                              }`}
                            >
                              {row.delay}
                            </span>
                            {row.revisedCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-[#FB8C00]">
                                <i className="ri-refresh-line text-[10px]" />
                                {row.revisedCount}x
                              </span>
                            ) : null}
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                row.priority === 'High'
                                  ? 'bg-rose-100 text-rose-700'
                                  : row.priority === 'Medium'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {row.priority}
                            </span>
                          </div>
                        </button>
                      </div>
                      {showTaskNested && taskExpanded ? (
                        <div className="border-t border-slate-100 bg-slate-50/90 px-3 py-3">
                          <UsptTaskSubtasksPanel
                            task={row}
                            processSubtasks={apiProcessSubtasks}
                            onOpenSubtask={openUsptSubtaskDetail}
                            onCreateSubtask={handleCreateSubtaskForTask}
                            creating={creatingSubtaskTaskId === row.id}
                            compact
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <div
                    key={row.id}
                    className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100 ${projectExpanded ? 'ring-[#1E88E5]/30' : ''}`}
                  >
                    <div className="flex items-start gap-2 p-3">
              <button
                type="button"
                        onClick={() => toggleProjectExpand(row)}
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label={projectExpanded ? 'Collapse project tasks' : 'Expand project tasks'}
                        aria-expanded={projectExpanded}
                      >
                        <i className={`ri-arrow-down-s-line text-lg transition-transform ${projectExpanded ? 'rotate-180' : ''}`} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isMyWork) openMyWorkProjectPopup(row);
                          else handleOpenProjectDetail(row);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-normal text-slate-900 hover:text-[#1E62F0] hover:underline">{row.name}</p>
                        <div className="mt-0.5">
                          <PtUserAvatar
                            name={row.owner}
                            initials={row.ownerAvatar || toInitials(row.owner)}
                            sizeClass="h-6 w-6"
                            textClass="text-[9px]"
                          />
                        </div>
                      </button>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          row.health === 'On Track' || row.health === 'Completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : row.health === 'At Risk'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {row.health}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleProjectExpand(row)}
                      className="grid w-full grid-cols-2 gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-[11px] text-slate-600"
                    >
                      <span>Progress <strong className="text-blue-700">{row.progress}%</strong></span>
                      <span className="text-right">End <strong className="text-slate-800">{row.end || '—'}</strong></span>
                      <span
                        className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          String(row.delay).includes('+') ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {row.delay}
                      </span>
                      {row.revisedCount > 0 ? (
                        <span className="inline-flex w-fit items-center justify-self-end gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-[#FB8C00]">
                          <i className="ri-refresh-line text-[10px]" />
                          {row.revisedCount}x revised
                        </span>
                      ) : (
                        <span className="justify-self-end text-[10px] text-slate-400">Revised —</span>
                      )}
                    </button>
                    {projectExpanded ? (
                      <div className="border-t border-slate-100 bg-slate-50/90">
                        <MyWorkProjectTasksPanel
                          project={row}
                          allTasks={projectAccordionTasks}
                          processSubtasks={apiProcessSubtasks}
                          onCreateTask={handleCreateTaskForProject}
                          onOpenTask={openMyWorkProjectAccordionTaskDetail}
                          onCreateSubtask={handleCreateSubtaskForTask}
                          onOpenSubtask={openUsptSubtaskDetail}
                          creating={creatingTaskProjectId === row.id}
                          creatingSubtaskTaskId={creatingSubtaskTaskId}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <TablePaginationBar
              total={tableTotal}
              page={safeTablePage}
              onPageChange={setTablePage}
              pageSize={PT_TABLE_PAGE_SIZE}
            />
          </div>

          {/* Team Overview / Project Health sidebar — hidden so table stretches full width
          {!isMyWork ? (
          <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-3 py-3 sm:px-4">
              <h3 className="min-w-0 truncate text-sm font-bold text-slate-900">{current.isTasks ? 'Team Overview' : 'Project Health'}</h3>
              <button
                type="button"
                className="shrink-0 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm transition hover:bg-white/80"
              >
                {scope === 'My Team'
                  ? selectedMembers.length === 0
                    ? 'All Members'
                    : selectedMembers.length === 1
                      ? selectedMembers[0]
                      : `${selectedMembers.length} selected`
                  : 'All Members'}{' '}
                <i className="ri-arrow-down-sline" />
              </button>
            </div>
            <div className="overflow-x-auto px-3 py-3 sm:px-4">
              {current.isTasks ? (
                <>
                  <div className="mb-2 grid min-w-[280px] grid-cols-[minmax(0,1fr)_3.5rem_4.5rem_3.75rem] gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    <span> </span>
                    <span className="text-right">Tasks</span>
                    <span className="text-right">Done</span>
                    <span className="text-right">Late</span>
                  </div>
                  <div className="min-w-[280px] space-y-2.5">
                    {teamOverviewRows.map((row) => (
                      <div key={row.name} className="grid grid-cols-[minmax(0,1fr)_3.5rem_4.5rem_3.75rem] items-center gap-1 rounded-xl border border-slate-200/70 bg-white px-2.5 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${row.color}`}>{row.initials}</span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-800">{row.name}</p>
                            <p className="truncate text-[10px] text-slate-500">{row.role}</p>
                          </div>
                        </div>
                        <span className="text-right text-xs font-semibold text-slate-700">{row.tasks}</span>
                        <span className="text-right text-xs font-semibold text-slate-700">{row.completed}</span>
                        <span className="text-right text-xs font-semibold text-rose-600">{row.overdue}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3"><div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-8 border-blue-100"><div className="absolute inset-0 rounded-full border-8 border-t-emerald-500 border-r-amber-500 border-b-rose-500 border-l-blue-200" /><span className="relative text-lg font-bold text-slate-900">{current.total}</span></div><div className="min-w-0 space-y-1">{current.legend.map((x) => <p key={x.label} className="text-xs text-slate-600"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${x.color}`} />{x.label} <span className="font-semibold">{x.pct}%</span></p>)}</div></div>
                  <div className="border-t border-slate-200/70 pt-2">{current.rows.slice(0, 3).map((r) => <div key={r.name} className="flex items-center justify-between gap-2 py-1"><p className="min-w-0 truncate text-xs text-slate-700">{r.name}</p><span className="shrink-0 text-xs font-semibold text-rose-600">{r.delay}</span></div>)}</div>
                </div>
              )}
            </div>
          </div>
          ) : null}
          */}
        </div>

        </>
        )}

        {/* Quick Filters removed per request */}
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
