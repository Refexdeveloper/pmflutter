/* eslint-disable max-lines -- Single-file Kissflow + app dashboard bundle */
import { useState, useCallback, useContext, useEffect, useRef, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from './components/feature/AppLayout.jsx';
import PtSelect from './components/PtSelect.jsx';
import DashboardPeriodPicker, {
  getEmptyPeriodState,
} from './components/DashboardPeriodPicker.jsx';
import MobileFilterSheet, {
  MobileFiltersButton,
  MobileActiveFilterChips,
  MobileFilterField,
  useIsDesktopLg,
} from './components/MobileFilterSheet.jsx';
import PtUserAvatar from './components/PtUserAvatar.jsx';
import UserHubWelcome from './components/UserHubWelcome.jsx';
import TablePaginationBar, { PT_TABLE_PAGE_SIZE } from './components/TablePaginationBar.jsx';
import SubtaskAccordionRow from './components/SubtaskAccordionRow.jsx';
import CompletedStatusUpdate from './components/CompletedStatusUpdate.jsx';
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
  createTaskInstance,
  createSubtaskInstance,
  openTaskDraft,
  openSubtaskDraft,
  fetchAllSubtasks,
  filterSubtasksForTask,
} from './lib/kfProjectTrackerKarthika.js';
import { kfGetJson, resolveKissflowAccountId, fetchAllPagedRows } from './lib/kfRuntime.js';
import { cacheKey, getCachedOrLoad } from './lib/kfListCache.js';
import { requestOpenTaskDetails } from './lib/pmTaskDetails.js';
import { requestOpenSubtaskDetails } from './lib/pmSubtaskDetails.js';
import { taskRowToFormDefaults, subtaskRowToFormDefaults } from './lib/pmFormDefaults.js';
import {
  ensureTaskBusinessIdForCreate,
  fetchTaskTrackerData,
  resolveTaskBusinessIdFromRow,
} from './lib/kfTaskTracker.js';
import { fetchMyTeamProjects } from './lib/kfMyTeamProjects.js';
import {
  fetchMyTeamTasks,
  filterTasksByManagerEmail,
  filterTasksByAllowedProjects,
} from './lib/kfMyTeamTasks.js';
import { fetchEmployeeDashboardProjects } from './lib/kfEmployeeProjectsReport.js';

/** --- Kissflow API / data layer (from kfProjectDashboard) --- */
/** Kissflow Project Management case — shared list/detail mapping & fetch (CTO + employee dashboards). */

const DEFAULT_ACCOUNT_ID = 'AcCMptp3yqcn';
const CASE_ID = 'Project_Management_A01';

const getAccountId = (kfInstance) => resolveKissflowAccountId(kfInstance, DEFAULT_ACCOUNT_ID);
const getFieldsPath = (accountId) => `/case/2/${accountId}/${CASE_ID}/fields`;
/** Prefer case /list (honors page_size). View list/items caps ~21/page and needs walking. */
const getProjectListPath = (accountId, pageNumber = 1, pageSize = 500) =>
  `/case/2/${accountId}/${CASE_ID}/list?page_number=${Math.max(1, Number(pageNumber) || 1)}&page_size=${Math.max(1, Math.min(1000, Number(pageSize) || 500))}`;
const getProjectViewItemsPath = (accountId, pageNumber = 1, pageSize = 100) =>
  `/case/2/${accountId}/${CASE_ID}/view/Project_Management_A01_all/list/items?page_number=${Math.max(1, Number(pageNumber) || 1)}&page_size=${Math.max(1, Number(pageSize) || 100)}`;

/** Load every project case item (prod has 55+; view endpoint only returns ~21 without pagination). */
async function fetchAllProjectListItems(kfInstance, accountId) {
  const list = await fetchAllPagedRows(kfInstance, (page, pageSize) =>
    getProjectListPath(accountId, page, pageSize),
  );
  if (list.length) return list;
  return fetchAllPagedRows(
    kfInstance,
    (page, pageSize) => getProjectViewItemsPath(accountId, page, pageSize),
    { pageSize: 100 },
  );
}

function resolveRoleName(roleLike) {
  if (!roleLike) return '';
  if (typeof roleLike === 'string') return roleLike.trim();
  if (typeof roleLike === 'object') return String(roleLike.Name || roleLike.name || '').trim();
  return '';
}

function getGreetingText() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function toInitials(name) {
  const txt = String(name || '').trim();
  if (!txt) return 'NA';
  const parts = txt.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || 'NA';
}

function parseKfDate(dateLike) {
  if (!dateLike) return null;
  if (dateLike instanceof Date) {
    return Number.isNaN(dateLike.getTime()) ? null : dateLike;
  }
  if (typeof dateLike === 'object') {
    const nested =
      dateLike.Date ||
      dateLike.date ||
      dateLike.Value ||
      dateLike.value ||
      dateLike.New_Revised_Date ||
      dateLike._created_at;
    if (nested && nested !== dateLike) return parseKfDate(nested);
  }
  const cleaned = String(dateLike).replace(/\s+[A-Za-z_\/]+$/, '').trim();
  if (!cleaned || cleaned === '—' || cleaned === '-') return null;
  // Date-only strings as local calendar days (avoid UTC midnight shifting the day).
  const ymd = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]) - 1;
    const day = Number(ymd[3]);
    const local = new Date(y, m, day);
    return Number.isNaN(local.getTime()) ? null : local;
  }
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d) {
  if (!d) return null;
  const local = d instanceof Date ? d : parseKfDate(d);
  if (!local) return null;
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mapStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('complete')) return 'Completed';
  if (s.includes('plan') || s.includes('new') || s.includes('notstart')) return 'Planning';
  if (s.includes('hold')) return 'On Hold';
  return 'Active';
}

/** Days before end date when a lagging project becomes At Risk (Amber). */
const RAG_AT_RISK_WINDOW_DAYS = 14;
/** How far behind expected linear progress (%) before At Risk. */
const RAG_PROGRESS_SLACK_PCT = 10;

function isClosedProjectStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return s.includes('complete') || s.includes('closed') || s === 'done';
}

/** Local calendar date at 00:00 — avoids UTC timezone flipping day comparisons. */
function toLocalDateOnly(dateLike) {
  if (dateLike instanceof Date && !Number.isNaN(dateLike.getTime())) {
    return new Date(dateLike.getFullYear(), dateLike.getMonth(), dateLike.getDate());
  }
  const parsed = parseKfDate(dateLike);
  if (!parsed) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function calendarDaysPast(endDateLike, now = new Date()) {
  const end = toLocalDateOnly(endDateLike);
  const today = toLocalDateOnly(now);
  if (!end || !today) return 0;
  const diff = Math.round((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

/** Calendar days past effective end; 0 when closed/completed or not yet overdue. */
function computeProjectDelayDays(status, endDateLike, now = new Date()) {
  if (isClosedProjectStatus(status)) return 0;
  return calendarDaysPast(endDateLike, now);
}

/**
 * Project Health RAG — schedule + progress only (never Kissflow RAG_Calculation).
 * - Closed/Completed → Green (On Track)
 * - Red (Delayed) → ONLY when effective end date is before today
 * - Amber (At Risk) → open, not overdue, but behind expected progress
 * - Green (On Track) → otherwise (e.g. Adonis Jul–Dec with future end)
 */
function computeProjectRag({ status, delayDays, progress, startDate, endDate, now = new Date() }) {
  if (isClosedProjectStatus(status)) return 'Green';

  const overdueDays = Number(delayDays) > 0
    ? Number(delayDays)
    : calendarDaysPast(endDate, now);
  if (overdueDays > 0) return 'Red';

  const start = toLocalDateOnly(startDate);
  const end = toLocalDateOnly(endDate);
  const today = toLocalDateOnly(now);
  const progressPct = Number.isFinite(Number(progress))
    ? Math.max(0, Math.min(100, Number(progress)))
    : 0;

  if (start && end && today && end.getTime() > start.getTime()) {
    const totalMs = end.getTime() - start.getTime();
    const elapsedMs = Math.min(Math.max(today.getTime() - start.getTime(), 0), totalMs);
    const expectedPct = (elapsedMs / totalMs) * 100;
    const daysLeft = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const behind = progressPct < expectedPct - RAG_PROGRESS_SLACK_PCT;

    if (behind && daysLeft <= RAG_AT_RISK_WINDOW_DAYS) return 'Amber';
    if (behind && expectedPct >= 50) return 'Amber';
  } else if (end && today && end.getTime() >= today.getTime()) {
    const daysLeft = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= RAG_AT_RISK_WINDOW_DAYS && progressPct < 70) return 'Amber';
  }

  return 'Green';
}

/** Prefer latest revised end, else planned/original end. */
function resolveEffectiveProjectEndDate(revisedEndDate, originalEndDateLike) {
  return toLocalDateOnly(revisedEndDate) || toLocalDateOnly(originalEndDateLike);
}

function mapSubtaskStatus(raw, endDate) {
  const s = String(raw || '').trim().toLowerCase();
  const completed = s.includes('complete') || s.includes('closed') || s.includes('done');
  if (completed) return 'Completed';
  const due = parseKfDate(endDate);
  if (due && due < new Date()) return 'Overdue';
  if (s.includes('progress') || s.includes('review')) return 'In Progress';
  if (s.includes('overdue') || s.includes('delay')) return 'Overdue';
  return 'Pending';
}

function getQuarterKey(date) {
  const d = date instanceof Date ? date : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

function getQuarterBounds(date) {
  const d = date instanceof Date ? date : new Date();
  const year = d.getFullYear();
  const qIndex = Math.floor(d.getMonth() / 3); // 0..3
  const startMonth = qIndex * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 1); // exclusive
  return { start, end, qIndex, year };
}

function computeQuarterOverQuarterTrend(projects) {
  const now = new Date();
  const { start: curStart, end: curEnd, qIndex, year } = getQuarterBounds(now);
  const prevStart = qIndex === 0 ? new Date(year - 1, 9, 1) : new Date(year, (qIndex - 1) * 3, 1);
  const prevEnd = curStart;

  const items = Array.isArray(projects) ? projects : [];
  const startDates = items
    .map((p) => parseKfDate(p?.startDate) || parseKfDate(p?.createdAt) || parseKfDate(p?._created_at))
    .filter(Boolean);

  const curCount = startDates.filter((d) => d >= curStart && d < curEnd).length;
  const prevCount = startDates.filter((d) => d >= prevStart && d < prevEnd).length;

  if (prevCount === 0) {
    if (curCount === 0) return { label: '+0%', positive: true };
    return { label: '+100%', positive: true };
  }

  const pct = ((curCount - prevCount) / prevCount) * 100;
  const rounded = Math.round(pct);
  const sign = rounded > 0 ? '+' : '';
  return { label: `${sign}${rounded}%`, positive: rounded >= 0 };
}

function pickDisplayRef(detail, item, subtasks, fallbackId) {
  const candidates = [
    detail?.Task_ID,
    detail?.Task_Id,
    detail?.TaskID,
    detail?.Project_Task_ID,
    detail?.Project_ID,
    detail?.Project_Id,
    detail?.ProjectID,
    detail?.Project_Code,
    detail?.Code,
    item?.Task_ID,
    item?.TaskId,
    item?.Project_ID,
    item?.ProjectId,
    item?.Project_Code,
    item?.Code,
    subtasks?.[0]?.Subtask_ID,
    subtasks?.[0]?._id,
  ];
  const normalized = candidates.map((v) => String(v ?? '').trim()).find(Boolean);
  return normalized || String(fallbackId ?? '');
}

function extractPersonRef(personLike, fallbackName) {
  if (!personLike || typeof personLike !== 'object') {
    return {
      name: String(fallbackName || '').trim(),
      id: '',
      email: '',
    };
  }
  return {
    name: String(personLike.Name || personLike.name || fallbackName || '').trim(),
    id: String(personLike._id || personLike.Id || personLike.id || personLike.UserId || '').trim(),
    email: String(personLike.Email || personLike.email || personLike.User_email || '').trim(),
  };
}

function deriveTimelineEndDates(timeline) {
  const sorted = (Array.isArray(timeline) ? timeline : [])
    .map((rev) => {
      const newDate = fmtDate(parseKfDate(rev?.New_Revised_Date));
      const changedAt = parseKfDate(rev?.Changed_on || rev?._modified_at || rev?._created_at);
      return {
        newDate,
        changedAt: changedAt ? changedAt.getTime() : 0,
        raw: rev,
      };
    })
    .filter((r) => r.newDate)
    .sort((a, b) => a.changedAt - b.changedAt);

  // First history row = planned/baseline end date.
  // One row only = no real revision. Two+ = previous + latest revised.
  const plannedEndDate = sorted[0]?.newDate ?? null;

  if (sorted.length === 0) {
    return {
      plannedEndDate: null,
      previousEndDate: null,
      revisedEndDate: null,
      hasRevision: false,
      revisedCount: 0,
      sortedTimeline: [],
    };
  }

  if (sorted.length === 1) {
    return {
      plannedEndDate,
      previousEndDate: plannedEndDate,
      revisedEndDate: null,
      hasRevision: false,
      revisedCount: 0,
      sortedTimeline: sorted,
    };
  }

  return {
    plannedEndDate,
    previousEndDate: sorted[sorted.length - 2].newDate,
    revisedEndDate: sorted[sorted.length - 1].newDate,
    hasRevision: true,
    revisedCount: sorted.length - 1,
    sortedTimeline: sorted,
  };
}

function mapItemsToProjectRows(items, detailById, activityById, availableFieldIds) {
  const now = new Date();
  const hasField = (id) => !availableFieldIds || availableFieldIds.has(id);
  return items.map((item, index) => {
    const id = item?._item_id || item?._id || `PRJ-${index + 1}`;
    const detail = detailById[id] || {};
    const ownerName = detail?.Project_Owner?.Name || item?.AssignedTo?.Name || item?.Requester?.Name || item?._created_by?.Name || 'Unassigned';
    const ownerRef = extractPersonRef(
      detail?.Project_Owner || item?.AssignedTo || item?.Requester || item?._created_by,
      ownerName,
    );
    const businessOwnerName = personDisplayName(detail?.Business_Owner);
    const businessOwnerRef = extractPersonRef(detail?.Business_Owner, businessOwnerName);
    const status = String(detail?.Status_1 ?? item?.Status_1 ?? '').trim() || 'Open';
    const dueDate = parseKfDate(detail?.End_Date || detail?.DueDate || item?.DueDate);
    const startDate = parseKfDate(detail?.Start_Date || detail?._start_date || item?._start_date || item?._created_at);
    const timeline = Array.isArray(detail?.['Table::Project_Timeline_History']) ? detail['Table::Project_Timeline_History'] : [];
    const { previousEndDate, revisedEndDate, sortedTimeline, revisedCount, hasRevision, plannedEndDate } = deriveTimelineEndDates(timeline);
    const effectiveEndDate = resolveEffectiveProjectEndDate(revisedEndDate, dueDate);
    const delayDays = computeProjectDelayDays(status, effectiveEndDate, now);
    const activities = Array.isArray(activityById[id]) ? activityById[id] : [];
    const subtasks = Array.isArray(detail?.['Table::Project_Subtasks']) ? detail['Table::Project_Subtasks'] : [];
    const completedTasks = subtasks.filter((s) => mapSubtaskStatus(s?.Task_Status_1, s?.End_date_2) === 'Completed').length;
    const totalTasks = subtasks.length;
    // Interim progress from embedded rows; ProjectHealthTable recalculates from Task Tracker tasks.
    const progress = isClosedProjectStatus(status)
      ? 100
      : totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

    const rag = computeProjectRag({
      status,
      delayDays,
      progress,
      startDate,
      endDate: effectiveEndDate,
      now,
    });
    const displayId = pickDisplayRef(detail, item, subtasks, id);
    return {
      id,
      displayId,
      name: hasField('Project_Name') ? (detail?.Project_Name || item?.Name || `Project ${id}`) : (item?.Name || `Project ${id}`),
      owner: ownerName,
      ownerId: ownerRef.id,
      ownerEmail: ownerRef.email,
      ownerAvatar: toInitials(ownerName),
      businessOwner: businessOwnerName,
      businessOwnerId: businessOwnerRef.id,
      businessOwnerEmail: businessOwnerRef.email,
      lineOfBusiness: hasField('Project_Category')
        ? (normalizeDimensionField(detail?.Project_Category, '') || 'Project Management')
        : 'Project Management',
      functionType: normalizeDimensionField(detail?.Function_Type, ''),
      department: hasField('Department')
        ? normalizeDimensionField(detail?.Department || detail?.Project_Department || detail?.Department_1)
        : normalizeDimensionField(detail?.Department || detail?.Project_Department || detail?.Department_1),
      priority: detail?._priority_name || item?._priority_name || detail?.Priority_1 || 'Low',
      startDate: fmtDate(startDate),
      originalEndDate: fmtDate(dueDate),
      plannedEndDate: plannedEndDate || fmtDate(dueDate),
      previousEndDate,
      revisedEndDate,
      hasRevision,
      revisedCount,
      progress,
      rag,
      status,
      delayDays,
      totalTasks,
      completedTasks,
      risk: hasField('Risk') ? (detail?.Risk || 'N/A') : 'N/A',
      riskMitigation: parseApiBoolean(detail?.Risk_Mitigation_1),
      riskMitigationDetails: String(detail?.Risk_Mitigation_Details || '').trim(),
      governanceFrequency: hasField('Governance_Frequency') ? (detail?.Governance_Frequency || 'N/A') : 'N/A',
      entity: hasField('Entity') ? normalizeDimensionField(detail?.Entity) : normalizeDimensionField(detail?.Entity),
      companyName: normalizeDimensionField(detail?.Company_Name, ''),
      aiUsage: parseApiBoolean(detail?.AI_Usage),
      aiDetails: String(detail?.Ai_Details || '').trim(),
      functionCategory: normalizeDimensionField(detail?.Function_Category, ''),
      functionSubCategory: normalizeDimensionField(detail?.Function_Sub_Category, ''),
      applicationName: String(detail?.Application_Name || '').trim(),
      projectType: String(detail?.Project_Type || '').trim(),
      projectRequest: String(detail?.Project_Request || '').trim(),
      vendorName: String(detail?.Vendor_Name || '').trim(),
      techStack: String(detail?.Tech_Stack?.Solution_Name || detail?.Tech_Stack?.Name || '').trim(),
      hours: Number.isFinite(Number(detail?.Hours)) ? Number(detail.Hours) : null,
      tcoEfforts: Number.isFinite(Number(detail?.TCOEfforts)) ? Number(detail.TCOEfforts) : null,
      agingDays: Number.isFinite(Number(detail?.Aging_Days_1)) ? Number(detail.Aging_Days_1) : null,
      tatDays: Number.isFinite(Number(detail?.TAT_1)) ? Number(detail.TAT_1) : null,
      requester: personDisplayName(detail?.Requester),
      sponsor: personDisplayName(detail?.Sponsor),
      sponsorId: extractPersonRef(detail?.Sponsor, '').id,
      sponsorEmail: extractPersonRef(detail?.Sponsor, '').email,
      projectOwner: personDisplayName(detail?.Project_Owner),
      projectOwnerId: extractPersonRef(detail?.Project_Owner, '').id,
      projectOwnerEmail: extractPersonRef(detail?.Project_Owner, '').email,
      cosOwner: personDisplayName(detail?.COS_Owner),
      cosOwnerId: extractPersonRef(detail?.COS_Owner, '').id,
      cosOwnerEmail: extractPersonRef(detail?.COS_Owner, '').email,
      developer: personDisplayName(detail?.Developer),
      developerId: extractPersonRef(detail?.Developer, '').id,
      developerEmail: extractPersonRef(detail?.Developer, '').email,
      projectManager: personDisplayName(detail?.Project_Manager),
      reportsAvailable: parseApiBoolean(detail?.Reports_Available),
      integratedTally: parseApiBoolean(detail?.Integrated_with_Tally),
      integratedSap: parseApiBoolean(detail?.Integrated_with_SAP),
      integratedPowerBi: parseApiBoolean(detail?.Integrated_with_Power_BI),
      brdAvailable: isTruthyFlag(detail?.BRD_Available_1, Array.isArray(detail?.BRD_Available) && detail.BRD_Available.length > 0),
      processDocAvailable: isTruthyFlag(detail?.Process_Document_1, Array.isArray(detail?.Process_Document) && detail.Process_Document.length > 0),
      supportAvailable: isTruthyFlag(detail?.Suuport_Available, Array.isArray(detail?.Support_Available) && detail.Support_Available.length > 0),
      cbAnalysisAvailable: parseApiBoolean(detail?.CB_Analysis_Document_Available),
      createdAt: fmtDate(parseKfDate(detail?._created_at || item?._created_at)),
      modifiedAt: fmtDate(parseKfDate(detail?._modified_at || item?._modified_at)),
      createdBy: personDisplayName(detail?._created_by || item?._created_by),
      createdById: extractPersonRef(detail?._created_by || item?._created_by, '').id,
      createdByEmail: extractPersonRef(detail?._created_by || item?._created_by, '').email,
      priorityLabel: String(detail?.Priority_1 || detail?._priority_name || item?._priority_name || 'Low').trim(),
      subtasks: subtasks.map((row, subIdx) => {
        const end = fmtDate(parseKfDate(row?.End_date_2));
        const st = mapSubtaskStatus(row?.Task_Status_1, row?.End_date_2);
        const due = parseKfDate(row?.End_date_2);
        const delay = st !== 'Completed' && due && due < now
          ? Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const assigneeName = row?.Assigned_To_1?.Name || 'Unassigned';
        const assigneeRef = extractPersonRef(row?.Assigned_To_1, assigneeName);
        return {
          id: row?.Subtask_ID || row?._id || `${id}-SUB-${subIdx + 1}`,
          projectId: id,
          projectName: detail?.Project_Name || item?.Name || `Project ${id}`,
          taskName: row?.Subtask_Name || 'Untitled Task',
          assignedTo: assigneeName,
          assignedToId: assigneeRef.id,
          assignedToEmail: assigneeRef.email,
          assigneeAvatar: toInitials(assigneeName),
          status: st,
          startDate: fmtDate(parseKfDate(row?.Start_Date_2)),
          endDate: end,
          agingDays: Number(row?.Aging_Days || 0),
          delayDays: delay,
        };
      }),
      revisionHistory: sortedTimeline.map((entry, revIdx) => {
        const rev = entry.raw;
        return {
        date: fmtDate(parseKfDate(rev?.Changed_on || rev?._created_at)),
          previousEndDate: revIdx > 0 ? sortedTimeline[revIdx - 1].newDate : '—',
          newEndDate: entry.newDate,
        reason: 'Timeline updated',
        revisedBy: rev?._created_by?.Name || 'System',
        key: rev?._id || `${id}-REV-${revIdx + 1}`,
        };
      }),
      activityHistory: activities.map((event, actIdx) => {
        const change = event?._change_summary || {};
        const changeKeys = Object.keys(change);
        const firstKey = changeKeys[0];
        const firstChange = firstKey ? change[firstKey] : null;
        return {
          key: event?._id || `${id}-ACT-${actIdx + 1}`,
          date: fmtDate(parseKfDate(event?._created_at)),
          eventType: event?._event_type || 'Updated',
          field: event?._event_field || firstKey || 'Project',
          by: event?._created_by?.Name || 'System',
          oldValue: firstChange?.old_value?.Name || firstChange?.old_value || null,
          newValue: firstChange?.current_value?.Name || firstChange?.current_value || null,
          status: event?._status_name || null,
        };
      }),
    };
  });
}

/** Loads all project rows + flattened subtasks from the same Kissflow endpoints as the CTO dashboard. */
async function fetchProjectDashboardData(kfInstance) {
  const accountId = getAccountId(kfInstance);
  return getCachedOrLoad(cacheKey('projects-list', accountId), async () => {
    const fieldsPath = getFieldsPath(accountId);
    const fieldsResponse = await kfGetJson(kfInstance, fieldsPath);
    const fieldIds = new Set((Array.isArray(fieldsResponse) ? fieldsResponse : []).map((f) => f?.Id).filter(Boolean));
    const listItems = await fetchAllProjectListItems(kfInstance, accountId);
    const rows = mapItemsToProjectRows(listItems, {}, {}, fieldIds);
    const subtasks = rows.flatMap((r) => r.subtasks || []);
    return { rows, subtasks };
  });
}

function normalizeDimensionField(value, fallback = 'N/A') {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') {
    const name = String(value.Name || value.name || value.label || '').trim();
    return name || fallback;
  }
  const text = String(value).trim();
  return text || fallback;
}

function normalizeDimensionValue(value) {
  const text = normalizeDimensionField(value, '');
  if (!text || text === 'N/A' || text === '—') return '';
  return text;
}

function collectUniqueFieldValues(rows, field) {
  const values = new Set();
  for (const row of rows) {
    const normalized = normalizeDimensionValue(row?.[field]);
    if (normalized) values.add(normalized);
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

/** India business FY: 1 Apr → 31 Mar. Key e.g. "2025-26". */
function getIndiaFyKey(dateLike) {
  const d = parseKfDate(dateLike);
  if (!d) return null;
  const year = d.getFullYear();
  const month = d.getMonth(); // 0–11; Apr = 3
  const startYear = month >= 3 ? year : year - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endShort}`;
}

function parseIndiaFyKey(fyKey) {
  const m = String(fyKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const startYear = Number(m[1]);
  if (!Number.isFinite(startYear)) return null;
  return startYear;
}

function getCalendarYear(dateLike) {
  const d = parseKfDate(dateLike);
  return d ? d.getFullYear() : null;
}

function buildCreatedYearOptions(rows) {
  const fyKeys = new Set();
  const cyKeys = new Set();
  const now = new Date();
  fyKeys.add(getIndiaFyKey(now));
  cyKeys.add(String(now.getFullYear()));

  for (const row of rows) {
    const created = row?.createdAt || row?._created_at;
    const fy = getIndiaFyKey(created);
    const cy = getCalendarYear(created);
    if (fy) fyKeys.add(fy);
    if (cy) cyKeys.add(String(cy));
  }

  const fyOptions = Array.from(fyKeys)
    .filter(Boolean)
    .sort((a, b) => (parseIndiaFyKey(b) || 0) - (parseIndiaFyKey(a) || 0))
    .map((key) => ({ value: `fy:${key}`, label: `FY ${key}` }));

  const cyOptions = Array.from(cyKeys)
    .filter(Boolean)
    .sort((a, b) => Number(b) - Number(a))
    .map((year) => ({ value: `cy:${year}`, label: `Calendar ${year}` }));

  return [...fyOptions, ...cyOptions];
}

function getCreatedPeriodOptions(createdYear) {
  if (!createdYear) return [];
  const isFy = String(createdYear).startsWith('fy:');

  const halves = isFy
    ? [
        { value: 'H1', label: 'H1 (Apr–Sep)' },
        { value: 'H2', label: 'H2 (Oct–Mar)' },
      ]
    : [
        { value: 'H1', label: 'H1 (Jan–Jun)' },
        { value: 'H2', label: 'H2 (Jul–Dec)' },
      ];

  const quarters = isFy
    ? [
        { value: 'Q1', label: 'Q1 (Apr–Jun)' },
        { value: 'Q2', label: 'Q2 (Jul–Sep)' },
        { value: 'Q3', label: 'Q3 (Oct–Dec)' },
        { value: 'Q4', label: 'Q4 (Jan–Mar)' },
      ]
    : [
        { value: 'Q1', label: 'Q1 (Jan–Mar)' },
        { value: 'Q2', label: 'Q2 (Apr–Jun)' },
        { value: 'Q3', label: 'Q3 (Jul–Sep)' },
        { value: 'Q4', label: 'Q4 (Oct–Dec)' },
      ];

  const months = isFy
    ? [
        { value: 'M04', label: 'April' },
        { value: 'M05', label: 'May' },
        { value: 'M06', label: 'June' },
        { value: 'M07', label: 'July' },
        { value: 'M08', label: 'August' },
        { value: 'M09', label: 'September' },
        { value: 'M10', label: 'October' },
        { value: 'M11', label: 'November' },
        { value: 'M12', label: 'December' },
        { value: 'M01', label: 'January' },
        { value: 'M02', label: 'February' },
        { value: 'M03', label: 'March' },
      ]
    : [
        { value: 'M01', label: 'January' },
        { value: 'M02', label: 'February' },
        { value: 'M03', label: 'March' },
        { value: 'M04', label: 'April' },
        { value: 'M05', label: 'May' },
        { value: 'M06', label: 'June' },
        { value: 'M07', label: 'July' },
        { value: 'M08', label: 'August' },
        { value: 'M09', label: 'September' },
        { value: 'M10', label: 'October' },
        { value: 'M11', label: 'November' },
        { value: 'M12', label: 'December' },
      ];

  return [
    { value: '', label: 'Full year' },
    ...halves,
    ...quarters,
    ...months,
  ];
}

function resolveCreatedDateRange(createdYear, createdPeriod) {
  if (!createdYear) return null;
  const raw = String(createdYear);
  const period = String(createdPeriod || '').trim();

  if (raw.startsWith('fy:')) {
    const startYear = parseIndiaFyKey(raw.slice(3));
    if (startYear == null) return null;
    const endYear = startYear + 1;

    if (!period || period === 'FULL') {
      return { from: new Date(startYear, 3, 1), to: new Date(endYear, 2, 31, 23, 59, 59, 999) };
    }
    if (period === 'H1') return { from: new Date(startYear, 3, 1), to: new Date(startYear, 8, 30, 23, 59, 59, 999) };
    if (period === 'H2') return { from: new Date(startYear, 9, 1), to: new Date(endYear, 2, 31, 23, 59, 59, 999) };
    if (period === 'Q1') return { from: new Date(startYear, 3, 1), to: new Date(startYear, 5, 30, 23, 59, 59, 999) };
    if (period === 'Q2') return { from: new Date(startYear, 6, 1), to: new Date(startYear, 8, 30, 23, 59, 59, 999) };
    if (period === 'Q3') return { from: new Date(startYear, 9, 1), to: new Date(startYear, 11, 31, 23, 59, 59, 999) };
    if (period === 'Q4') return { from: new Date(endYear, 0, 1), to: new Date(endYear, 2, 31, 23, 59, 59, 999) };

    const monthMatch = period.match(/^M(\d{2})$/);
    if (monthMatch) {
      const monthNum = Number(monthMatch[1]); // 1–12
      const year = monthNum >= 4 ? startYear : endYear;
      const monthIndex = monthNum - 1;
      const from = new Date(year, monthIndex, 1);
      const to = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
      return { from, to };
    }
    return { from: new Date(startYear, 3, 1), to: new Date(endYear, 2, 31, 23, 59, 59, 999) };
  }

  if (raw.startsWith('cy:')) {
    const year = Number(raw.slice(3));
    if (!Number.isFinite(year)) return null;

    if (!period || period === 'FULL') {
      return { from: new Date(year, 0, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) };
    }
    if (period === 'H1') return { from: new Date(year, 0, 1), to: new Date(year, 5, 30, 23, 59, 59, 999) };
    if (period === 'H2') return { from: new Date(year, 6, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) };
    if (period === 'Q1') return { from: new Date(year, 0, 1), to: new Date(year, 2, 31, 23, 59, 59, 999) };
    if (period === 'Q2') return { from: new Date(year, 3, 1), to: new Date(year, 5, 30, 23, 59, 59, 999) };
    if (period === 'Q3') return { from: new Date(year, 6, 1), to: new Date(year, 8, 30, 23, 59, 59, 999) };
    if (period === 'Q4') return { from: new Date(year, 9, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) };

    const monthMatch = period.match(/^M(\d{2})$/);
    if (monthMatch) {
      const monthIndex = Number(monthMatch[1]) - 1;
      const from = new Date(year, monthIndex, 1);
      const to = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
      return { from, to };
    }
    return { from: new Date(year, 0, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) };
  }

  return null;
}

function projectMatchesCreatedRange(row, range) {
  if (!range) return true;
  const created = parseKfDate(row?.createdAt || row?._created_at);
  if (!created) return false;
  const t = created.getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}

function parseYmdRange(fromStr, toStr) {
  const fromRaw = String(fromStr || '').trim();
  const toRaw = String(toStr || '').trim();
  if (!fromRaw || !toRaw) return null;
  const from = new Date(`${fromRaw}T00:00:00`);
  const to = new Date(`${toRaw}T23:59:59.999`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return { from, to };
}

/** Prefer adaptive Period picker windows (OR multi-select); fall back to legacy year/period. */
function resolveDimensionCreatedRanges(filters) {
  const multi = Array.isArray(filters?.periodRanges) ? filters.periodRanges : [];
  if (multi.length) {
    return multi.map((r) => parseYmdRange(r?.from, r?.to)).filter(Boolean);
  }
  const single = parseYmdRange(filters?.periodFrom, filters?.periodTo);
  if (single) return [single];
  const legacy = resolveCreatedDateRange(filters?.createdYear, filters?.createdPeriod);
  return legacy ? [legacy] : [];
}

function projectMatchesAnyCreatedRange(row, ranges) {
  if (!Array.isArray(ranges) || ranges.length === 0) return true;
  return ranges.some((range) => projectMatchesCreatedRange(row, range));
}

function taskMatchesCreatedRange(row, range) {
  if (!range) return true;
  const created = parseKfDate(
    row?.createdAt ||
      row?.createdDate ||
      row?._created_at ||
      row?.raw?._created_at ||
      row?.raw?.Created_at,
  );
  if (!created) return false;
  const t = created.getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}

function taskMatchesAnyCreatedRange(row, ranges) {
  if (!Array.isArray(ranges) || ranges.length === 0) return true;
  return ranges.some((range) => taskMatchesCreatedRange(row, range));
}

function hasPortfolioDimensionFilters(filters) {
  return Boolean(
    filters?.company ||
      filters?.department ||
      filters?.lineOfBusiness ||
      filters?.functionType,
  );
}

function hasActiveDimensionFilters(filters) {
  return Boolean(
    hasPortfolioDimensionFilters(filters) ||
      filters?.periodFrom ||
      (Array.isArray(filters?.periodRanges) && filters.periodRanges.length > 0) ||
      filters?.createdYear,
  );
}

const IT_BUSINESS_FUNCTION = 'Information Technology';

function isInformationTechnologyCategory(value) {
  return normalizeDimensionValue(value) === normalizeDimensionValue(IT_BUSINESS_FUNCTION);
}

function filterProjectsByDimensions(rows, filters) {
  if (!hasActiveDimensionFilters(filters)) return rows;
  const createdRanges = resolveDimensionCreatedRanges(filters);
  return rows.filter((row) => {
    if (filters.company && normalizeDimensionValue(row.companyName) !== filters.company) return false;
    if (filters.department && normalizeDimensionValue(row.department) !== filters.department) return false;
    if (filters.lineOfBusiness && normalizeDimensionValue(row.lineOfBusiness) !== filters.lineOfBusiness) return false;
    if (filters.functionType && normalizeDimensionValue(row.functionType) !== filters.functionType) return false;
    if (!projectMatchesAnyCreatedRange(row, createdRanges)) return false;
    return true;
  });
}

function filterTasksByProjects(tasks, projects, filters) {
  if (!hasActiveDimensionFilters(filters)) return tasks;

  const createdRanges = resolveDimensionCreatedRanges(filters);
  const needsProjectLink = hasPortfolioDimensionFilters(filters);
  let next = Array.isArray(tasks) ? tasks : [];

  if (needsProjectLink) {
    if (!projects.length) return [];
    const projectIds = new Set(projects.map((p) => p.id));
    const projectNames = new Set(projects.map((p) => p.name).filter(Boolean));
    const projectRefs = new Set(projects.map((p) => String(p.displayId || '').trim()).filter(Boolean));

    next = next.filter((task) => {
      if (task.projectId && projectIds.has(task.projectId)) return true;
      if (task.projectName && projectNames.has(task.projectName)) return true;
      const ref = String(task.projectRef || task.raw?.Project_ID_Details || '').trim();
      if (ref && projectRefs.has(ref)) return true;
      return false;
    });
  }

  if (createdRanges.length) {
    next = next.filter((task) => taskMatchesAnyCreatedRange(task, createdRanges));
  }

  return next;
}

function filterProcessSubtasksByTasks(processSubtasks, tasks, filters) {
  if (!hasActiveDimensionFilters(filters)) return processSubtasks;
  if (!tasks.length) return [];

  const taskKeys = new Set();
  for (const task of tasks) {
    const businessId = resolveTaskBusinessIdFromRow(task);
    if (businessId) taskKeys.add(businessId);
    if (task.id) taskKeys.add(String(task.id));
    if (task.taskId) taskKeys.add(String(task.taskId));
  }

  return processSubtasks.filter((sub) => {
    const parentId = String(sub.parentTaskBusinessId || '').trim();
    const subId = String(sub.id || '').trim();
    return (parentId && taskKeys.has(parentId)) || (subId && taskKeys.has(subId));
  });
}

function countActiveDimensionFilters(filters) {
  let n = 0;
  if (filters?.company) n += 1;
  if (filters?.department) n += 1;
  if (filters?.lineOfBusiness) n += 1;
  if (filters?.functionType) n += 1;
  if (filters?.periodFrom || (Array.isArray(filters?.periodRanges) && filters.periodRanges.length > 0)) n += 1;
  if (filters?.createdYear) n += 1;
  return n;
}

function DashboardDimensionFilters({
  filters,
  options,
  onChange,
  onClear,
  hasActiveFilters,
  prefix = null,
  suffix = null,
  portfolioUserFilter = '',
  onPortfolioUserChange = null,
  portfolioUserOptions = null,
  /** Hides Company / Business Functions / Function Type (UserHub tasks). */
  hideCompanyFunctionFilters = false,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const showFunctionType = isInformationTechnologyCategory(filters.lineOfBusiness);
  const draftShowFunctionType = isInformationTechnologyCategory(draft?.lineOfBusiness);
  const periodState = {
    mode: filters.periodMode || 'all',
    range: { from: filters.periodFrom || '', to: filters.periodTo || '' },
    ranges: Array.isArray(filters.periodRanges) ? filters.periodRanges : [],
    parts: Array.isArray(filters.periodParts) ? filters.periodParts : [],
    fyStartYear: filters.periodFyStartYear ?? null,
    summaryLabel: filters.periodLabel || 'All time',
  };
  const baseFields = hideCompanyFunctionFilters
    ? []
    : [
        { key: 'company', label: 'Company', icon: 'ri-building-2-line', allLabel: 'All companies' },
        { key: 'lineOfBusiness', label: 'Business Functions', icon: 'ri-briefcase-line', allLabel: 'All Functions' },
      ];
  const functionTypeField = {
    key: 'functionType',
    label: 'Function Type',
    icon: 'ri-stack-line',
    allLabel: 'All Function Types',
  };
  const fields = [
    ...baseFields,
    ...(showFunctionType ? [functionTypeField] : []),
  ];
  const draftFields = [
    ...baseFields,
    ...(draftShowFunctionType ? [functionTypeField] : []),
  ];

  const activeCount =
    countActiveDimensionFilters(filters) + (portfolioUserFilter ? 1 : 0);

  useEffect(() => {
    if (sheetOpen) {
      setDraft({ ...filters, __portfolioUser: portfolioUserFilter || '' });
    }
  }, [sheetOpen, filters, portfolioUserFilter]);

  const openSheet = () => {
    setDraft({ ...filters, __portfolioUser: portfolioUserFilter || '' });
    setSheetOpen(true);
  };

  const applyDraft = () => {
    for (const { key } of draftFields) {
      if ((draft?.[key] || '') !== (filters?.[key] || '')) onChange(key, draft?.[key] || '');
    }
    if (!draftShowFunctionType && filters.functionType) onChange('functionType', '');
    onChange('period', {
      mode: draft?.periodMode || 'all',
      range: { from: draft?.periodFrom || '', to: draft?.periodTo || '' },
      ranges: Array.isArray(draft?.periodRanges) ? draft.periodRanges : [],
      parts: Array.isArray(draft?.periodParts) ? draft.periodParts : [],
      fyStartYear: draft?.periodFyStartYear ?? null,
      summaryLabel: draft?.periodLabel || 'All time',
    });

    if (typeof onPortfolioUserChange === 'function') {
      const draftUser = draft?.__portfolioUser ?? portfolioUserFilter;
      if (draftUser !== portfolioUserFilter) onPortfolioUserChange(draftUser || '');
    }
    setSheetOpen(false);
  };

  const clearAll = () => {
    onClear?.();
    if (typeof onPortfolioUserChange === 'function' && portfolioUserFilter) {
      onPortfolioUserChange('');
    }
    setSheetOpen(false);
  };

  const draftPeriodState = {
    mode: draft?.periodMode || 'all',
    range: { from: draft?.periodFrom || '', to: draft?.periodTo || '' },
    ranges: Array.isArray(draft?.periodRanges) ? draft.periodRanges : [],
    parts: Array.isArray(draft?.periodParts) ? draft.periodParts : [],
    fyStartYear: draft?.periodFyStartYear ?? null,
    summaryLabel: draft?.periodLabel || 'All time',
  };

  const chips = [];
  if (!hideCompanyFunctionFilters) {
    if (filters.company) {
      chips.push({ key: 'company', label: filters.company, onRemove: () => onChange('company', '') });
    }
    if (filters.lineOfBusiness) {
      chips.push({
        key: 'lob',
        label: filters.lineOfBusiness,
        onRemove: () => onChange('lineOfBusiness', ''),
      });
    }
    if (filters.functionType) {
      chips.push({
        key: 'ft',
        label: filters.functionType,
        onRemove: () => onChange('functionType', ''),
      });
    }
  }
  if (filters.periodMode && filters.periodMode !== 'all') {
    chips.push({
      key: 'period',
      label: filters.periodLabel || 'Period',
      onRemove: () => onChange('period', getEmptyPeriodState()),
    });
  }
  if (portfolioUserFilter) {
    chips.push({
      key: 'user',
      label: portfolioUserFilter,
      onRemove: () => onPortfolioUserChange?.(''),
    });
  }

  return (
    <div className="flex w-full flex-col gap-1.5 lg:w-auto lg:items-end">
      {/* Mobile: compact Filters button + sheet */}
      <div className="flex w-full flex-col gap-2 lg:hidden">
        {prefix ? <div className="w-full">{prefix}</div> : null}
        <div className="flex w-full gap-2">
          <MobileFiltersButton count={activeCount} onClick={openSheet} />
        </div>
        <MobileActiveFilterChips chips={chips} />
      </div>

      {/* Desktop: original horizontal / wrap rail — unchanged */}
      <div className="hidden w-full snap-x snap-mandatory items-end gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex lg:flex-wrap lg:justify-end lg:overflow-visible [&::-webkit-scrollbar]:hidden">
        {prefix}
        {fields.map(({ key, label, icon, allLabel }) => (
          <label key={key} className="flex min-w-[10.5rem] shrink-0 snap-start flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
            <PtSelect
              value={filters[key] || ''}
              onChange={(e) => onChange(key, e.target.value)}
              leadingIcon={icon}
              aria-label={`Filter by ${label}`}
              className="w-full sm:min-w-[11rem]"
              triggerClassName="text-xs sm:text-sm py-2 h-auto min-h-[2.25rem]"
              options={[
                { value: '', label: allLabel },
                ...(options[key] || []).map((opt) => ({ value: opt, label: opt })),
              ]}
            />
          </label>
        ))}

        <label className="flex min-w-[11rem] shrink-0 snap-start flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Period</span>
          <DashboardPeriodPicker
            mode={periodState.mode}
            range={periodState.range}
            ranges={periodState.ranges}
            parts={periodState.parts}
            fyStartYear={periodState.fyStartYear}
            summaryLabel={periodState.summaryLabel}
            onChange={(next) => onChange('period', next)}
            className="w-full sm:min-w-[11rem]"
            triggerClassName="rounded-xl bg-white py-2 shadow-sm text-xs sm:text-sm min-h-[2.25rem] sm:min-w-[12rem]"
          />
        </label>

        {suffix}

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClear}
            className="mb-0.5 shrink-0 self-end rounded-lg px-2.5 py-2 text-xs font-semibold text-[#1E88E5] transition hover:bg-blue-50"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {hasActiveFilters ? (
        <p className="hidden text-center text-[10px] font-medium text-slate-500 lg:block lg:text-right">
          Portfolio filters applied across all sections · dates use project created date
        </p>
      ) : null}

      <MobileFilterSheet
        open={sheetOpen}
        title="Dashboard filters"
        onClose={() => setSheetOpen(false)}
        onClear={clearAll}
        onApply={applyDraft}
      >
        {draftFields.map(({ key, label, icon, allLabel }) => (
          <MobileFilterField key={key} label={label}>
            <PtSelect
              value={draft?.[key] || ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
              leadingIcon={icon}
              aria-label={`Filter by ${label}`}
              className="w-full"
              triggerClassName="text-xs py-2 h-auto min-h-[2.5rem]"
              options={[
                { value: '', label: allLabel },
                ...(options[key] || []).map((opt) => ({ value: opt, label: opt })),
              ]}
            />
          </MobileFilterField>
        ))}
        <MobileFilterField label="Period">
          <DashboardPeriodPicker
            mode={draftPeriodState.mode}
            range={draftPeriodState.range}
            ranges={draftPeriodState.ranges}
            parts={draftPeriodState.parts}
            fyStartYear={draftPeriodState.fyStartYear}
            summaryLabel={draftPeriodState.summaryLabel}
            onChange={(next) =>
              setDraft((prev) => ({
                ...prev,
                periodMode: next.mode || 'all',
                periodFrom: next.range?.from || '',
                periodTo: next.range?.to || '',
                periodLabel: next.summaryLabel || 'All time',
                periodRanges: Array.isArray(next.ranges) ? next.ranges : [],
                periodParts: Array.isArray(next.parts) ? next.parts : [],
                periodFyStartYear: Number.isFinite(Number(next.fyStartYear))
                  ? Number(next.fyStartYear)
                  : null,
              }))
            }
            className="w-full"
            triggerClassName="rounded-xl bg-white py-2 shadow-sm text-xs min-h-[2.5rem]"
          />
        </MobileFilterField>
        {Array.isArray(portfolioUserOptions) && typeof onPortfolioUserChange === 'function' ? (
          <MobileFilterField label="User">
            <PtSelect
              value={draft?.__portfolioUser ?? portfolioUserFilter}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, __portfolioUser: e.target.value }))
              }
              leadingIcon="ri-user-line"
              aria-label="Filter by user"
              className="w-full"
              triggerClassName="text-xs py-2 h-auto min-h-[2.5rem]"
              options={portfolioUserOptions}
            />
          </MobileFilterField>
        ) : null}
      </MobileFilterSheet>
    </div>
  );
}

/** Loads task tracker items from Project_Sub_Task_A01. */
async function fetchSubtaskTrackerData(kfInstance) {
  return fetchTaskTrackerData(kfInstance, { enrichDetails: false });
}

/** Normalize Kissflow user field vs display name (assignee / owner). */
function personMatches(user, displayName) {
  if (!user || !displayName) return false;
  const userId = String(user._id || user.Id || user.id || user.UserId || '').trim().toLowerCase();
  const userEmail = String(user.Email || user.email || user.User_email || '').trim().toLowerCase();
  const userName = String(user.Name || user.DisplayName || user.FullName || '').trim().toLowerCase();
  const userFirstName = String(user.FirstName || '').trim().toLowerCase();

  // Accept both plain string and rich refs { id, email, name } from mapped rows.
  const personRef = typeof displayName === 'object'
    ? displayName
    : { name: displayName };
  const targetId = String(personRef.id || personRef._id || personRef.UserId || '').trim().toLowerCase();
  const targetEmail = String(personRef.email || personRef.Email || '').trim().toLowerCase();
  const targetName = String(personRef.name || personRef.Name || '').trim().toLowerCase();

  // 1) Strong keys first.
  if (userId && targetId && userId === targetId) return true;
  if (userEmail && targetEmail && userEmail === targetEmail) return true;
  // 2) Exact/near-exact display name match.
  if (userName && targetName && (userName === targetName || userName.includes(targetName) || targetName.includes(userName))) return true;
  const userToken = (userFirstName || userName).split(/\s+/)[0] || '';
  const targetToken = targetName.split(/\s+/)[0] || '';
  if (userToken && targetToken && userToken === targetToken) return true;
  return false;
}

function taskAssigneeMatchesUser(user, task) {
  if (!user || !task) return false;
  return personMatches(user, {
    id: task.assignedToId || task?.raw?.Assigned_To?._id,
    email:
      task.assignedToEmail ||
      task?.raw?.externalemail ||
      task?.raw?.Assigned_To?.Email ||
      task?.raw?.Assigned_To?.email,
    name: task.assignedTo || task?.raw?.Assigned_To?.Name,
  });
}

function projectBelongsToUser(user, project, assignedTaskProjectIds, assignedTaskProjectRefs) {
  if (!user || !project) return false;
  if (personMatches(user, { id: project.ownerId, email: project.ownerEmail, name: project.owner })) return true;
  if (personMatches(user, {
    id: project.projectOwnerId,
    email: project.projectOwnerEmail,
    name: project.projectOwner,
  })) return true;
  const pid = String(project.id || '').trim();
  const pref = String(project.displayId || '').trim();
  if (pid && assignedTaskProjectIds?.has(pid)) return true;
  if (pref && assignedTaskProjectRefs?.has(pref)) return true;
  return false;
}

/** True when user is Project Owner, Business Owner, Sponsor, COS Owner, Developer, or creator. */
function projectOwnedOrStewardedByUser(user, project) {
  if (!user || !project) return false;
  return (
    personMatches(user, { id: project.ownerId, email: project.ownerEmail, name: project.owner })
    || personMatches(user, {
      id: project.projectOwnerId,
      email: project.projectOwnerEmail,
      name: project.projectOwner,
    })
    || personMatches(user, {
      id: project.businessOwnerId,
      email: project.businessOwnerEmail,
      name: project.businessOwner,
    })
    || personMatches(user, {
      id: project.sponsorId,
      email: project.sponsorEmail,
      name: project.sponsor,
    })
    || personMatches(user, {
      id: project.cosOwnerId,
      email: project.cosOwnerEmail,
      name: project.cosOwner,
    })
    || personMatches(user, {
      id: project.developerId,
      email: project.developerEmail,
      name: project.developer,
    })
    || personMatches(user, {
      id: project.createdById,
      email: project.createdByEmail,
      name: project.createdBy,
    })
  );
}

/** Scope portfolio to the logged-in user (owner / stewards / assigned tasks). */
function scopeDashboardDataToCurrentUser(projects, tasks, processSubtasks, user, { ownerOnlyProjects = false } = {}) {
  if (!user) {
    return { projects: [], tasks: [], processSubtasks: [] };
  }
  const myTasks = (Array.isArray(tasks) ? tasks : []).filter((t) => taskAssigneeMatchesUser(user, t));
  const assignedTaskProjectIds = new Set(myTasks.map((t) => String(t.projectId || '').trim()).filter(Boolean));
  const assignedTaskProjectRefs = new Set(myTasks.map((t) => String(t.projectRef || '').trim()).filter(Boolean));
  const myProjects = (Array.isArray(projects) ? projects : []).filter((p) => {
    if (ownerOnlyProjects) {
      return projectOwnedOrStewardedByUser(user, p);
    }
    return projectBelongsToUser(user, p, assignedTaskProjectIds, assignedTaskProjectRefs);
  });

  /** User hub projects: owner-scoped projects show every task on those projects, not assignee-only. */
  if (ownerOnlyProjects) {
    const allTasksArr = Array.isArray(tasks) ? tasks : [];
    const projectTasks = collectTasksForProjects(myProjects, allTasksArr);
    const projectTaskKeys = new Set(projectTasks.map((t) => resolveTaskBusinessIdFromRow(t)).filter(Boolean));
    const projectProcessSubtasks = (Array.isArray(processSubtasks) ? processSubtasks : []).filter((sub) => {
      const parentId = String(sub?.parentTaskBusinessId || '').trim();
      return parentId && projectTaskKeys.has(parentId);
    });
    return {
      projects: myProjects,
      tasks: projectTasks,
      processSubtasks: projectProcessSubtasks,
    };
  }

  const taskKeys = new Set(myTasks.map((t) => resolveTaskBusinessIdFromRow(t)).filter(Boolean));
  const myProcessSubtasks = (Array.isArray(processSubtasks) ? processSubtasks : []).filter((sub) => {
    const parentId = String(sub?.parentTaskBusinessId || '').trim();
    return parentId && taskKeys.has(parentId);
  });

  return {
    projects: myProjects,
    tasks: myTasks,
    processSubtasks: myProcessSubtasks,
  };
}

function collectPortfolioUsers(projects, tasks) {
  const unique = new Map();
  const bump = (name, id = '', email = '') => {
    const n = String(name || '').trim();
    if (!n || n === '—' || /unassigned/i.test(n)) return;
    const key = String(id || '').trim() || n.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, { name: n, id: String(id || '').trim(), email: String(email || '').trim() });
    }
  };
  (Array.isArray(projects) ? projects : []).forEach((p) => {
    bump(p?.owner, p?.ownerId, p?.ownerEmail);
    bump(p?.projectOwner, p?.projectOwnerId, p?.projectOwnerEmail);
  });
  (Array.isArray(tasks) ? tasks : []).forEach((t) => {
    bump(t?.assignedTo, t?.assignedToId, t?.assignedToEmail);
  });
  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** Filter portfolio to one person — project owner / assignee / linked via tasks. */
function filterPortfolioByUser(projects, tasks, processSubtasks, member) {
  if (!member?.name) {
    return {
      projects: Array.isArray(projects) ? projects : [],
      tasks: Array.isArray(tasks) ? tasks : [],
      processSubtasks: Array.isArray(processSubtasks) ? processSubtasks : [],
    };
  }
  const synthUser = { _id: member.id, Email: member.email, Name: member.name };
  const myTasks = (Array.isArray(tasks) ? tasks : []).filter((t) =>
    personMatches(synthUser, {
      id: t.assignedToId,
      email: t.assignedToEmail,
      name: t.assignedTo,
    }),
  );
  const taskProjectIds = new Set(myTasks.map((t) => String(t.projectId || '').trim()).filter(Boolean));
  const taskProjectRefs = new Set(myTasks.map((t) => String(t.projectRef || '').trim()).filter(Boolean));
  const myProjects = (Array.isArray(projects) ? projects : []).filter((p) =>
    personMatches(synthUser, { id: p.ownerId, email: p.ownerEmail, name: p.owner })
    || personMatches(synthUser, {
      id: p.projectOwnerId,
      email: p.projectOwnerEmail,
      name: p.projectOwner,
    })
    || taskProjectIds.has(String(p.id || '').trim())
    || taskProjectRefs.has(String(p.displayId || '').trim()),
  );
  return {
    projects: myProjects,
    tasks: myTasks,
    processSubtasks: filterProcessSubtasksByTaskKeys(processSubtasks, myTasks),
  };
}

/** Map UserSpecificPT My Team project rows → ProjectDashboard project shape. */
function mapMyTeamProjectToDashboardRow(p) {
  if (!p) return null;
  const id = String(p.id || p.projectId || '').trim();
  const projectId = String(p.projectId || p.id || '').trim();
  const end = p.end && p.end !== '—' ? p.end : null;
  const start = p.start && p.start !== '—' ? p.start : null;
  return {
    id: id || projectId,
    displayId: projectId || id,
    name: p.name || '—',
    owner: p.owner || '—',
    ownerId: p.ownerId || '',
    ownerEmail: p.ownerEmail || '',
    ownerAvatar: p.ownerAvatar || toInitials(p.owner),
    progress: Number(p.progress || 0),
    totalTasks: Number(p.tasks || 0),
    completedTasks: Number(p.completed || 0),
    delayDays: Number(p.delayDays || 0),
    startDate: start,
    originalEndDate: end,
    plannedEndDate: end,
    revisedEndDate: null,
    revisedCount: 0,
    hasRevision: false,
    revisionHistory: [],
    status: p.status || '—',
    rag: p.rag || 'Green',
    priority: p.priority || '—',
    lineOfBusiness: p.category || '',
    functionType: '',
    companyName: '',
    department: '',
    createdAt: p.createdAt || null,
    l1ManagerEmail: p.l1ManagerEmail || '',
    l2ManagerEmail: p.l2ManagerEmail || '',
    raw: p.raw || p,
  };
}

/** Map UserSpecificPT My Team task rows → ProjectDashboard task shape. */
function mapMyTeamTaskToDashboardRow(t) {
  if (!t) return null;
  return {
    id: String(t.id || t.InstanceID || '').trim(),
    taskId: String(t.id || '').trim(),
    taskName: t.name || '—',
    projectName: t.project || '—',
    projectId: String(t.projectId || '').trim(),
    projectRef: String(t.projectId || '').trim(),
    assignedTo: t.assignee || '—',
    assignedToId: t.assigneeId || '',
    assignedToEmail: t.assigneeEmail || '',
    assigneeAvatar: t.initials || toInitials(t.assignee),
    startDate: t.start || '—',
    endDate: t.end || '—',
    agingDays: Number(t.agingDays || 0),
    delayDays: Number(t.delayDays || 0),
    status: t.status || '—',
    priority: t.priority || 'Medium',
    InstanceID: t.InstanceID || '',
    ActivityID: t.ActivityID || '',
    l1ManagerEmail: t.l1ManagerEmail || '',
    l2ManagerEmail: t.l2ManagerEmail || '',
    createdAt: t.createdAt || null,
    raw: t.raw || t,
  };
}

function filterProcessSubtasksByTaskKeys(processSubtasks, tasks) {
  const taskKeys = new Set(
    (Array.isArray(tasks) ? tasks : []).map((t) => resolveTaskBusinessIdFromRow(t)).filter(Boolean),
  );
  return (Array.isArray(processSubtasks) ? processSubtasks : []).filter((sub) => {
    const parentId = String(sub?.parentTaskBusinessId || '').trim();
    return parentId && taskKeys.has(parentId);
  });
}


/** --- Default KPI fallback (from cto-dashboard mock) --- */
const DEFAULT_CTO_KPI_METRICS = {
  totalProjects: 8,
  activeProjects: 6,
  completedProjects: 0,
  delayedProjects: 3,
  totalSubtasks: 15,
  openTasks: 9,
  completedTasks: 5,
  overdueTasks: 2,
  trendTotalProjects: '+12.5%',
  trendTotalProjectsPositive: true,
  trendActiveProjects: '75% of total',
  trendCompletedProjects: '0% completion rate',
  trendDelayedProjects: '37.5% at risk',
};


/** --- KPI section --- */



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

function PremiumKPICard({ title, value, subtitle, trend, icon, theme, index, onClick, active = false }) {
  const isDesktop = useIsDesktopLg();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={isDesktop ? { opacity: 0, y: 18 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        isDesktop
          ? {
              type: 'spring',
              stiffness: 380,
              damping: 28,
              delay: Math.min(index * 0.035, 0.25),
            }
          : { duration: 0.2, delay: Math.min(index * 0.03, 0.12) }
      }
      whileHover={
        isDesktop
          ? {
              y: -6,
              scale: 1.02,
              transition: { type: 'spring', stiffness: 420, damping: 22 },
            }
          : undefined
      }
      whileTap={isDesktop ? { scale: 0.985 } : { scale: 0.99 }}
      className={`
        group relative flex h-full min-h-[112px] w-full flex-col overflow-hidden rounded-xl border bg-gradient-to-br p-3 text-left sm:rounded-2xl sm:p-5 lg:min-h-[168px] lg:p-5
        ${theme.cardBg}
        ${theme.cardShadow}
        transition-[box-shadow,border-color,ring] duration-300 ease-out
        hover:shadow-[0_20px_48px_-16px_rgba(15,23,42,0.22)] hover:shadow-slate-400/20
        hover:ring-2 ring-transparent
        ${theme.hoverRing}
        ${theme.hoverBorder}
        ${active ? 'border-[#1E88E5] ring-2 ring-[#1E88E5]/35' : 'border-slate-200/88 cursor-pointer'}
      `}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 hidden h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 lg:block"
        style={{ background: theme.glow }}
      />
      <div className="pointer-events-none absolute inset-0 hidden rounded-2xl bg-gradient-to-br from-white/0 via-transparent to-slate-100/35 opacity-0 transition-opacity duration-500 group-hover:opacity-100 lg:block" />

      <div className="relative flex flex-1 items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400 sm:text-[11px] sm:tracking-[0.14em]">
            {title}
          </p>
          <p
            className={`mt-1 text-[26px] font-bold tabular-nums leading-none tracking-tight sm:mt-2 sm:text-4xl ${theme.valueClass}`}
          >
            {value}
          </p>
          {subtitle ? (
            <p className="mt-1 line-clamp-2 text-[10px] font-medium text-slate-400 sm:mt-2 sm:text-xs">{subtitle}</p>
          ) : null}
          {trend ? (
            <p
              className={`mt-1.5 flex items-center gap-1 text-[10px] font-semibold sm:mt-2.5 sm:text-xs ${trend.positive ? 'text-[#22C55E]' : 'text-[#EF4444]'
                }`}
            >
              <i className={`${trend.positive ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-xs sm:text-sm`} />
              {trend.value}
            </p>
          ) : null}
          <p className="mt-2 hidden text-[10px] font-semibold text-[#1E88E5] opacity-0 transition-opacity group-hover:opacity-100 lg:block">
            Click to view →
          </p>
        </div>

        <div
          className={`
            relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/90 sm:h-12 sm:w-12 sm:rounded-xl
            ${theme.iconBg}
            ${theme.iconShadow}
            ${theme.iconRing}
            transition-all duration-300 ease-out
            lg:group-hover:scale-105 lg:group-hover:-rotate-[8deg] lg:group-hover:shadow-[0_10px_22px_-12px_rgba(15,23,42,0.25)]
          `}
        >
          <i className={`${icon} text-base transition-transform duration-300 lg:group-hover:scale-110 sm:text-xl`} />
        </div>
      </div>
    </motion.button>
  );
}

/** Shared grid + min height so Insight and Health Monitor cards align in size only */
const DASHBOARD_CARD_GRID =
  'grid grid-cols-2 items-stretch gap-2.5 sm:gap-4 md:gap-5 xl:grid-cols-4';
const DASHBOARD_CARD_MIN_H = 'min-h-[112px] lg:min-h-[168px]';

function AnimatedBar({ widthPct, color, trackClass, delay, subtle = false }) {
  const x = Math.min(100, Math.max(0, widthPct)) / 100;
  return (
    <div className={`${subtle ? 'h-1' : 'h-1.5'} w-full overflow-hidden rounded-full ${trackClass}`}>
      <motion.div
        className="h-full w-full origin-left rounded-full"
        style={{ backgroundColor: color }}
        initial={{ scaleX: subtle ? x : 0 }}
        animate={{ scaleX: x }}
        transition={
          subtle
            ? { duration: 0.25, delay: Math.min(delay, 0.08) }
            : {
                type: 'spring',
                stiffness: 120,
                damping: 18,
                delay,
              }
        }
      />
    </div>
  );
}

/** Original Health Monitor look; outer size matched to Insight cards */
function HealthMonitorCard({
  title,
  value,
  footnote,
  barPct,
  barColor,
  barTrack,
  icon,
  iconClass,
  valueColor,
  iconWrap,
  cardBg,
  borderHover,
  ringHover,
  glow,
  shadow,
  index = 0,
  active = false,
  onClick,
}) {
  const isDesktop = useIsDesktopLg();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={isDesktop ? { opacity: 0, y: 18 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        isDesktop
          ? {
              type: 'spring',
              stiffness: 380,
              damping: 28,
              delay: index * 0.05,
            }
          : { duration: 0.2, delay: Math.min(index * 0.03, 0.12) }
      }
      whileHover={
        isDesktop
          ? {
              y: -6,
              scale: 1.025,
              transition: { type: 'spring', stiffness: 420, damping: 22 },
            }
          : undefined
      }
      whileTap={isDesktop ? { scale: 0.985 } : { scale: 0.99 }}
      className={`
        group relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-gradient-to-br p-3 text-left sm:rounded-2xl lg:p-5
        ${DASHBOARD_CARD_MIN_H}
        ${active ? 'border-[#1E88E5] ring-2 ring-[#1E88E5]/35' : 'border-slate-200/80'}
        ${cardBg}
        shadow-md ${shadow}
        transition-shadow duration-300 hover:shadow-xl hover:shadow-slate-300/35
        hover:ring-2 ring-transparent ${ringHover}
        ${borderHover}
      `}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 hidden h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 lg:block"
        style={{ background: glow }}
      />

      <div className="relative flex flex-1 flex-col gap-1.5 lg:gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:text-[11px] sm:tracking-[0.12em]">
            {title}
          </span>
          <motion.span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm sm:h-9 sm:w-9 sm:rounded-xl sm:text-base ${iconWrap} shadow-sm backdrop-blur-sm`}
            whileHover={isDesktop ? { scale: 1.12, rotate: [0, -6, 6, 0] } : undefined}
            transition={{ duration: 0.45 }}
          >
            {iconClass ? <i className={iconClass} /> : icon}
          </motion.span>
        </div>

        <motion.p
          className={`text-[26px] font-bold tabular-nums leading-none tracking-tight sm:text-3xl ${valueColor}`}
          initial={isDesktop ? { opacity: 0, scale: 0.92 } : { opacity: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            isDesktop
              ? { type: 'spring', stiffness: 300, damping: 22, delay: 0.08 + index * 0.05 }
              : { duration: 0.2, delay: Math.min(index * 0.03, 0.1) }
          }
        >
          {value}
        </motion.p>

        <div className="mt-auto hidden lg:block">
          <AnimatedBar
            widthPct={barPct}
            color={barColor}
            trackClass={barTrack}
            delay={0.12 + index * 0.06}
          />
        </div>
        <div className="mt-auto lg:hidden">
          <AnimatedBar
            widthPct={barPct}
            color={barColor}
            trackClass={barTrack}
            delay={0.05}
            subtle
          />
        </div>

        <p className="line-clamp-2 text-[10px] font-medium text-slate-500 sm:text-xs">{footnote}</p>
      </div>
    </motion.button>
  );
}

/** KPI / Health Monitor → table focus map */
const KPI_FOCUS = {
  'total-projects': { section: 'health', projectStatus: 'all', label: 'All projects' },
  'active-projects': { section: 'health', projectStatus: '__active__', label: 'Active projects' },
  'completed-projects': { section: 'health', projectStatus: 'Completed', label: 'Completed projects' },
  'delayed-projects': { section: 'delay', delayType: 'delayed', label: 'Delayed projects' },
  'total-tasks': { section: 'subtasks', taskStatus: 'all', label: 'All tasks' },
  'open-tasks': { section: 'subtasks', taskStatus: '__open__', label: 'Open tasks' },
  'completed-tasks': { section: 'subtasks', taskStatus: 'Completed', label: 'Completed tasks' },
  'overdue-tasks': { section: 'subtasks', taskStatus: 'Overdue', label: 'Overdue tasks' },
  // Project Health Monitor
  'health-on-track': { section: 'health', projectRag: 'Green', label: 'On Track projects' },
  'health-at-risk': { section: 'health', projectRag: 'Amber', label: 'At Risk projects' },
  'health-delayed': { section: 'health', projectRag: 'Red', label: 'Delayed projects' },
  'health-revisions': { section: 'delay', delayType: 'revised', label: 'Revised projects' },
  // Task Health Monitor
  'task-health-completed': { section: 'subtasks', taskStatus: 'Completed', label: 'Completed tasks' },
  'task-health-open': { section: 'subtasks', taskStatus: '__open__', label: 'Open tasks' },
  'task-health-high': { section: 'subtasks', taskStatus: '__high_priority__', label: 'High priority tasks' },
  'task-health-delayed': { section: 'subtasks', taskStatus: '__delayed__', label: 'Delayed tasks' },
};

function KPISection({ metrics, onKpiClick, activeKey = null, group = 'all' }) {
  const k = metrics ?? DEFAULT_CTO_KPI_METRICS;
  const totalProjects = Math.max(k.totalProjects || 0, 1);
  const totalTasks = Math.max(k.totalSubtasks || 0, 1);

  const projectCards = [
    {
      key: 'total-projects',
      title: 'Total Projects',
      value: k.totalProjects,
      subtitle: `${k.trendTotalProjects} from last quarter`,
      icon: 'ri-folder-3-line',
      theme: KPI_THEME.total,
      trend: { value: k.trendTotalProjects, positive: k.trendTotalProjectsPositive ?? true },
    },
    {
      key: 'active-projects',
      title: 'Active Projects',
      value: k.activeProjects,
      subtitle: `${Math.round((k.activeProjects / totalProjects) * 100)}% of total`,
      icon: 'ri-notification-3-line',
      theme: KPI_THEME.active,
      trend: { value: `${k.activeProjects} running`, positive: true },
    },
    {
      key: 'completed-projects',
      title: 'Completed Projects',
      value: k.completedProjects,
      subtitle: `${Math.round((k.completedProjects / totalProjects) * 100)}% completion rate`,
      icon: 'ri-checkbox-circle-line',
      theme: KPI_THEME.completed,
      trend: { value: `${k.completedProjects} done`, positive: true },
    },
    {
      key: 'delayed-projects',
      title: 'Delayed Projects',
      value: k.delayedProjects,
      subtitle: `${Math.round((k.delayedProjects / totalProjects) * 100)}% at risk`,
      icon: 'ri-error-warning-line',
      theme: KPI_THEME.delayed,
      trend: { value: `${k.delayedProjects} flagged`, positive: false },
    },
  ];

  const taskCards = [
    {
      key: 'total-tasks',
      title: 'Total Tasks',
      value: k.totalSubtasks,
      subtitle: 'Across all active projects',
      icon: 'ri-list-check-3',
      theme: KPI_THEME.subtasks,
      trend: { value: `${k.totalSubtasks} tracked`, positive: true },
    },
    {
      key: 'open-tasks',
      title: 'Open Tasks',
      value: k.openTasks,
      subtitle: `${Math.round((k.openTasks / totalTasks) * 100)}% of total tasks`,
      icon: 'ri-folder-open-line',
      theme: KPI_THEME.open,
      trend: { value: `${k.openTasks} pending`, positive: false },
    },
    {
      key: 'completed-tasks',
      title: 'Completed Tasks',
      value: k.completedTasks,
      subtitle: `${Math.round((k.completedTasks / totalTasks) * 100)}% task completion rate`,
      icon: 'ri-check-double-line',
      theme: KPI_THEME.tasksDone,
      trend: { value: `${k.completedTasks} closed`, positive: true },
    },
    {
      key: 'overdue-tasks',
      title: 'Overdue Tasks',
      value: k.overdueTasks,
      subtitle: 'Requires immediate action',
      icon: 'ri-alarm-warning-line',
      theme: KPI_THEME.overdue,
      trend: { value: `${k.overdueTasks} overdue`, positive: false },
    },
  ];

  const cards =
    group === 'projects' ? projectCards : group === 'tasks' ? taskCards : [...projectCards, ...taskCards];

  return (
    <div className={DASHBOARD_CARD_GRID}>
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


/** --- RAG / Health summary --- */

function RAGSummaryBar({ data, onCardClick, activeKey = null }) {
  const total = Math.max(data.length, 1);
  const red = data.filter((p) => p.rag === 'Red').length;
  const amber = data.filter((p) => p.rag === 'Amber').length;
  const green = data.filter((p) => p.rag === 'Green').length;
  const totalRevisions = data.reduce((acc, p) => acc + p.revisedCount, 0);
  const projectCount = data.length;
  const pct = (n) => Math.round((n / total) * 100);
  const revisionBarPct = Math.min(
    100,
    totalRevisions <= 0 ? 0 : Math.min(100, (totalRevisions / Math.max(projectCount * 8, 8)) * 100),
  );

  const cards = [
    {
      key: 'health-on-track',
      title: 'On Track',
      value: green,
      footnote: `${pct(green)}% of projects`,
      barPct: pct(green),
      icon: '🟢',
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
      key: 'health-at-risk',
      title: 'At Risk',
      value: amber,
      footnote: `${pct(amber)}% of projects`,
      barPct: pct(amber),
      icon: '🟡',
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
      key: 'health-delayed',
      title: 'Delayed',
      value: red,
      footnote: `${pct(red)}% of projects`,
      barPct: pct(red),
      icon: '🔴',
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
    {
      key: 'health-revisions',
      title: 'Total Revisions',
      value: totalRevisions,
      footnote: `Across ${projectCount} project${projectCount === 1 ? '' : 's'}`,
      barPct: revisionBarPct,
      iconClass: 'ri-refresh-line',
      valueColor: 'text-[#EA580C]',
      iconWrap: 'bg-orange-500/12 text-[#EA580C] ring-1 ring-orange-500/25',
      barColor: '#F97316',
      barTrack: 'bg-orange-100/90',
      cardBg: 'from-orange-50/90 via-white to-amber-50/75',
      borderHover: 'hover:border-orange-300/55',
      ringHover: 'group-hover:ring-orange-400/25',
      glow: 'rgba(249,115,22,0.18)',
      shadow: 'shadow-orange-900/5',
    },
  ];

  return (
    <div className={DASHBOARD_CARD_GRID}>
      {cards.map((card, index) => (
        <HealthMonitorCard
          key={card.key}
          title={card.title}
          value={card.value}
          footnote={card.footnote}
          barPct={card.barPct}
          barColor={card.barColor}
          barTrack={card.barTrack}
          icon={card.icon}
          iconClass={card.iconClass}
          valueColor={card.valueColor}
          iconWrap={card.iconWrap}
          cardBg={card.cardBg}
          borderHover={card.borderHover}
          ringHover={card.ringHover}
          glow={card.glow}
          shadow={card.shadow}
          index={index}
          active={activeKey === card.key}
          onClick={() => onCardClick?.(card.key)}
        />
      ))}
    </div>
  );
}

function TaskHealthMonitorBar({ data, onCardClick, activeKey = null }) {
  const total = Math.max(data.length, 1);
  const completed = data.filter((t) => isTaskCompleted(t.status)).length;
  const open = data.filter((t) => {
    const s = String(t.status || '').trim();
    return !isTaskCompleted(s) && s !== 'Overdue';
  }).length;
  const highPriority = data.filter((t) => String(t.priority || '').trim().toLowerCase() === 'high').length;
  const delayed = data.filter((t) => Number(t.delayDays) > 0).length;
  const pct = (n) => Math.round((n / total) * 100);

  const cards = [
    {
      key: 'task-health-completed',
      title: 'Completed',
      value: completed,
      footnote: `${pct(completed)}% of tasks`,
      barPct: pct(completed),
      iconClass: 'ri-checkbox-circle-line',
      valueColor: 'text-[#22C55E]',
      iconWrap: 'bg-emerald-500/15 text-[#22C55E] ring-1 ring-emerald-500/25',
      barColor: '#22C55E',
      barTrack: 'bg-emerald-100/80',
      cardBg: 'from-emerald-50/95 via-white to-green-50/80',
      borderHover: 'hover:border-emerald-300/60',
      ringHover: 'group-hover:ring-emerald-400/25',
      glow: 'rgba(34,197,94,0.22)',
      shadow: 'shadow-emerald-900/5',
    },
    {
      key: 'task-health-open',
      title: 'Open',
      value: open,
      footnote: `${pct(open)}% of tasks`,
      barPct: pct(open),
      iconClass: 'ri-folder-open-line',
      valueColor: 'text-[#F59E0B]',
      iconWrap: 'bg-amber-500/15 text-[#F59E0B] ring-1 ring-amber-500/30',
      barColor: '#F59E0B',
      barTrack: 'bg-amber-100/80',
      cardBg: 'from-amber-50/95 via-white to-yellow-50/70',
      borderHover: 'hover:border-amber-300/60',
      ringHover: 'group-hover:ring-amber-400/25',
      glow: 'rgba(245,158,11,0.2)',
      shadow: 'shadow-amber-900/5',
    },
    {
      key: 'task-health-high',
      title: 'High Priority',
      value: highPriority,
      footnote: `${pct(highPriority)}% of tasks`,
      barPct: pct(highPriority),
      iconClass: 'ri-flag-2-line',
      valueColor: 'text-[#EA580C]',
      iconWrap: 'bg-orange-500/12 text-[#EA580C] ring-1 ring-orange-500/25',
      barColor: '#F97316',
      barTrack: 'bg-orange-100/90',
      cardBg: 'from-orange-50/90 via-white to-amber-50/75',
      borderHover: 'hover:border-orange-300/55',
      ringHover: 'group-hover:ring-orange-400/25',
      glow: 'rgba(249,115,22,0.18)',
      shadow: 'shadow-orange-900/5',
    },
    {
      key: 'task-health-delayed',
      title: 'Delayed Tasks',
      value: delayed,
      footnote: `${pct(delayed)}% with delay days`,
      barPct: pct(delayed),
      iconClass: 'ri-error-warning-line',
      valueColor: 'text-[#E11D48]',
      iconWrap: 'bg-rose-500/12 text-rose-600 ring-1 ring-rose-500/25',
      barColor: '#E11D48',
      barTrack: 'bg-rose-100/90',
      cardBg: 'from-rose-50/92 via-white to-fuchsia-50/65',
      borderHover: 'hover:border-rose-300/55',
      ringHover: 'group-hover:ring-rose-400/25',
      glow: 'rgba(225,29,72,0.16)',
      shadow: 'shadow-rose-900/5',
    },
  ];

  return (
    <div className={DASHBOARD_CARD_GRID}>
      {cards.map((card, index) => (
        <HealthMonitorCard
          key={card.key}
          title={card.title}
          value={card.value}
          footnote={card.footnote}
          barPct={card.barPct}
          barColor={card.barColor}
          barTrack={card.barTrack}
          iconClass={card.iconClass}
          valueColor={card.valueColor}
          iconWrap={card.iconWrap}
          cardBg={card.cardBg}
          borderHover={card.borderHover}
          ringHover={card.ringHover}
          glow={card.glow}
          shadow={card.shadow}
          index={index}
          active={activeKey === card.key}
          onClick={() => onCardClick?.(card.key)}
        />
      ))}
    </div>
  );
}


/** --- Project health table --- */


const PAGE_SIZE = PT_TABLE_PAGE_SIZE;

const COLUMN_META = [
  { key: 'name', label: 'Project Name', filter: 'name' },
  { key: 'owner', label: 'Owner', filter: 'owner' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
  { key: 'revised', label: 'Revised' },
  { key: 'progress', label: 'Progress' },
  { key: 'rag', label: 'RAG Status', filter: 'rag' },
  { key: 'status', label: 'Status', filter: 'status' },
];

function parseRowEndDate(row) {
  const s = row.revisedEndDate ?? row.originalEndDate;
  if (s == null || s === '') return null;
  const t = Date.parse(String(s));
  return Number.isNaN(t) ? null : t;
}

function parseRowStartDate(row) {
  const s = row.startDate;
  if (s == null || s === '') return null;
  const t = Date.parse(String(s));
  return Number.isNaN(t) ? null : t;
}

function ragRank(rag) {
  const order = { Green: 1, Amber: 2, Red: 3 };
  return order[rag] ?? 99;
}

function RAGCell({ rag }) {
  const config = {
    Red: { bg: 'bg-red-50', border: 'border-l-4 border-[#E53935]', dot: '🔴', text: 'text-[#E53935]', label: 'Delayed' },
    Amber: { bg: 'bg-orange-50', border: 'border-l-4 border-[#FB8C00]', dot: '🟡', text: 'text-[#FB8C00]', label: 'At Risk' },
    Green: { bg: 'bg-green-50', border: 'border-l-4 border-[#43A047]', dot: '🟢', text: 'text-[#43A047]', label: 'On Track' },
  }[rag];
  if (!config) {
    return <span className="text-xs font-medium text-slate-500">—</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.text}`}>
      <span>{config.dot}</span>
      {config.label}
    </span>
  );
}

function StatusCell({ status }) {
  const map = {
    Open: 'bg-blue-50 text-[#1E88E5]',
    Active: 'bg-blue-50 text-[#1E88E5]',
    Planning: 'bg-purple-50 text-purple-600',
    'On Hold': 'bg-orange-50 text-[#FB8C00]',
    Completed: 'bg-green-50 text-[#43A047]',
    Closed: 'bg-green-50 text-[#43A047]',
    Done: 'bg-green-50 text-[#43A047]',
  };
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function ProgressCell({ value, compact }) {
  const color = value >= 70 ? '#43A047' : value >= 40 ? '#FB8C00' : '#E53935';
  return (
    <div className={`flex items-center gap-2 ${compact ? 'min-w-0 w-full' : 'min-w-[100px]'}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="w-9 text-right text-xs font-bold" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

const dashboardRowCreateLock = new Set();

/** Business project id (e.g. PRJ-...) for Project_ID_Hidden — not Kissflow board _id. */
function resolveProjectBusinessId(project) {
  const displayId = String(project?.displayId ?? '').trim();
  if (displayId && !displayId.startsWith('Pk')) return displayId;

  const candidates = [
    project?.raw?.Project_ID,
    project?.raw?.Project_Code,
    project?.Project_ID,
    project?.Project_Code,
  ];
  for (const candidate of candidates) {
    const value = String(typeof candidate === 'object' ? (candidate?.Project_ID || candidate?._item_id || '') : candidate ?? '').trim();
    if (value && !value.startsWith('Pk')) return value;
  }

  return displayId || String(project?.id ?? '').trim();
}

function mapProcessSubtaskItem(item) {
  const raw = item?.raw && typeof item.raw === 'object' ? item.raw : null;
  const summary = String(
    item?.summary || raw?.SubTask_Summary || item?.name || '',
  ).trim();
  const assigneeName =
    String(
      item?.assigneeName ||
        item?.people?.[0]?.name ||
        raw?.Assignee_1?.Name ||
        '',
    ).trim() ||
    String(raw?.externalemail || item?.assignedToEmail || '').trim() ||
    '—';
  const createdBy = String(
    item?.createdBy || raw?._created_by?.Name || '',
  ).trim() || '—';
  const displayName = summary || 'Untitled subtask';

  return {
    id: item.id,
    parentTaskBusinessId: item.parentTaskBusinessId,
    taskName: displayName,
    summary: summary || '—',
    assignedTo: assigneeName,
    createdBy,
    assigneeAvatar: item?.people?.[0]?.l || toInitials(assigneeName !== '—' ? assigneeName : createdBy),
    status: item.status || '—',
    startDate: '—',
    endDate: item.due || '—',
    agingDays: 0,
    delayDays: 0,
    _id: item.id,
    _activity_instance_id: item.activityInstanceId,
    InstanceID: item.id,
    ActivityID: item.activityInstanceId,
    raw: raw || item,
  };
}

function formatProjectRef(displayId, rowId) {
  const raw = String(displayId ?? rowId ?? '').trim();
  if (!raw) return 'Task-NA';
  if (raw.startsWith('Task-')) return raw;
  return raw;
}

function ProjectHealthTable({ data, allTasks, allProcessSubtasks, onOpenTaskPopup, onOpenSubtaskPopup, onOpenProjectPopup, onCreateTaskPopup, onCreateSubtask, onRefreshTasks, refreshingTasks, insightFilter = null, headerActions = null }) {
  const [ragFilter, setRagFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [nameFilter, setNameFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!insightFilter?.token) return;
    if (insightFilter.rag != null) {
      setRagFilter(insightFilter.rag);
      setStatusFilter('all');
      setOwnerFilter('all');
      setNameFilter('all');
      setSearch('');
      return;
    }
    if (insightFilter.status != null) {
      setStatusFilter(insightFilter.status);
      setRagFilter('all');
      setOwnerFilter('all');
      setNameFilter('all');
      setSearch('');
    }
  }, [insightFilter?.token, insightFilter?.status, insightFilter?.rag]);

  const projectNames = Array.from(new Set(data.map((d) => d.name).filter(Boolean))).sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }),
  );
  const owners = Array.from(new Set(data.map((d) => d.owner)));
  const statuses = Array.from(new Set(data.map((d) => d.status)));

  const dataWithProgress = useMemo(
    () =>
      data.map((project) => {
        const next = computeProjectProgressFromTasks(project, allTasks);
        const effectiveEnd = resolveEffectiveProjectEndDate(
          project.revisedEndDate,
          project.originalEndDate || project.plannedEndDate,
        );
        const delayDays = computeProjectDelayDays(project.status, effectiveEnd);
        const rag = computeProjectRag({
          status: project.status,
          delayDays,
          progress: next.progress,
          startDate: project.startDate,
          endDate: effectiveEnd,
        });
        return {
          ...project,
          progress: next.progress,
          totalTasks: next.totalTasks,
          completedTasks: next.completedTasks,
          delayDays,
          rag,
        };
      }),
    [data, allTasks],
  );

  const filtered = useMemo(
    () =>
      dataWithProgress.filter((row) => {
        if (nameFilter !== 'all' && row.name !== nameFilter) return false;
        if (ragFilter !== 'all' && row.rag !== ragFilter) return false;
        if (statusFilter === '__active__') {
          if (isProjectClosed(row.status)) return false;
        } else if (statusFilter !== 'all' && row.status !== statusFilter) {
          return false;
        }
        if (ownerFilter !== 'all' && row.owner !== ownerFilter) return false;
        if (
          search &&
          !row.name.toLowerCase().includes(search.toLowerCase()) &&
          !row.owner.toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [dataWithProgress, nameFilter, ragFilter, statusFilter, ownerFilter, search],
  );

  const sortedFiltered = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return dir * String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
        case 'owner':
          return dir * String(a.owner || '').localeCompare(String(b.owner || ''), undefined, { sensitivity: 'base' });
        case 'startDate': {
          const ta = parseRowStartDate(a);
          const tb = parseRowStartDate(b);
          if (ta == null && tb == null) return 0;
          if (ta == null) return sortDir === 'asc' ? 1 : -1;
          if (tb == null) return sortDir === 'asc' ? -1 : 1;
          return dir * (ta - tb);
        }
        case 'endDate': {
          const ta = parseRowEndDate(a);
          const tb = parseRowEndDate(b);
          if (ta == null && tb == null) return 0;
          if (ta == null) return sortDir === 'asc' ? 1 : -1;
          if (tb == null) return sortDir === 'asc' ? -1 : 1;
          return dir * (ta - tb);
        }
        case 'revised':
          return dir * ((a.revisedCount ?? 0) - (b.revisedCount ?? 0));
        case 'progress':
          return dir * ((a.progress ?? 0) - (b.progress ?? 0));
        case 'rag':
          return dir * (ragRank(a.rag) - ragRank(b.rag));
        case 'status':
          return dir * String(a.status || '').localeCompare(String(b.status || ''), undefined, { sensitivity: 'base' });
        default:
          return 0;
      }
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const total = sortedFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sortedFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, ragFilter, statusFilter, ownerFilter, nameFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setExpandedId(null);
  }, [search, ragFilter, statusFilter, ownerFilter, nameFilter, page, sortKey, sortDir]);

  const toggleExpand = (row) => {
    setExpandedId((id) => (id === row.id ? null : row.id));
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const clearTableFilters = () => {
    setSearch('');
    setRagFilter('all');
    setStatusFilter('all');
    setOwnerFilter('all');
    setNameFilter('all');
  };

  const columnFilterProps = {
    name: {
      filterValue: nameFilter,
      onFilterChange: setNameFilter,
      filterOptions: [
        { value: 'all', label: 'All Projects' },
        ...projectNames.map((n) => ({ value: n, label: n })),
      ],
    },
    owner: {
      filterValue: ownerFilter,
      onFilterChange: setOwnerFilter,
      filterOptions: [
        { value: 'all', label: 'All Owners' },
        ...owners.map((o) => ({ value: o, label: o })),
      ],
    },
    rag: {
      filterValue: ragFilter,
      onFilterChange: setRagFilter,
      filterOptions: [
        { value: 'all', label: 'All RAG' },
        { value: 'Red', label: '🔴 Red' },
        { value: 'Amber', label: '🟡 Amber' },
        { value: 'Green', label: '🟢 Green' },
      ],
    },
    status: {
      filterValue: statusFilter,
      onFilterChange: setStatusFilter,
      filterOptions: [
        { value: 'all', label: 'All Status' },
        { value: '__active__', label: 'Active (not completed)' },
        ...statuses.map((s) => ({ value: s, label: s })),
      ],
    },
  };

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftRag, setDraftRag] = useState(ragFilter);
  const [draftStatus, setDraftStatus] = useState(statusFilter);
  const [draftOwner, setDraftOwner] = useState(ownerFilter);
  const [draftName, setDraftName] = useState(nameFilter);

  const projectFilterCount = [ragFilter, statusFilter, ownerFilter, nameFilter].filter(
    (v) => v && v !== 'all',
  ).length;

  const openProjectFilterSheet = () => {
    setDraftRag(ragFilter);
    setDraftStatus(statusFilter);
    setDraftOwner(ownerFilter);
    setDraftName(nameFilter);
    setSheetOpen(true);
  };

  const applyProjectFilters = () => {
    setRagFilter(draftRag);
    setStatusFilter(draftStatus);
    setOwnerFilter(draftOwner);
    setNameFilter(draftName);
    setSheetOpen(false);
  };

  const clearProjectFilters = () => {
    setRagFilter('all');
    setStatusFilter('all');
    setOwnerFilter('all');
    setNameFilter('all');
    setDraftRag('all');
    setDraftStatus('all');
    setDraftOwner('all');
    setDraftName('all');
    setSheetOpen(false);
  };

  const projectFilterChips = [
    ragFilter !== 'all'
      ? { key: 'rag', label: ragFilter, onRemove: () => setRagFilter('all') }
      : null,
    statusFilter !== 'all'
      ? {
          key: 'status',
          label: statusFilter === '__active__' ? 'Active' : statusFilter,
          onRemove: () => setStatusFilter('all'),
        }
      : null,
    ownerFilter !== 'all'
      ? { key: 'owner', label: ownerFilter, onRemove: () => setOwnerFilter('all') }
      : null,
    nameFilter !== 'all'
      ? { key: 'name', label: nameFilter, onRemove: () => setNameFilter('all') }
      : null,
  ].filter(Boolean);

  const rowBg = (rag) => {
    if (rag === 'Red') return 'hover:bg-red-50/60';
    if (rag === 'Amber') return 'hover:bg-orange-50/60';
    return 'hover:bg-green-50/40';
  };

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl"
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center">
        <div className="text-left">
          <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Project Health Overview</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
            {filtered.length} of {data.length} projects
            <span className="hidden sm:inline">
              {totalPages > 1 ? ` · ${PAGE_SIZE} per page` : ''}
              {' · chevron expands · name opens details'}
            </span>
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto">
          <div className="relative w-full sm:w-44 lg:w-44">
            <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#7F8C8D]" />
            <input
              type="text"
              placeholder="Search project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs shadow-sm outline-none focus:border-indigo-500 lg:rounded-2xl"
            />
          </div>

          {/* Mobile Filters + Sort */}
          <div className="flex w-full gap-2 lg:hidden">
            <MobileFiltersButton count={projectFilterCount} onClick={openProjectFilterSheet} />
            <div className="flex min-w-0 flex-[1.2] items-center gap-1.5">
              <PtSelect
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="min-w-0 flex-1"
                aria-label="Sort by"
                options={COLUMN_META.map((col) => ({ value: col.key, label: col.label }))}
              />
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
                aria-label={sortDir === 'asc' ? 'Sort descending' : 'Sort ascending'}
              >
                <i className={sortDir === 'asc' ? 'ri-sort-asc' : 'ri-sort-desc'} />
              </button>
            </div>
          </div>
          <div className="lg:hidden">
            <MobileActiveFilterChips chips={projectFilterChips} />
          </div>

          {/* Desktop filter rail */}
          <div className="hidden snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 lg:flex lg:justify-end [&::-webkit-scrollbar]:hidden">
            <PtSelect
              value={ragFilter}
              onChange={(e) => setRagFilter(e.target.value)}
              className="min-w-[7.5rem] shrink-0"
              aria-label="Filter by RAG"
              options={[
                { value: 'all', label: 'All RAG' },
                { value: 'Red', label: '🔴 Red' },
                { value: 'Amber', label: '🟡 Amber' },
                { value: 'Green', label: '🟢 Green' },
              ]}
            />
            <PtSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-[8rem] shrink-0"
              aria-label="Filter by status"
              options={[
                { value: 'all', label: 'All Status' },
                { value: '__active__', label: 'Active (not completed)' },
                ...statuses.map((s) => ({ value: s, label: s })),
              ]}
            />
            <PtSelect
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="min-w-[7.5rem] max-w-[180px] shrink-0"
              aria-label="Filter by owner"
              options={[
                { value: 'all', label: 'All Owners' },
                ...owners.map((o) => ({ value: o, label: o })),
              ]}
            />
            {headerActions}
          </div>
          {headerActions ? <div className="flex w-full lg:hidden">{headerActions}</div> : null}
        </div>
      </div>

      <MobileFilterSheet
        open={sheetOpen}
        title="Project filters"
        onClose={() => setSheetOpen(false)}
        onClear={clearProjectFilters}
        onApply={applyProjectFilters}
      >
        <MobileFilterField label="RAG">
          <PtSelect
            value={draftRag}
            onChange={(e) => setDraftRag(e.target.value)}
            className="w-full"
            options={[
              { value: 'all', label: 'All RAG' },
              { value: 'Red', label: '🔴 Red' },
              { value: 'Amber', label: '🟡 Amber' },
              { value: 'Green', label: '🟢 Green' },
            ]}
          />
        </MobileFilterField>
        <MobileFilterField label="Status">
          <PtSelect
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value)}
            className="w-full"
            options={[
              { value: 'all', label: 'All Status' },
              { value: '__active__', label: 'Active (not completed)' },
              ...statuses.map((s) => ({ value: s, label: s })),
            ]}
          />
        </MobileFilterField>
        <MobileFilterField label="Owner">
          <PtSelect
            value={draftOwner}
            onChange={(e) => setDraftOwner(e.target.value)}
            className="w-full"
            options={[
              { value: 'all', label: 'All Owners' },
              ...owners.map((o) => ({ value: o, label: o })),
            ]}
          />
        </MobileFilterField>
        <MobileFilterField label="Project">
          <PtSelect
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="w-full"
            options={columnFilterProps.name.filterOptions}
          />
        </MobileFilterField>
      </MobileFilterSheet>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
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
                />
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <i className="ri-inbox-line text-3xl text-gray-300" />
                    <p className="text-sm text-[#7F8C8D]">No projects found</p>
                    <button
                      type="button"
                      onClick={clearTableFilters}
                      className="cursor-pointer text-xs text-[#1E88E5] hover:underline"
                    >
                      Clear filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const open = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`border-b border-slate-100 transition-all duration-150 ${rowBg(row.rag)} ${open ? 'bg-slate-50/70' : ''}`}
                      style={{ height: '56px' }}
                    >
                  <td className="px-5 py-3">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(row)}
                        aria-expanded={open}
                        aria-label={`${open ? 'Collapse' : 'Expand'} details for ${row.name}`}
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-[#1E88E5]"
                      >
                        <i
                          className={`ri-arrow-down-s-line text-base transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProjectPopup?.(row);
                        }}
                        className="min-w-0 text-left"
                      >
                        <p className="text-sm font-semibold text-[#2C3E50] transition-colors hover:text-[#1E88E5] hover:underline">
                          {row.name}
                        </p>
                        <p className="text-xs text-[#7F8C8D]">
                          {formatProjectRef(row.displayId, row.id)} · {row.lineOfBusiness}
                        </p>
                      </button>
                    </div>
                  </td>
                  <td className="cursor-pointer px-5 py-3" onClick={() => toggleExpand(row)}>
                    <PtUserAvatar name={row.owner} initials={row.ownerAvatar} />
                  </td>
                  <td className="cursor-pointer px-5 py-3" onClick={() => toggleExpand(row)}>
                    <span className="whitespace-nowrap text-sm text-[#2C3E50]">{row.startDate || '—'}</span>
                  </td>
                  <td className="cursor-pointer px-5 py-3" onClick={() => toggleExpand(row)}>
                    <div>
                      <p className="whitespace-nowrap text-sm text-[#2C3E50]">{row.revisedEndDate ?? row.originalEndDate}</p>
                      {row.delayDays > 0 ? <p className="text-xs font-medium text-[#E53935]">+{row.delayDays}d delay</p> : null}
                    </div>
                  </td>
                  <td className="cursor-pointer px-5 py-3" onClick={() => toggleExpand(row)}>
                    {row.revisedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-[#FB8C00]">
                        <i className="ri-refresh-line text-xs" />
                        {row.revisedCount}x
                      </span>
                    ) : (
                      <span className="text-xs text-[#7F8C8D]">—</span>
                    )}
                  </td>
                  <td className="cursor-pointer px-5 py-3" onClick={() => toggleExpand(row)}>
                    <ProgressCell value={row.progress} />
                  </td>
                  <td className="cursor-pointer px-5 py-3" onClick={() => toggleExpand(row)}>
                    <RAGCell rag={row.rag} />
                  </td>
                  <td className="cursor-pointer px-5 py-3" onClick={() => toggleExpand(row)}>
                    <StatusCell status={row.status} />
                  </td>
                    </tr>
                    {open ? (
                      <tr className="bg-slate-50/95">
                        <td colSpan={8} className="border-b border-slate-200 p-0 align-top">
                          <div className="max-h-[min(70vh,36rem)] overflow-y-auto border-t border-slate-200/80">
                            <ProjectDrillDownPanel
                              project={row}
                              allTasks={allTasks}
                              allProcessSubtasks={allProcessSubtasks}
                              onOpenTaskPopup={onOpenTaskPopup}
                              onOpenSubtaskPopup={onOpenSubtaskPopup}
                              onCreateTaskPopup={onCreateTaskPopup}
                              onCreateSubtask={onCreateSubtask}
                              onRefreshTasks={onRefreshTasks}
                              refreshingTasks={refreshingTasks}
                            />
                          </div>
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

      <div className="space-y-2.5 p-3 sm:space-y-3 sm:p-3 lg:hidden">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500 sm:text-sm">
            No projects found
          </div>
        )}
        {pageRows.map((row) => {
          const open = expandedId === row.id;
          return (
          <div
            key={row.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="w-full p-3 text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
            <button
              type="button"
                  onClick={() => onOpenProjectPopup?.(row)}
                  className="block w-full min-w-0 text-left"
            >
                  <p className="truncate text-sm font-semibold text-slate-800">{row.name}</p>
                <p className="mt-0.5 truncate text-[10px] leading-relaxed text-slate-500">
                  {formatProjectRef(row.displayId, row.id)} · {row.lineOfBusiness}
                </p>
                </button>
              </div>
              <div className="flex shrink-0 items-start gap-1.5">
                <div className="origin-top-right scale-90">
                  <RAGCell rag={row.rag} />
                </div>
                <button
                  type="button"
                  onClick={() => toggleExpand(row)}
                  aria-expanded={open}
                  aria-label={`${open ? 'Collapse' : 'Expand'} ${row.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-[#1E88E5]"
                >
                  <i
                    className={`ri-arrow-down-s-line text-xl transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                  aria-hidden
                />
                </button>
              </div>
            </div>
            <div className="mt-2.5 space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <PtUserAvatar name={row.owner} initials={row.ownerAvatar} />
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Owner</span>
            </div>
              <div className="flex items-center justify-between gap-2 py-0.5">
                <span className="shrink-0 text-slate-500">Start date</span>
                <span className="min-w-0 truncate text-right font-medium text-slate-800">{row.startDate || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 py-0.5">
                <span className="shrink-0 text-slate-500">End date</span>
                <span className="min-w-0 truncate text-right font-medium text-slate-800">{row.revisedEndDate ?? row.originalEndDate}</span>
              </div>
              {row.delayDays > 0 ? (
                <p className="text-end text-[10px] font-medium text-[#E53935]">+{row.delayDays}d delay</p>
              ) : null}
              {row.revisedCount > 0 ? (
              <div className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-slate-500">Revised</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-[#FB8C00]">
                    <i className="ri-refresh-line text-[10px]" />
                    {row.revisedCount}×
                  </span>
              </div>
              ) : null}
              <div className="py-0.5">
                <span className="mb-1 block text-slate-500">Progress</span>
                  <ProgressCell value={row.progress} compact />
              </div>
              <div className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-slate-500">Status</span>
                <StatusCell status={row.status} />
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={() => onOpenProjectPopup?.(row)}
                className="inline-flex min-h-[36px] items-center rounded-lg px-2 text-[11px] font-semibold text-[#1E88E5]"
              >
                View details
              </button>
              <button
                type="button"
                onClick={() => toggleExpand(row)}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-slate-600"
              >
                {open ? 'Hide' : 'Expand'}
                <i className={`ri-arrow-down-s-line transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
              </button>
            </div>
            </div>
            {open ? (
              <div className="border-t border-slate-200/80 bg-slate-100/70">
                  <ProjectDrillDownPanel
                    project={row}
                    allTasks={allTasks}
                    allProcessSubtasks={allProcessSubtasks}
                    onOpenTaskPopup={onOpenTaskPopup}
                    onOpenSubtaskPopup={onOpenSubtaskPopup}
                    onCreateTaskPopup={onCreateTaskPopup}
                    onCreateSubtask={onCreateSubtask}
                    onRefreshTasks={onRefreshTasks}
                    refreshingTasks={refreshingTasks}
                  />
              </div>
            ) : null}
          </div>
        );
        })}
      </div>

      <TablePaginationBar total={total} page={safePage} onPageChange={setPage} />
    </div>
  );
}


/** --- Subtask table --- */

function StatusBadge({ status }) {
  const v = String(status || '').trim();
  const sLower = v.toLowerCase();
  const cfg =
    sLower === 'completed' || sLower === 'closed' || sLower === 'done'
      ? { bg: 'bg-green-50', text: 'text-[#43A047]', dot: 'bg-[#43A047]' }
      : sLower.includes('progress') || sLower.includes('review')
        ? { bg: 'bg-blue-50', text: 'text-[#1E88E5]', dot: 'bg-[#1E88E5]' }
        : sLower.includes('hold') || sLower.includes('blocked')
          ? { bg: 'bg-orange-50', text: 'text-[#FB8C00]', dot: 'bg-[#FB8C00]' }
          : { bg: 'bg-gray-100', text: 'text-[#7F8C8D]', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-xs ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {v || '—'}
    </span>
  );
}

/** Completed / closed tasks cannot receive new subtasks. */
function isTaskCompleted(status) {
  const s = String(status || '').trim().toLowerCase();
  return s === 'completed' || s === 'closed' || s === 'done';
}

/** Closed / completed projects cannot receive new tasks; progress is 100%. */
function isProjectClosed(status) {
  return isClosedProjectStatus(status);
}

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

/** All tasks linked to any project in the list (deduped). */
function collectTasksForProjects(projects, allTasks) {
  const list = Array.isArray(projects) ? projects : [];
  if (!list.length) return [];

  const seen = new Set();
  const out = [];
  for (const project of list) {
    for (const task of getTasksLinkedToProject(project, allTasks)) {
      const key = resolveTaskBusinessIdFromRow(task) || String(task?.id ?? '').trim();
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      out.push(task);
    }
  }
  return out;
}

/** Progress: 100% if project closed; else completed tasks / total tasks; 0 if no tasks. */
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

function RagPill({ rag }) {
  if (rag === 'Red') {
    return <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-[#E53935]">Critical</span>;
  }
  if (rag === 'Amber') {
    return <span className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#FB8C00]">At Risk</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-[#43A047]">On Track</span>;
}

function displayFieldValue(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') {
    return String(value.Name || value.name || value.Value || value.value || value.Project_ID || value._id || '').trim();
  }
  return String(value).trim();
}

function stripHtmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function resolveAttachmentList(raw) {
  const candidates = [
    raw?.Supporting_Document,
    raw?.Supporting_Documents,
    raw?.Attachment,
    raw?.Attachments,
    raw?.Documents,
  ];
  for (const c of candidates) {
    if (!c) continue;
    if (Array.isArray(c)) return c.filter(Boolean);
    return [c];
  }
  return [];
}

function resolveTaskFormFields(row) {
  const r = row?.raw ?? {};
  const projectRef = r?.Project_ID || r?.Project_Lookup || r?.Project_Details || r?.Datelookup || {};
  const projectBusinessId =
    displayFieldValue(projectRef?.Project_ID) ||
    displayFieldValue(r?.Project_ID_Details) ||
    displayFieldValue(row?.projectRef) ||
    displayFieldValue(row?.projectId) ||
    '';
  const projectName =
    displayFieldValue(row?.projectName) ||
    displayFieldValue(projectRef?.Project_Name) ||
    displayFieldValue(projectRef?.Name) ||
    '';
  const itemId =
    displayFieldValue(projectRef?.Item_Id) ||
    displayFieldValue(projectRef?.Item_ID) ||
    displayFieldValue(projectRef?._item_id) ||
    displayFieldValue(row?.projectId) ||
    projectBusinessId;
  const detailRaw = r?.Task_Detail || r?.Description || r?.Notes || r?.Task_Details || '';

  return {
    taskId:
      displayFieldValue(row?.taskId) ||
      displayFieldValue(r?.Subtaxk_id) ||
      displayFieldValue(r?.Task_ID_Formulated) ||
      displayFieldValue(row?.id) ||
      '—',
    projectBusinessId: projectBusinessId || '—',
    projectName: projectName || '—',
    itemId: itemId || '—',
    taskType: displayFieldValue(row?.taskType || r?.Task_Type || r?.Task_type || r?.Type) || '—',
    taskName: displayFieldValue(row?.taskName || r?.Sub_Task_Name || r?.Name) || '—',
    entity: displayFieldValue(row?.entity || r?.Entity || r?.Entity_1) || '—',
    functions: displayFieldValue(row?.functions || r?.Functions || r?.Function || r?.Department) || '—',
    startDate: displayFieldValue(row?.startDate) || '—',
    endDate: displayFieldValue(row?.endDate) || '—',
    assignedTo:
      displayFieldValue(row?.assignedTo || r?.Assigned_To || r?.externalemail || row?.assignedToEmail) || '—',
    priority: displayFieldValue(row?.priority || r?.Task_Priority || r?.Priority) || '—',
    status: displayFieldValue(row?.status || r?.Task_Status || r?._status) || '—',
    detailText: stripHtmlToText(detailRaw) || '',
    documents: resolveAttachmentList(r),
    fromName: displayFieldValue(r?._created_by) || '',
  };
}

function personDisplayName(personLike, fallback = '') {
  const name = String(personLike?.Name || personLike?.name || '').trim();
  return name || String(fallback || '').trim();
}

function mapAttachmentList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((file, idx) => ({
      id: String(file?.id || file?.key || `file-${idx}`),
      name: String(file?.name || 'Attachment').trim() || 'Attachment',
      ext: String(file?.fileExtension || '').trim(),
      size: Number(file?.size) || 0,
    }))
    .filter((f) => f.name);
}

function isTruthyFlag(...values) {
  return values.some((v) => {
    if (v === true || v === 1 || v === '1') return true;
    const s = String(v ?? '').trim().toLowerCase();
    return s === 'true' || s === 'yes' || s === 'y' || s === 'enabled';
  });
}

/** Strict API boolean — avoids Boolean("false") === true. */
function parseApiBoolean(value) {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0' || value == null) return false;
  const s = String(value).trim().toLowerCase();
  if (['true', 'yes', 'y', 'enabled'].includes(s)) return true;
  if (['false', 'no', 'n', 'disabled', '', '—', '-'].includes(s)) return false;
  return false;
}

function formatBytes(size) {
  const n = Number(size) || 0;
  if (n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function detailHasValue(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return true;
  const text = String(value).trim();
  return Boolean(text) && text !== '—' && text !== '-' && text.toLowerCase() !== 'n/a';
}

function FlagPill({ on, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
        on
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80'
          : 'bg-slate-50 text-slate-400 ring-slate-200/80'
      }`}
    >
      <i className={on ? 'ri-checkbox-circle-fill' : 'ri-close-circle-line'} aria-hidden />
      {label}
    </span>
  );
}

function PersonTile({ label, name }) {
  if (!detailHasValue(name)) return null;
  return (
    <DetailTile label={label}>
      <div className="flex items-center gap-1.5">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1E88E5] text-[9px] font-bold text-white">
          {toInitials(name)}
        </div>
        <DetailValue>{name}</DetailValue>
      </div>
    </DetailTile>
  );
}

function DetailLabel({ children }) {
  return (
    <p className="mb-0.5 text-[11px] font-medium leading-none text-slate-500">
      {children}
    </p>
  );
}

function DetailValue({ children, highlight = false, className = '' }) {
  const empty = children == null || children === '' || children === '—';
  return (
    <p
      className={`text-[13px] font-medium leading-snug text-slate-700 sm:text-sm ${
        highlight ? 'text-[#E53935]' : empty ? 'text-slate-400' : ''
      } ${className}`}
    >
      {empty ? '—' : children}
    </p>
  );
}

/** Compact read-only field — form-like size + clear contrast on tinted section bodies */
function DetailTile({ label, children, highlight = false, className = '' }) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 sm:px-3 sm:py-2 ${
        highlight
          ? 'border-red-200/90 bg-red-50'
          : 'border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
      } ${className}`}
    >
      <DetailLabel>{label}</DetailLabel>
      {children}
    </div>
  );
}

function DetailSectionCard({ title, icon, accent = 'blue', children }) {
  const accents = {
    blue: {
      head: 'from-white to-blue-50/50',
      body: 'bg-[#F1F5FB]',
    },
    indigo: {
      head: 'from-white to-indigo-50/50',
      body: 'bg-[#F3F2FB]',
    },
    rose: {
      head: 'from-white to-rose-50/60',
      body: 'bg-[#FBF1F3]',
    },
    emerald: {
      head: 'from-white to-emerald-50/50',
      body: 'bg-[#F0F7F4]',
    },
    amber: {
      head: 'from-white to-amber-50/50',
      body: 'bg-[#FBF6EF]',
    },
  };
  const a = accents[accent] || accents.blue;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50">
      <div className={`flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r px-3.5 py-2.5 sm:px-4 ${a.head}`}>
        {icon ? <i className={`${icon} text-sm text-[#1E88E5]`} aria-hidden /> : null}
        <h3 className="text-[13px] font-medium text-slate-700 sm:text-sm">{title}</h3>
      </div>
      <div className={`p-3 sm:p-3.5 ${a.body}`}>{children}</div>
    </div>
  );
}

function resolveSubtaskFormFields(row) {
  const r = row?.raw ?? {};
  const summary =
    displayFieldValue(row?.summary) ||
    displayFieldValue(r?.SubTask_Summary) ||
    displayFieldValue(row?.taskName) ||
    '—';
  const assignedTo =
    displayFieldValue(row?.assignedTo) ||
    displayFieldValue(r?.Assignee_1) ||
    displayFieldValue(r?.externalemail) ||
    displayFieldValue(row?.assignedToEmail) ||
    '—';
  const createdBy =
    displayFieldValue(row?.createdBy) ||
    displayFieldValue(r?._created_by) ||
    '—';
  const status = displayFieldValue(row?.status || r?._status) || '—';
  return { summary, assignedTo, createdBy, status };
}

function TaskDetailFormView({ row, viewerName = 'User', isSubtask = false }) {
  if (isSubtask) {
    const f = resolveSubtaskFormFields(row);
    return (
      <div className="space-y-3 sm:space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2.5 rounded-2xl border border-slate-200/70 bg-white px-3.5 py-3 shadow-sm sm:px-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Subtask details</p>
            <h2 id="dash-detail-title" className="mt-0.5 text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
              {f.summary !== '—' ? f.summary : 'Subtask'}
            </h2>
          </div>
          <StatusBadge status={f.status} />
        </div>

        <DetailSectionCard title="Details" icon="ri-node-tree" accent="blue">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <DetailTile label="Summary" className="sm:col-span-3">
              <DetailValue>{f.summary}</DetailValue>
            </DetailTile>
            <DetailTile label="Assignee">
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1E88E5] text-[9px] font-bold text-white">
                  {toInitials(f.assignedTo)}
                </div>
                <DetailValue>{f.assignedTo}</DetailValue>
              </div>
            </DetailTile>
            <DetailTile label="Created by">
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-500 text-[9px] font-bold text-white">
                  {toInitials(f.createdBy)}
                </div>
                <DetailValue>{f.createdBy}</DetailValue>
              </div>
            </DetailTile>
            <DetailTile label="Status">
              <StatusBadge status={f.status} />
            </DetailTile>
          </div>
        </DetailSectionCard>
      </div>
    );
  }

  const f = resolveTaskFormFields(row);
  const from = f.fromName || viewerName || 'User';
  const revisionHistory = Array.isArray(row?.revisionHistory) ? row.revisionHistory : [];
  const hasRevision = Boolean(row?.hasRevision && row?.revisedEndDate);
  const revisionEntries = hasRevision ? revisionHistory.slice(1) : [];
  const revisedCount = Number(row?.revisedCount) || revisionEntries.length;

  return (
    <div className="space-y-3 sm:space-y-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2.5 rounded-2xl border border-slate-200/70 bg-white px-3.5 py-3 shadow-sm sm:px-4">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
            Task details
          </p>
          <h2 id="dash-detail-title" className="mt-0.5 text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
            {f.taskName !== '—' ? f.taskName : 'Project Task'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            From {from}
            {f.projectName !== '—' ? ` · ${f.projectName}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={f.status} />
          {f.priority && f.priority !== '—' ? (
            <span className="inline-flex items-center rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#1E88E5]">
              {f.priority}
                  </span>
                ) : null}
        </div>
      </div>

      <DetailSectionCard title="Overview" icon="ri-information-line" accent="blue">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <DetailTile label="Task ID">
            <DetailValue className="font-mono text-[12px] sm:text-[13px]">{f.taskId}</DetailValue>
          </DetailTile>
          <DetailTile label="Task type">
            <DetailValue>{f.taskType}</DetailValue>
          </DetailTile>
          <DetailTile label="Entity">
            <DetailValue>{f.entity}</DetailValue>
          </DetailTile>
          <DetailTile label="Functions">
            <DetailValue>{f.functions}</DetailValue>
          </DetailTile>
          <DetailTile label="Assigned to">
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1E88E5] text-[9px] font-bold text-white">
                {toInitials(f.assignedTo)}
              </div>
              <DetailValue>{f.assignedTo}</DetailValue>
            </div>
          </DetailTile>
          <DetailTile label="Status">
            <StatusBadge status={f.status} />
          </DetailTile>
        </div>
      </DetailSectionCard>

      <DetailSectionCard title="Project context" icon="ri-folder-3-line" accent="indigo">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <DetailTile label="Project ID">
            <DetailValue className="font-mono text-[12px] sm:text-[13px]">{f.projectBusinessId}</DetailValue>
          </DetailTile>
          <DetailTile label="Project name">
            <DetailValue>{f.projectName}</DetailValue>
          </DetailTile>
          <DetailTile label="Item ID">
            <DetailValue className="font-mono text-[12px] sm:text-[13px]">{f.itemId}</DetailValue>
          </DetailTile>
        </div>
      </DetailSectionCard>

      <DetailSectionCard title="Schedule" icon="ri-calendar-schedule-line" accent="blue">
        <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${hasRevision ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          <DetailTile label="Start date">
            <DetailValue>{f.startDate}</DetailValue>
          </DetailTile>
          <DetailTile label={hasRevision ? 'Previous end date' : 'End date'} highlight={!hasRevision && (f.status === 'Overdue' || Number(row?.delayDays) > 0)}>
            <DetailValue highlight={!hasRevision && (f.status === 'Overdue' || Number(row?.delayDays) > 0)}>
              {hasRevision
                ? (row?.previousEndDate || row?.originalEndDate || f.endDate)
                : f.endDate}
            </DetailValue>
          </DetailTile>
          {hasRevision ? (
            <DetailTile label="Latest revised end date" highlight>
              <DetailValue highlight>{row.revisedEndDate}</DetailValue>
            </DetailTile>
          ) : null}
          <DetailTile label="Delay" highlight={Number(row?.delayDays) > 0}>
            <DetailValue highlight={Number(row?.delayDays) > 0}>
              {Number(row?.delayDays) > 0 ? `+${row.delayDays} days` : 'On time'}
            </DetailValue>
          </DetailTile>
        </div>
      </DetailSectionCard>

      <DetailSectionCard title="Task detail" icon="ri-file-text-line" accent="indigo">
        <div className="min-h-[8rem] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-[13px] font-normal leading-relaxed text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:min-h-[10rem]">
          {f.detailText || <span className="text-slate-400">No details provided</span>}
        </div>
      </DetailSectionCard>

      {revisionEntries.length > 0 ? (
        <DetailSectionCard
          title={`Revision history (${revisedCount})`}
          icon="ri-history-line"
          accent="rose"
        >
          <div className="space-y-1.5">
            {revisionEntries.map((rev, idx) => (
              <div
                key={rev.key || `${rev.date}-${idx}`}
                className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] text-slate-600">
                    Updated on: <span className="font-medium text-slate-800">{rev.date || '—'}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">{rev.revisedBy || 'System'}</p>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-600">
                  <p>
                    Previous end date:{' '}
                    <span className="font-medium text-slate-500 line-through">{rev.previousEndDate || '—'}</span>
                  </p>
                  <i className="ri-arrow-right-line text-[11px] text-[#FB8C00]" aria-hidden />
                  <p>
                    Updated end date:{' '}
                    <span className="font-semibold text-[#FB8C00]">{rev.newEndDate || '—'}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DetailSectionCard>
      ) : null}
    </div>
  );
}

function DelayRevisionDetailView({ row }) {
  const revisionHistory = Array.isArray(row?.revisionHistory) ? row.revisionHistory : [];
  const progress = Number(row?.progress || 0);
  const progressColor = progress >= 70 ? '#43A047' : progress >= 40 ? '#FB8C00' : '#E53935';
  const delayed = Number(row?.delayDays) > 0;
  const hasRevision = Boolean(row?.hasRevision && row?.revisedEndDate);

  const people = [
    { label: 'Business owner', name: row?.businessOwner },
    { label: 'Project owner', name: row?.projectOwner || row?.owner },
    { label: 'Project manager', name: row?.projectManager },
    { label: 'Sponsor', name: row?.sponsor },
    { label: 'COS owner', name: row?.cosOwner },
    { label: 'Requester', name: row?.requester },
  ].filter((p) => detailHasValue(p.name));

  const classificationTiles = [
    { label: 'Entity', value: row?.entity },
    { label: 'Business function', value: row?.lineOfBusiness },
    { label: 'Function type', value: row?.functionType },
    { label: 'Function category', value: row?.functionCategory },
    { label: 'Sub category', value: row?.functionSubCategory },
    { label: 'Company', value: row?.companyName },
    { label: 'Application', value: row?.applicationName },
    { label: 'Project type', value: row?.projectType },
    { label: 'Request type', value: row?.projectRequest },
    { label: 'Governance', value: row?.governanceFrequency },
  ].filter((t) => detailHasValue(t.value));

  return (
    <div className="space-y-3 sm:space-y-3.5">
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-[#E8F0FE] via-white to-rose-50/40 px-3.5 py-3.5 sm:px-5 sm:py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Project details</p>
              <h2 id="dash-detail-title" className="mt-0.5 text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
                {row?.name || 'Untitled project'}
              </h2>
              <p className="mt-1 font-mono text-[11px] text-slate-500 sm:text-xs">
                {formatProjectRef(row?.displayId, row?.id)}
                {detailHasValue(row?.entity) ? ` · ${row.entity}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <RagPill rag={row?.rag} />
              {row?.status ? <StatusBadge status={row.status} /> : null}
              {detailHasValue(row?.priorityLabel || row?.priority) ? (
                <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {row.priorityLabel || row.priority}
              </span>
              ) : null}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-white/80 bg-white/90 px-3 py-2.5 shadow-sm">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-600 sm:text-xs">
              <span>Progress</span>
              <span style={{ color: progressColor }}>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: progressColor }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
              {row?.tcoEfforts != null && Number(row.tcoEfforts) > 0 ? (
                <span><span className="font-semibold text-slate-700">{row.tcoEfforts}</span> TCO efforts</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <DetailSectionCard title="Timeline impact" icon="ri-time-line" accent="rose">
        <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${hasRevision ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          <DetailTile label={hasRevision ? 'Previous End Date' : 'End Date'}>
            <DetailValue>{row?.previousEndDate || row?.plannedEndDate || row?.originalEndDate || '—'}</DetailValue>
          </DetailTile>
          {hasRevision ? (
            <DetailTile label="Latest Revised End Date" highlight>
              <DetailValue highlight>{row.revisedEndDate}</DetailValue>
            </DetailTile>
          ) : null}
          <DetailTile label="Delay" highlight={delayed}>
            <DetailValue highlight={delayed}>
              {delayed ? `+${row.delayDays} days` : 'No delay'}
            </DetailValue>
          </DetailTile>
          <DetailTile label="Revisions">
            <DetailValue>
              {Number(row?.revisedCount) > 0
                ? `${row.revisedCount} revision${row.revisedCount > 1 ? 's' : ''}`
                : 'No revisions'}
            </DetailValue>
          </DetailTile>
        </div>
      </DetailSectionCard>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DetailSectionCard title="Schedule" icon="ri-calendar-schedule-line" accent="blue">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <DetailTile label="Start date">
              <DetailValue>{row?.startDate || '—'}</DetailValue>
            </DetailTile>
            <DetailTile label="Planned end date">
              <DetailValue>{row?.plannedEndDate || row?.originalEndDate || '—'}</DetailValue>
            </DetailTile>
            <DetailTile label="Current end date">
              <DetailValue>{row?.originalEndDate || '—'}</DetailValue>
            </DetailTile>
            {hasRevision ? (
              <DetailTile label="Latest revised" highlight>
                <DetailValue highlight>{row.revisedEndDate}</DetailValue>
              </DetailTile>
            ) : null}
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="Status & risk" icon="ri-shield-flash-line" accent="amber">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <DetailTile label="Status">
              <StatusBadge status={row?.status} />
            </DetailTile>
            <DetailTile label="Priority">
              <DetailValue>{row?.priorityLabel || row?.priority || '—'}</DetailValue>
            </DetailTile>
            <DetailTile label="Risk">
              <DetailValue>{row?.risk || '—'}</DetailValue>
            </DetailTile>
            <DetailTile label="RAG">
              <RagPill rag={row?.rag} />
            </DetailTile>
          </div>
        </DetailSectionCard>
      </div>

      {classificationTiles.length > 0 ? (
        <DetailSectionCard title="Classification" icon="ri-organization-chart" accent="indigo">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {classificationTiles.map((tile) => (
              <DetailTile key={tile.label} label={tile.label}>
                <DetailValue>{tile.value}</DetailValue>
              </DetailTile>
            ))}
          </div>
        </DetailSectionCard>
      ) : null}

      {people.length > 0 ? (
        <DetailSectionCard title="People" icon="ri-team-line" accent="blue">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((p) => (
              <PersonTile key={`${p.label}-${p.name}`} label={p.label} name={p.name} />
            ))}
          </div>
        </DetailSectionCard>
      ) : null}

      <DetailSectionCard title="Technology & integrations" icon="ri-cpu-line" accent="emerald">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {detailHasValue(row?.vendorName) ? (
            <DetailTile label="Vendor">
              <DetailValue>{row.vendorName}</DetailValue>
            </DetailTile>
          ) : null}
          {detailHasValue(row?.techStack) ? (
            <DetailTile label="Tech stack" className="sm:col-span-2">
              <DetailValue>{row.techStack}</DetailValue>
            </DetailTile>
          ) : null}
          <DetailTile label="AI usage">
            <div className="flex flex-wrap items-center gap-1.5">
              <FlagPill on={row?.aiUsage === true} label={row?.aiUsage === true ? 'Enabled' : 'Not used'} />
              {detailHasValue(row?.aiDetails) ? (
                <span className="text-[11px] font-medium text-slate-600">{row.aiDetails}</span>
              ) : null}
            </div>
          </DetailTile>
          <DetailTile label="Reports" className="sm:col-span-2 lg:col-span-3">
            <div className="flex flex-wrap gap-1.5">
              <FlagPill on={row?.reportsAvailable === true} label="Reports" />
              <FlagPill on={row?.integratedTally === true} label="Tally" />
              <FlagPill on={row?.integratedSap === true} label="SAP" />
              <FlagPill on={row?.integratedPowerBi === true} label="Power BI" />
            </div>
          </DetailTile>
        </div>
      </DetailSectionCard>

      {(detailHasValue(row?.createdAt) || detailHasValue(row?.modifiedAt) || detailHasValue(row?.createdBy)) ? (
        <DetailSectionCard title="Record info" icon="ri-information-line" accent="blue">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <DetailTile label="Created on">
              <DetailValue>{row?.createdAt || '—'}</DetailValue>
            </DetailTile>
            <DetailTile label="Last modified">
              <DetailValue>{row?.modifiedAt || '—'}</DetailValue>
            </DetailTile>
            <DetailTile label="Created by">
              <DetailValue>{row?.createdBy || '—'}</DetailValue>
            </DetailTile>
          </div>
        </DetailSectionCard>
      ) : null}

      {hasRevision && revisionHistory.length > 1 ? (
        <DetailSectionCard title={`Revision history (${row.revisedCount || revisionHistory.length - 1})`} icon="ri-history-line" accent="rose">
          <div className="space-y-1.5">
            {revisionHistory.slice(1).map((rev, idx) => (
              <div
                key={rev.key || `${rev.date}-${idx}`}
                className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] text-slate-600">
                    Updated on: <span className="font-medium text-slate-800">{rev.date || '—'}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">{rev.revisedBy || 'System'}</p>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-600">
                  <p>
                    Previous end date:{' '}
                    <span className="font-medium text-slate-500 line-through">{rev.previousEndDate || '—'}</span>
                  </p>
                  <i className="ri-arrow-right-line text-[11px] text-[#FB8C00]" aria-hidden />
                  <p>
                    Updated end date:{' '}
                    <span className="font-semibold text-[#FB8C00]">{rev.newEndDate || '—'}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DetailSectionCard>
      ) : null}
    </div>
  );
}

/** In-app detail modal — compact fields + themed contrast. */
function DashboardDetailModal({ detail, onClose, viewerName = 'User', onOpenKissflowForm = null }) {
  useEffect(() => {
    if (!detail) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [detail, onClose]);

  if (typeof document === 'undefined') return null;

  const type = detail?.type || 'project';
  const isTask = type === 'task';
  const isSubtask = type === 'subtask';
  const isTaskLike = isTask || isSubtask;
  const row = detail?.row;
  const canUpdateForm = isTask || isSubtask;

  return createPortal(
    <AnimatePresence>
      {detail && row ? (
        <motion.div
          key={`dash-detail-${type}-${row.id}`}
          className="fixed inset-0 z-[200] overflow-hidden bg-slate-900/40 backdrop-blur-[2px]"
          onClick={onClose}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="flex h-full min-h-0 items-stretch justify-center p-0 sm:items-center sm:p-4 lg:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="flex h-full max-h-[100vh] w-full max-w-5xl flex-col overflow-hidden border border-slate-200/80 bg-[#F7F9FC] shadow-2xl shadow-slate-300/50 sm:h-auto sm:max-h-[92vh] sm:rounded-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dash-detail-title"
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 12 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-gradient-to-r from-white to-blue-50/40 px-4 py-2.5 sm:px-5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {isTaskLike ? (isSubtask ? 'Subtask' : 'Task') : 'Project'}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
                  aria-label="Close details"
                >
                  <i className="ri-close-line text-lg" aria-hidden />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5 sm:px-5 sm:py-4">
                {isTaskLike ? (
                  <TaskDetailFormView row={row} viewerName={viewerName} isSubtask={isSubtask} />
                ) : (
                  <DelayRevisionDetailView row={row} />
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 bg-white px-4 py-2.5 sm:px-5">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Close
                </button>
                {canUpdateForm ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose?.();
                      if (isSubtask) requestOpenSubtaskDetails(subtaskRowToFormDefaults(row));
                      else requestOpenTaskDetails(taskRowToFormDefaults(row));
                    }}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#1E88E5] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1565C0]"
                  >
                    <i className="ri-edit-line" aria-hidden />
                    {isSubtask ? 'Update subtask' : 'Update task'}
                  </button>
                ) : null}
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function isEmptyProjectName(projectName) {
  const v = String(projectName ?? '').trim();
  return !v || v === '—' || v === '-' || v.toLowerCase() === 'n/a';
}

function TaskProjectCell({ projectName, projectId = '', compact = false }) {
  const id = String(projectId || '').trim();
  const hasName = !isEmptyProjectName(projectName);
  // Individual Task only when nothing is mapped — not when a project id/name exists.
  if (!hasName && !id) {
  return (
      <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200/80 sm:text-xs">
        Individual Task
      </span>
    );
  }
  const label = hasName ? String(projectName).trim() : id;
  return (
    <span
      className={`inline-block max-w-[140px] truncate rounded-lg bg-blue-50 px-2 py-0.5 font-medium text-[#1E88E5] ${
        compact ? 'text-[11px]' : 'text-xs'
      }`}
      title={label}
    >
      {label}
    </span>
  );
}

function SubtaskTable({
  data,
  onRowClick,
  onOpenPopup,
  onOpenSubtaskPopup,
  hideTitle = false,
  hideTaskIds = false,
  countLabel,
  compact = false,
  headerActions = null,
  nestedMode = false,
  allProcessSubtasks = null,
  onCreateSubtask,
  hideProjectFilter = false,
  onRefresh,
  refreshing = false,
  insightFilter = null,
  bulkSelectEnabled = false,
  selectedRowIds = null,
  onToggleRowSelect,
  onToggleAllRowsSelect,
  getRowSelectId,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [taskNameFilter, setTaskNameFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [sortKey, setSortKey] = useState('taskName');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [expandedTaskIds, setExpandedTaskIds] = useState(() => new Set());

  useEffect(() => {
    if (!insightFilter?.token) return;
    if (insightFilter.status != null) {
      setStatusFilter(insightFilter.status);
      setProjectFilter('all');
      setTaskNameFilter('all');
      setAssigneeFilter('all');
      setSearch('');
    }
  }, [insightFilter?.token, insightFilter?.status]);

  const getSubtasksForTask = useCallback(
    (taskRow) => {
      if (!nestedMode || !Array.isArray(allProcessSubtasks)) return [];
      return filterSubtasksForTask(allProcessSubtasks, resolveTaskBusinessIdFromRow(taskRow));
    },
    [allProcessSubtasks, nestedMode],
  );

  const toggleTaskExpand = useCallback((taskId, event) => {
    event?.stopPropagation?.();
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const openNestedSubtask = useCallback(
    (sub) => {
      const opened =
        typeof onOpenSubtaskPopup === 'function'
          ? onOpenSubtaskPopup(sub)
          : typeof onOpenPopup === 'function'
            ? onOpenPopup(sub)
            : false;
      if (!opened) onRowClick?.(sub);
    },
    [onOpenSubtaskPopup, onOpenPopup, onRowClick],
  );

  const taskNameOptions = useMemo(
    () => distinctFilterOptions(data, (d) => d.taskName, { allLabel: 'All Tasks' }),
    [data],
  );
  const projectOptions = useMemo(
    () =>
      distinctFilterOptions(data, (d) => d.projectName, {
        allLabel: 'All Projects',
        emptyValue: '__individual__',
        emptyLabel: 'Individual Task',
      }),
    [data],
  );
  const assigneeOptions = useMemo(
    () => distinctFilterOptions(data, (d) => d.assignedTo, { allLabel: 'All Assignees' }),
    [data],
  );
  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'All Status' },
      { value: '__open__', label: 'Open (not completed)' },
      { value: '__high_priority__', label: 'High Priority' },
      { value: '__delayed__', label: 'Delayed (delay days)' },
      ...distinctFilterOptions(data, (d) => d.status, { allLabel: 'All Status' }).slice(1),
    ],
    [data],
  );

  const filtered = useMemo(
    () =>
      data.filter((row) => {
        if (taskNameFilter !== 'all' && row.taskName !== taskNameFilter) return false;
        if (assigneeFilter !== 'all' && row.assignedTo !== assigneeFilter) return false;
        if (statusFilter === '__open__') {
          if (row.status === 'Completed') return false;
        } else if (statusFilter === '__high_priority__') {
          if (String(row.priority || '').trim().toLowerCase() !== 'high') return false;
        } else if (statusFilter === '__delayed__') {
          if (!(Number(row.delayDays) > 0)) return false;
        } else if (statusFilter !== 'all' && row.status !== statusFilter) {
          return false;
        }
        if (projectFilter === '__individual__') {
          if (!isEmptyProjectName(row.projectName)) return false;
        } else if (projectFilter !== 'all' && row.projectName !== projectFilter) {
          return false;
        }
    if (
      search &&
      !row.taskName.toLowerCase().includes(search.toLowerCase()) &&
      !row.assignedTo.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
      }),
    [data, statusFilter, projectFilter, taskNameFilter, assigneeFilter, search],
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
          return compareDateValue(a.endDate, b.endDate, dir, sortDir);
        case 'revised':
        case 'revisedCount':
          return compareNumber(a.revisedCount, b.revisedCount, dir);
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
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sortedFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, projectFilter, taskNameFilter, assigneeFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSort = (key) => {
    const next = toggleSortState(sortKey, sortDir, key);
    setSortKey(next.sortKey);
    setSortDir(next.sortDir);
  };

  const columnFilterProps = {
    taskName: { filterValue: taskNameFilter, onFilterChange: setTaskNameFilter, filterOptions: taskNameOptions },
    project: { filterValue: projectFilter, onFilterChange: setProjectFilter, filterOptions: projectOptions },
    assignedTo: { filterValue: assigneeFilter, onFilterChange: setAssigneeFilter, filterOptions: assigneeOptions },
    status: { filterValue: statusFilter, onFilterChange: setStatusFilter, filterOptions: statusOptions },
  };

  const TASK_TRACKER_COLUMNS = [
    { key: 'taskName', label: 'Task Name', filter: 'taskName' },
    { key: 'projectName', label: 'Project', filter: 'project' },
    { key: 'assignedTo', label: 'Assigned To', filter: 'assignedTo' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'endDate', label: 'End Date' },
    { key: 'revised', label: 'Revised' },
    { key: 'status', label: 'Status', filter: 'status' },
  ].filter((col) => !(hideProjectFilter && col.filter === 'project'));

  const taskTableColSpan = TASK_TRACKER_COLUMNS.length + (bulkSelectEnabled ? 1 : 0);
  const resolveSelectId = getRowSelectId || ((row) => String(row?.id || row?.InstanceID || '').trim());
  const pageRowIds = pageRows.map((row) => resolveSelectId(row)).filter(Boolean);
  const allPageSelected = bulkSelectEnabled && pageRowIds.length > 0
    && pageRowIds.every((id) => selectedRowIds?.has?.(id));

  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(statusFilter);
  const [draftProject, setDraftProject] = useState(projectFilter);
  const [draftTaskName, setDraftTaskName] = useState(taskNameFilter);
  const [draftAssignee, setDraftAssignee] = useState(assigneeFilter);

  const taskFilterCount = [
    statusFilter !== 'all',
    !hideProjectFilter && projectFilter !== 'all',
    taskNameFilter !== 'all',
    assigneeFilter !== 'all',
  ].filter(Boolean).length;

  const openTaskFilterSheet = () => {
    setDraftStatus(statusFilter);
    setDraftProject(projectFilter);
    setDraftTaskName(taskNameFilter);
    setDraftAssignee(assigneeFilter);
    setTaskSheetOpen(true);
  };

  const applyTaskFilters = () => {
    setStatusFilter(draftStatus);
    setProjectFilter(draftProject);
    setTaskNameFilter(draftTaskName);
    setAssigneeFilter(draftAssignee);
    setTaskSheetOpen(false);
  };

  const clearTaskFilters = () => {
    setStatusFilter('all');
    setProjectFilter('all');
    setTaskNameFilter('all');
    setAssigneeFilter('all');
    setDraftStatus('all');
    setDraftProject('all');
    setDraftTaskName('all');
    setDraftAssignee('all');
    setTaskSheetOpen(false);
  };

  const taskChips = [
    statusFilter !== 'all'
      ? {
          key: 'status',
          label:
            statusFilter === '__open__'
              ? 'Open'
              : statusFilter === '__high_priority__'
                ? 'High priority'
                : statusFilter === '__delayed__'
                  ? 'Delayed'
                  : statusFilter,
          onRemove: () => setStatusFilter('all'),
        }
      : null,
    !hideProjectFilter && projectFilter !== 'all'
      ? {
          key: 'project',
          label: projectFilter === '__individual__' ? 'Individual' : projectFilter,
          onRemove: () => setProjectFilter('all'),
        }
      : null,
    taskNameFilter !== 'all'
      ? { key: 'task', label: taskNameFilter, onRemove: () => setTaskNameFilter('all') }
      : null,
    assigneeFilter !== 'all'
      ? { key: 'assignee', label: assigneeFilter, onRemove: () => setAssigneeFilter('all') }
      : null,
  ].filter(Boolean);

  return (
    <div
      className={`overflow-hidden rounded-2xl ${compact ? 'border border-slate-200 bg-white shadow-sm' : 'border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm'} lg:rounded-3xl`}
    >
      <div className={`flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-indigo-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center ${compact ? 'sm:py-3' : ''}`}>
        {!hideTitle ? (
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Task Tracker</h3>
            <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
              {total} tasks
              <span className="hidden sm:inline">
                {totalPages > 1 ? ` · ${PAGE_SIZE} per page` : ''}
                {' · tap a row for details'}
              </span>
            </p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className={`text-slate-600 ${compact ? 'text-[11px]' : 'text-[11px]'} sm:text-xs`}>
              {typeof countLabel === 'function' ? countLabel(filtered.length) : (countLabel ?? `${filtered.length} tasks shown`)}
            </p>
          </div>
        )}

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto">
          <div className={`relative w-full ${compact ? 'sm:w-48' : 'sm:w-40'}`}>
            <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#7F8C8D]" />
            <input
              type="text"
              placeholder="Search task..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`min-h-[40px] w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 outline-none focus:border-indigo-500 lg:rounded-2xl ${compact ? 'text-[11px]' : 'text-[11px]'} sm:text-xs`}
            />
          </div>

          <div className="flex w-full gap-2 lg:hidden">
            <MobileFiltersButton count={taskFilterCount} onClick={openTaskFilterSheet} />
            {typeof onRefresh === 'function' ? (
              <button
                type="button"
                aria-label="Refresh tasks"
                disabled={refreshing}
                onClick={() => onRefresh()}
                className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-[#2C3E50]"
              >
                <i className={`ri-refresh-line text-sm ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
                {refreshing ? '…' : 'Refresh'}
              </button>
            ) : null}
          </div>
          <div className="lg:hidden">
            <MobileActiveFilterChips chips={taskChips} />
          </div>
          {headerActions ? <div className="w-full lg:hidden">{headerActions}</div> : null}

          <div className="hidden snap-x snap-mandatory items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 lg:flex [&::-webkit-scrollbar]:hidden">
            <PtSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-[8rem] shrink-0"
              aria-label="Filter by status"
              options={statusOptions}
            />
            {!hideProjectFilter ? (
            <PtSelect
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="min-w-[8rem] max-w-[180px] shrink-0"
              aria-label="Filter by project"
              options={projectOptions}
            />
            ) : null}
            {typeof onRefresh === 'function' ? (
              <button
                type="button"
                aria-label="Refresh tasks"
                disabled={refreshing}
                onClick={() => onRefresh()}
                className="shrink-0 snap-start inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-[#2C3E50] shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:text-xs"
              >
                <i className={`ri-refresh-line text-sm ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            ) : null}
            {headerActions}
          </div>
        </div>
      </div>

      <MobileFilterSheet
        open={taskSheetOpen}
        title="Task filters"
        onClose={() => setTaskSheetOpen(false)}
        onClear={clearTaskFilters}
        onApply={applyTaskFilters}
      >
        <MobileFilterField label="Status">
          <PtSelect value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)} className="w-full" options={statusOptions} />
        </MobileFilterField>
        {!hideProjectFilter ? (
          <MobileFilterField label="Project">
            <PtSelect value={draftProject} onChange={(e) => setDraftProject(e.target.value)} className="w-full" options={projectOptions} />
          </MobileFilterField>
        ) : null}
        <MobileFilterField label="Task">
          <PtSelect
            value={draftTaskName}
            onChange={(e) => setDraftTaskName(e.target.value)}
            className="w-full"
            options={columnFilterProps.taskName.filterOptions}
          />
        </MobileFilterField>
        <MobileFilterField label="Assignee">
          <PtSelect
            value={draftAssignee}
            onChange={(e) => setDraftAssignee(e.target.value)}
            className="w-full"
            options={columnFilterProps.assignedTo.filterOptions}
          />
        </MobileFilterField>
      </MobileFilterSheet>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {bulkSelectEnabled ? (
                <th className={`w-10 ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}`}>
                  <input
                    type="checkbox"
                    aria-label="Select all tasks on this page"
                    checked={allPageSelected}
                    onChange={(e) => onToggleAllRowsSelect?.(e.target.checked, pageRowIds)}
                    className="h-4 w-4 rounded border-slate-300 text-[#1E62F0] focus:ring-[#1E62F0]"
                  />
                </th>
              ) : null}
              {TASK_TRACKER_COLUMNS.map((col) => {
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
                    className={compact ? 'px-4 py-2.5' : ''}
                  />
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={taskTableColSpan} className="px-5 py-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <i className="ri-task-line text-3xl text-gray-300" />
                    <p className="text-sm text-[#7F8C8D]">No tasks found</p>
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const childSubtasks = getSubtasksForTask(row);
                const isExpanded = expandedTaskIds.has(row.id);
                const canAddSubtask = typeof onCreateSubtask === 'function' && !isTaskCompleted(row.status);
                const showNested = nestedMode && (childSubtasks.length > 0 || canAddSubtask);

                return (
                <Fragment key={row.id}>
                <tr
                  onClick={() => {
                    const opened = typeof onOpenPopup === 'function' ? onOpenPopup(row) : false;
                    if (!opened) onRowClick?.(row);
                  }}
                  className="cursor-pointer border-b border-slate-100 transition-all duration-150 hover:bg-slate-50"
                  style={{ height: '56px' }}
                >
                  {bulkSelectEnabled ? (
                    <td className={compact ? 'px-3 py-2.5' : 'px-4 py-3'} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select task ${row.taskName || ''}`}
                        checked={selectedRowIds?.has?.(resolveSelectId(row)) ?? false}
                        onChange={() => onToggleRowSelect?.(resolveSelectId(row), row)}
                        className="h-4 w-4 rounded border-slate-300 text-[#1E62F0] focus:ring-[#1E62F0]"
                      />
                    </td>
                  ) : null}
                  <td className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}>
                    <div className="flex items-start gap-2">
                      {nestedMode ? (
                        showNested ? (
                          <button
                            type="button"
                            aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                            onClick={(e) => toggleTaskExpand(row.id, e)}
                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#7F8C8D] transition hover:bg-slate-100 hover:text-[#1E88E5]"
                          >
                            <i className={`ri-arrow-${isExpanded ? 'down' : 'right'}-s-line text-base`} aria-hidden />
                          </button>
                        ) : (
                          <span className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                        )
                      ) : null}
                      <div className="min-w-0">
                    <p className={`max-w-[200px] truncate font-medium text-[#2C3E50] ${compact ? 'text-[12px]' : 'text-sm'}`}>{row.taskName}</p>
                        {!hideTaskIds ? (
                          <p className="text-xs text-[#7F8C8D]">{row.taskId || row.id}</p>
                        ) : null}
                        {nestedMode && childSubtasks.length > 0 ? (
                          <p className="text-[10px] font-medium text-[#FB8C00]">{childSubtasks.length} subtask{childSubtasks.length === 1 ? '' : 's'}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  {!hideProjectFilter ? (
                  <td
                    className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}
                    onClick={(e) => e.stopPropagation()}
                    title={
                      !isEmptyProjectName(row.projectName)
                        ? row.projectName
                        : (row.projectId || 'Individual Task')
                    }
                  >
                    <TaskProjectCell projectName={row.projectName} projectId={row.projectId} compact={compact} />
                  </td>
                  ) : null}
                  <td className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}>
                    <PtUserAvatar
                      name={row.assignedTo}
                      initials={row.assigneeAvatar}
                      sizeClass={compact ? 'h-6 w-6' : 'h-7 w-7'}
                      textClass={compact ? 'text-[10px]' : 'text-[11px]'}
                    />
                  </td>
                  <td className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}>
                    <span className={`whitespace-nowrap text-[#2C3E50] ${compact ? 'text-[12px]' : 'text-sm'}`}>{row.startDate}</span>
                  </td>
                  <td className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}>
                    <div>
                      <p className={`whitespace-nowrap text-[#2C3E50] ${compact ? 'text-[12px]' : 'text-sm'}`}>
                        {row.revisedEndDate ?? row.endDate}
                      </p>
                      {Number(row.delayDays) > 0 ? (
                        <p className={`font-medium text-[#E53935] ${compact ? 'text-[10px]' : 'text-xs'}`}>
                          +{row.delayDays}d delay
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}>
                    {row.revisedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-[#FB8C00]">
                        <i className="ri-refresh-line text-xs" />
                        {row.revisedCount}x
                      </span>
                    ) : (
                      <span className="text-xs text-[#7F8C8D]">—</span>
                    )}
                  </td>
                  <td className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={row.status} />
                      <CompletedStatusUpdate
                        status={row.status}
                        onUpdate={() => {
                          const opened = typeof onOpenPopup === 'function' ? onOpenPopup(row) : false;
                          if (!opened) onRowClick?.(row);
                        }}
                      />
                    </div>
                  </td>
                </tr>
                {showNested && isExpanded ? (
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <td colSpan={taskTableColSpan} className={compact ? 'px-4 py-3' : 'px-5 py-4'}>
                      <div className="space-y-2 pl-2 sm:pl-4">
                        {childSubtasks.length === 0 ? (
                          <p className="text-[11px] text-[#7F8C8D]">No subtasks yet.</p>
                        ) : (
                          childSubtasks.map((sub) => (
                            <SubtaskAccordionRow
                              key={sub.id}
                              sub={sub}
                              onClick={() => openNestedSubtask(sub)}
                              statusSlot={(
                                <span className="inline-flex items-center gap-2">
                                  <StatusBadge status={sub.status} />
                                  <CompletedStatusUpdate status={sub.status} onUpdate={() => openNestedSubtask(sub)} />
                                </span>
                              )}
                            />
                          ))
                        )}
                        {canAddSubtask ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCreateSubtask(row);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-2xl border border-[#1E88E5]/30 bg-[#E8F0FE] px-3 py-1.5 text-[11px] font-semibold text-[#1E88E5] transition hover:bg-[#dbeafe]"
                          >
                            <i className="ri-add-line" aria-hidden />
                            Add subtask
                          </button>
                        ) : null}
                      </div>
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

      <div className="space-y-2 p-3 lg:hidden">
        {pageRows.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">No tasks found</div>
        )}
        {pageRows.map((row) => {
          const childSubtasks = getSubtasksForTask(row);
          const isExpanded = expandedTaskIds.has(row.id);
          const canAddSubtask = typeof onCreateSubtask === 'function' && !isTaskCompleted(row.status);
          const showNested = nestedMode && (childSubtasks.length > 0 || canAddSubtask);

          return (
          <div
            key={row.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
          <button
            type="button"
            onClick={() => {
              const opened = typeof onOpenPopup === 'function' ? onOpenPopup(row) : false;
              if (!opened) onRowClick?.(row);
            }}
            className="w-full p-3 text-left"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1E88E5]">Task</p>
                  <span className="inline-flex items-center gap-2">
                    <StatusBadge status={row.status} />
                    <CompletedStatusUpdate
                      status={row.status}
                      onUpdate={() => {
                        const opened = typeof onOpenPopup === 'function' ? onOpenPopup(row) : false;
                        if (!opened) onRowClick?.(row);
                      }}
                    />
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-slate-800">{row.taskName}</p>
                <p className="mt-1">
                  {(!isEmptyProjectName(row.projectName) || String(row.projectId || '').trim()) ? (
                    <span className="truncate text-[11px] font-medium text-[#1E88E5]">
                      {!isEmptyProjectName(row.projectName) ? row.projectName : row.projectId}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200/80">
                      Individual Task
                    </span>
                  )}
                </p>
              </div>
              {showNested ? (
                <button
                  type="button"
                  aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                  onClick={(e) => toggleTaskExpand(row.id, e)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100"
                >
                  <i className={`ri-arrow-${isExpanded ? 'down' : 'right'}-s-line text-lg`} aria-hidden />
                </button>
              ) : null}
            </div>
            {!hideTaskIds ? (
              <p className="mt-1 truncate text-[10px] text-slate-400">{row.taskId || row.id}</p>
            ) : null}
            <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2 text-[11px]">
              <div className="flex items-center gap-2">
                <PtUserAvatar name={row.assignedTo} initials={row.assigneeAvatar} />
                <div className="min-w-0">
                  <span className="block text-[10px] text-slate-400">Assignee</span>
                  <span className="truncate font-medium text-slate-700">{row.assignedTo || '—'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-slate-500">Start</span>
                <span className="font-medium text-slate-800">{row.startDate}</span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-slate-500">End</span>
                <div className="text-right">
                  <p className="font-medium text-slate-800">
                    {row.revisedEndDate ?? row.endDate}
                  </p>
                  {Number(row.delayDays) > 0 ? (
                    <p className="text-[10px] font-medium text-[#E53935]">+{row.delayDays}d delay</p>
                  ) : null}
                </div>
              </div>
              {row.revisedCount > 0 ? (
              <div className="flex items-center justify-between py-0.5">
                <span className="text-slate-500">Revised</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-[#FB8C00]">
                    <i className="ri-refresh-line text-[10px]" />
                    {row.revisedCount}×
                  </span>
              </div>
              ) : null}
              {nestedMode && childSubtasks.length > 0 ? (
                <p className="pt-0.5 text-[11px] font-semibold text-[#FB8C00]">
                  {childSubtasks.length} subtask{childSubtasks.length === 1 ? '' : 's'} ›
                </p>
              ) : null}
            </div>
          </button>
          {showNested && isExpanded ? (
            <div className="space-y-1.5 border-t border-slate-200/70 bg-slate-100/60 px-2.5 py-2.5">
              {childSubtasks.length === 0 ? (
                <p className="text-[11px] text-[#7F8C8D]">No subtasks yet.</p>
              ) : (
                childSubtasks.map((sub) => (
                  <SubtaskAccordionRow
                    key={sub.id}
                    sub={sub}
                    compact
                    onClick={() => openNestedSubtask(sub)}
                    statusSlot={(
                      <span className="inline-flex items-center gap-2">
                        <StatusBadge status={sub.status} />
                        <CompletedStatusUpdate status={sub.status} onUpdate={() => openNestedSubtask(sub)} />
                      </span>
                    )}
                  />
                ))
              )}
              {canAddSubtask ? (
                <button
                  type="button"
                  onClick={() => onCreateSubtask(row)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#1E88E5]/30 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1E88E5]"
                >
                  <i className="ri-add-line" aria-hidden />
                  Add subtask
                </button>
              ) : null}
      </div>
          ) : null}
          </div>
          );
        })}
      </div>

      <TablePaginationBar total={total} page={safePage} onPageChange={setPage} />
    </div>
  );
}


/** --- Delay / revision --- */
function DelayRevisionSection({ data, onRowClick, insightFilter = null }) {
  const [search, setSearch] = useState('');
  const [ragFilter, setRagFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // all | delayed | revised | both
  const [nameFilter, setNameFilter] = useState('all');
  const [sortKey, setSortKey] = useState('delayDays');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [delaySheetOpen, setDelaySheetOpen] = useState(false);
  const [draftDelayRag, setDraftDelayRag] = useState('all');
  const [draftDelayType, setDraftDelayType] = useState('all');
  const [draftDelayName, setDraftDelayName] = useState('all');

  useEffect(() => {
    if (!insightFilter?.token) return;
    if (insightFilter.type != null) {
      setTypeFilter(insightFilter.type);
      setRagFilter('all');
      setNameFilter('all');
      setSearch('');
    }
  }, [insightFilter?.token, insightFilter?.type]);

  const delayed = useMemo(() => {
    const base = data.filter((p) => p.delayDays > 0 || p.revisedCount > 0);
    return base.filter((p) => {
      if (nameFilter !== 'all' && p.name !== nameFilter) return false;
      if (ragFilter !== 'all' && p.rag !== ragFilter) return false;
      if (typeFilter === 'delayed') {
        if (!(p.delayDays > 0) || isClosedProjectStatus(p.status)) return false;
      }
      if (typeFilter === 'revised' && !(p.revisedCount > 0)) return false;
      if (typeFilter === 'both' && !(p.delayDays > 0 && p.revisedCount > 0)) return false;
      if (search) {
        const hay = `${p.name || ''} ${p.id || ''}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, ragFilter, typeFilter, search, nameFilter]);

  const sortedDelayed = useMemo(() => {
    const copy = [...delayed];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return compareText(a.name, b.name, dir);
        case 'plannedEndDate':
          return compareDateValue(a.plannedEndDate ?? a.originalEndDate, b.plannedEndDate ?? b.originalEndDate, dir, sortDir);
        case 'revisedEndDate':
          return compareDateValue(
            a.revisedEndDate,
            b.revisedEndDate,
            dir,
            sortDir,
          );
        case 'delayDays':
          return compareNumber(a.delayDays, b.delayDays, dir);
        case 'revisedCount':
          return compareNumber(a.revisedCount, b.revisedCount, dir);
        case 'rag':
          return compareNumber(ragRank(a.rag), ragRank(b.rag), dir);
        default:
          return 0;
      }
    });
    return copy;
  }, [delayed, sortKey, sortDir]);

  const total = sortedDelayed.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sortedDelayed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, ragFilter, typeFilter, nameFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSort = (key) => {
    const next = toggleSortState(sortKey, sortDir, key);
    setSortKey(next.sortKey);
    setSortDir(next.sortDir);
  };

  const affectedBase = useMemo(() => data.filter((p) => p.delayDays > 0 || p.revisedCount > 0), [data]);
  const nameOptions = useMemo(
    () => distinctFilterOptions(affectedBase, (d) => d.name, { allLabel: 'All Projects' }),
    [affectedBase],
  );
  const ragOptions = [
    { value: 'all', label: 'All RAG' },
    { value: 'Red', label: '🔴 Red' },
    { value: 'Amber', label: '🟡 Amber' },
    { value: 'Green', label: '🟢 Green' },
  ];

  const DELAY_COLUMNS = [
    { key: 'name', label: 'Project', filter: 'name' },
    { key: 'plannedEndDate', label: 'Planned End Date' },
    { key: 'revisedEndDate', label: 'Latest Revised Date' },
    { key: 'delayDays', label: 'Delay Days' },
    { key: 'revisedCount', label: 'Revisions' },
    { key: 'rag', label: 'Risk', filter: 'rag' },
  ];

  const columnFilterProps = {
    name: { filterValue: nameFilter, onFilterChange: setNameFilter, filterOptions: nameOptions },
    rag: { filterValue: ragFilter, onFilterChange: setRagFilter, filterOptions: ragOptions },
  };

  const delayTypeOptions = [
    { value: 'all', label: 'All' },
    { value: 'delayed', label: 'Delayed only' },
    { value: 'revised', label: 'Revised only' },
    { value: 'both', label: 'Delayed + revised' },
  ];

  const delayFilterCount = [ragFilter, typeFilter, nameFilter].filter((v) => v && v !== 'all').length;

  const openDelayFilterSheet = () => {
    setDraftDelayRag(ragFilter);
    setDraftDelayType(typeFilter);
    setDraftDelayName(nameFilter);
    setDelaySheetOpen(true);
  };

  const applyDelayFilters = () => {
    setRagFilter(draftDelayRag);
    setTypeFilter(draftDelayType);
    setNameFilter(draftDelayName);
    setDelaySheetOpen(false);
  };

  const clearDelayFilters = () => {
    setRagFilter('all');
    setTypeFilter('all');
    setNameFilter('all');
    setDraftDelayRag('all');
    setDraftDelayType('all');
    setDraftDelayName('all');
    setDelaySheetOpen(false);
  };

  const delayChips = [
    ragFilter !== 'all' ? { key: 'rag', label: ragFilter, onRemove: () => setRagFilter('all') } : null,
    typeFilter !== 'all'
      ? {
          key: 'type',
          label: delayTypeOptions.find((o) => o.value === typeFilter)?.label || typeFilter,
          onRemove: () => setTypeFilter('all'),
        }
      : null,
    nameFilter !== 'all' ? { key: 'name', label: nameFilter, onRemove: () => setNameFilter('all') } : null,
  ].filter(Boolean);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm lg:rounded-3xl lg:border-white/80 lg:bg-white/95 lg:shadow-lg lg:shadow-slate-200/40 lg:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-2 border-b border-slate-100 bg-gradient-to-r from-rose-50/60 to-white px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-center lg:text-left">
          <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Delay &amp; Revision Tracker</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
            {total} affected
            {totalPages > 1 ? ` · ${PAGE_SIZE} per page` : ''}
            {' · tap a row for details'}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto lg:justify-end">
          <div className="relative w-full sm:w-44 lg:w-44">
            <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#7F8C8D]" />
            <input
              type="text"
              placeholder="Search project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs shadow-sm outline-none focus:border-indigo-500 lg:rounded-2xl"
            />
          </div>

          <div className="flex w-full gap-2 lg:hidden">
            <MobileFiltersButton count={delayFilterCount} onClick={openDelayFilterSheet} />
            <span className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-red-50 px-3 text-[11px] font-semibold text-[#E53935]">
              <i className="ri-alarm-warning-line" aria-hidden />
              {total}
            </span>
          </div>
          <div className="lg:hidden">
            <MobileActiveFilterChips chips={delayChips} />
          </div>

          <div className="hidden snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 lg:flex lg:justify-end [&::-webkit-scrollbar]:hidden">
            <PtSelect
              value={ragFilter}
              onChange={(e) => setRagFilter(e.target.value)}
              className="min-w-[7.5rem] shrink-0"
              aria-label="Filter by RAG"
              options={ragOptions}
            />
            <PtSelect
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="min-w-[8rem] shrink-0"
              aria-label="Filter by delay type"
              options={delayTypeOptions}
            />
            <span className="inline-flex items-center justify-center gap-1.5 self-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold text-[#E53935] sm:self-auto sm:text-xs">
              <i className="ri-alarm-warning-line" aria-hidden />
              {total} affected
            </span>
          </div>
        </div>
      </div>

      <MobileFilterSheet
        open={delaySheetOpen}
        title="Delay filters"
        onClose={() => setDelaySheetOpen(false)}
        onClear={clearDelayFilters}
        onApply={applyDelayFilters}
      >
        <MobileFilterField label="RAG">
          <PtSelect
            value={draftDelayRag}
            onChange={(e) => setDraftDelayRag(e.target.value)}
            className="w-full"
            aria-label="Filter by RAG"
            options={ragOptions}
          />
        </MobileFilterField>
        <MobileFilterField label="Type">
          <PtSelect
            value={draftDelayType}
            onChange={(e) => setDraftDelayType(e.target.value)}
            className="w-full"
            aria-label="Filter by delay type"
            options={delayTypeOptions}
          />
        </MobileFilterField>
        <MobileFilterField label="Project">
          <PtSelect
            value={draftDelayName}
            onChange={(e) => setDraftDelayName(e.target.value)}
            className="w-full"
            aria-label="Filter by project"
            options={nameOptions}
          />
        </MobileFilterField>
      </MobileFilterSheet>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {DELAY_COLUMNS.map((col) => {
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
            {pageRows.map((row) => {
              const isDelayed = row.delayDays > 0;
              const hasRevision = Boolean(row.hasRevision && row.revisedEndDate);
              return (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className="cursor-pointer border-b border-slate-100 transition-all hover:bg-blue-50/50"
                  style={{ height: '56px' }}
                >
                  <td className="px-5 py-3">
                    <p className="text-sm font-semibold text-[#2C3E50]">{row.name}</p>
                    <p className="text-xs text-[#7F8C8D]">{row.id}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-[#2C3E50]">{row.plannedEndDate || row.originalEndDate || '—'}</span>
                  </td>
                  <td className="px-5 py-3">
                    {hasRevision ? (
                      <span className="text-sm font-medium text-[#FB8C00]">
                        {row.revisedEndDate}
                        <span className="ml-1 text-xs text-[#FB8C00]">(revised)</span>
                    </span>
                    ) : (
                      <span className="text-xs font-medium text-[#7F8C8D]">Not revised</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {isDelayed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-[#E53935]">
                        <i className="ri-time-line" aria-hidden />+{row.delayDays} days
                      </span>
                    ) : (
                      <span className="text-xs text-[#7F8C8D]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {row.revisedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#FB8C00]">
                        <i className="ri-refresh-line" aria-hidden />
                        {row.revisedCount} revision{row.revisedCount > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-[#7F8C8D]">No revisions</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <RagPill rag={row.rag} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2.5 p-2.5 sm:space-y-3 sm:p-3 lg:hidden">
        {pageRows.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">No delayed projects</div>
        )}
        {pageRows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onRowClick?.(row)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm ring-1 ring-slate-100 transition hover:bg-blue-50/40 sm:rounded-2xl sm:p-4"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{row.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{row.id}</p>
              </div>
              <RagPill rag={row.rag} />
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px]">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Planned</span>
                <span className="font-medium text-slate-800">{row.plannedEndDate || row.originalEndDate || '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Latest</span>
                {row.hasRevision && row.revisedEndDate ? (
                  <span className="font-medium text-[#FB8C00]">{row.revisedEndDate}</span>
                ) : (
                  <span className="font-medium text-slate-500">Not revised</span>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Delay</span>
                {row.delayDays > 0 ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-[#E53935]">+{row.delayDays}d</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Revisions</span>
                <span className="font-medium text-slate-800">{row.revisedCount}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <TablePaginationBar total={total} page={safePage} onPageChange={setPage} />
    </div>
  );
}


/** --- Project drill-down (inline accordion panel) --- */

function ProjectDrillDownPanel({
  project,
  allTasks,
  allProcessSubtasks,
  onOpenTaskPopup,
  onOpenSubtaskPopup,
  onCreateTaskPopup,
  onCreateSubtask,
  onRefreshTasks,
  refreshingTasks = false,
}) {
  const [activeTab, setActiveTab] = useState('subtasks');
  const [creatingTask, setCreatingTask] = useState(false);

  useEffect(() => {
    setActiveTab('subtasks');
  }, [project?.id]);

  const rows = Array.isArray(allTasks) ? allTasks : [];
  const linkedTasks = getTasksLinkedToProject(project, rows);
  const canCreateTask = typeof onCreateTaskPopup === 'function' && !isProjectClosed(project?.status);

  if (!project) return null;

  const p = project;
  const revisionHistory = Array.isArray(p.revisionHistory) ? p.revisionHistory : [];
  const revisedCount = p.revisedCount ?? revisionHistory.length;

  const tabs = [
    { key: 'subtasks', label: `Tasks (${linkedTasks.length})`, icon: 'ri-list-check-3' },
    { key: 'revisions', label: `Revisions (${revisedCount})`, icon: 'ri-history-line' },
  ];

  return (
    <div className="flex min-h-0 flex-col bg-transparent">
      {/* Mobile segmented control */}
      <div className="shrink-0 p-3 lg:hidden">
        <div className="grid grid-cols-2 gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-[#E8F0FE] text-[#1E62F0]'
                  : 'text-slate-600'
              }`}
            >
              <i className={tab.icon} aria-hidden />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop underline tabs */}
      <div className="hidden shrink-0 gap-1 overflow-x-auto border-b border-gray-100 bg-white px-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-4 lg:flex [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex min-h-[2.5rem] shrink-0 snap-start cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-all sm:px-4 sm:py-3 sm:text-sm ${activeTab === tab.key
              ? 'border-[#1E88E5] text-[#1E88E5]'
              : 'border-transparent text-[#7F8C8D] hover:text-[#2C3E50]'
              }`}
          >
            <i className={tab.icon} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 p-3 sm:p-6 lg:overflow-y-auto">
        {activeTab === 'subtasks' && (
          <div className="space-y-3">
            <SubtaskTable
              data={linkedTasks}
              onOpenPopup={onOpenTaskPopup}
              onOpenSubtaskPopup={onOpenSubtaskPopup}
              hideTitle
              compact
              nestedMode
              hideProjectFilter
              allProcessSubtasks={allProcessSubtasks}
              onCreateSubtask={onCreateSubtask}
              onRefresh={onRefreshTasks}
              refreshing={refreshingTasks}
              countLabel={(n) => `${n} task${n === 1 ? '' : 's'} assigned to this project`}
              headerActions={
                canCreateTask ? (
                <button
                  type="button"
                  disabled={creatingTask}
                  onClick={async () => {
                    if (creatingTask || typeof onCreateTaskPopup !== 'function') return;
                    setCreatingTask(true);
                    try {
                      await onCreateTaskPopup(project);
                    } finally {
                      setCreatingTask(false);
                    }
                  }}
                  className="inline-flex w-full min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1E88E5] px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:rounded-2xl sm:text-xs lg:w-auto"
                >
                  <i className="ri-add-line" aria-hidden />
                  {creatingTask ? 'Creating…' : 'Create task'}
                </button>
                ) : null
              }
            />
          </div>
        )}

        {activeTab === 'revisions' && (
          <div>
            {(!p.hasRevision || revisionHistory.length <= 1) && (!p.activityHistory || p.activityHistory.length === 0) ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <i className="ri-history-line text-3xl text-gray-300" />
                <p className="text-sm text-[#7F8C8D]">No revisions recorded</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute bottom-0 left-5 top-0 w-px bg-gray-200" />
                <div className="space-y-4">
                  {(p.hasRevision ? revisionHistory.slice(1) : []).map((rev, idx) => (
                    <div key={rev.key ?? idx} className="relative pl-12">
                      <div
                        className="absolute left-3.5 top-3 h-3 w-3 rounded-full border-2 border-white bg-[#FB8C00]"
                        style={{ boxShadow: '0 0 0 2px #FB8C00' }}
                      />
                      <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#FB8C00]">Revision #{idx + 1}</span>
                          <span className="text-xs text-[#7F8C8D]">{rev.revisedBy || 'System'}</span>
                        </div>
                        <p className="mb-2 text-xs text-slate-600">
                          Updated on: <span className="font-medium text-slate-800">{rev.date || '—'}</span>
                        </p>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-[#7F8C8D]">
                            Previous end date:{' '}
                            <span className="font-medium line-through">{rev.previousEndDate || '—'}</span>
                          </span>
                          <i className="ri-arrow-right-line text-xs text-[#FB8C00]" aria-hidden />
                          <span className="text-xs font-semibold text-[#FB8C00]">
                            Updated end date: {rev.newEndDate || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(p.activityHistory) && p.activityHistory.length > 0 ? (
              <div className="mt-6">
                <h4 className="mb-3 text-sm font-semibold text-[#2C3E50]">Activity History</h4>
                <div className="space-y-3">
                  {p.activityHistory.map((act) => (
                    <div key={act.key} className="rounded-xl border border-gray-100 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-[#2C3E50]">
                          {act.eventType} - {act.field}
                        </p>
                        <span className="text-xs text-[#7F8C8D]">{act.date || 'N/A'}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#7F8C8D]">
                        By: {act.by}
                        {act.status ? ` | Status: ${act.status}` : ''}
                      </p>
                      {(act.oldValue || act.newValue) && (
                        <p className="mt-1 text-xs text-[#2C3E50]">
                          {act.oldValue ? String(act.oldValue) : 'N/A'} → {act.newValue ? String(act.newValue) : 'N/A'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}


/** --- Main dashboard (from page-premium) --- */

const NAV_ITEMS = [
  { key: 'kpi', label: 'Analytics', icon: 'ri-layout-grid-line' },
  { key: 'rag', label: 'Health Monitor', icon: 'ri-speed-line' },
  { key: 'health', label: 'Projects', icon: 'ri-folder-3-line' },
  { key: 'subtasks', label: 'Tasks', icon: 'ri-checkbox-line' },
  { key: 'delay', label: 'Timeline', icon: 'ri-time-line' },
];
/** Soft, floaty spring — "jelly" motion when the active tab moves */
const JELLY_SPRING = {
  type: 'spring',
  stiffness: 115,
  damping: 13,
  mass: 1.05,
};
function DashboardPagePremium({
  useLayout = true,
  scopeToCurrentUser = false,
  /** 'all' = full dashboard; 'projects' | 'tasks' = user hub slices */
  contentView = 'all',
  /** When set, replaces scoped task rows (user hub process APIs). */
  overrideTasks = null,
  overrideTasksLoading = false,
  /** User hub — full ownership-scope tasks for insight / health cards (not status-tab filtered). */
  overrideTasksForMetrics = null,
  overrideTasksForMetricsLoading = false,
  /** Hide Me / My Team toggle (user hub uses Project / Task instead). */
  hideUserScopeToggle = false,
  /** Extra controls rendered before dimension filters in the header. */
  toolbarPrefix = null,
  /** Renders above the task table (user hub — LeadsManagementPage-style tabs). */
  taskTableToolbar = null,
  /** Hide greeting header (user hub renders its own welcome card). */
  hideWelcomeHeader = false,
  /** Explicit Kissflow user for scoping (fetched profile from hub). */
  scopeUser = null,
  /** User hub: limit projects to Project Owner match only. */
  projectsScopeOwnerOnly = false,
  /** Skip outer page shell when nested inside UserHubPage. */
  embeddedInHub = false,
  /** Hide Company / Business Functions / Function Type dimension filters. */
  hideCompanyFunctionFilters = false,
  /** User hub welcome card props — rendered inline with dimension filters. */
  hubWelcome = null,
  /** User hub — open create popup from table toolbar (no row params). */
  onCreateProjectRecord = null,
  onCreateTaskRecord = null,
  /** When set, row click opens Kissflow popup instead of detail modal (UserHub only). */
  onOpenProjectRow = null,
  onOpenTaskRow = null,
  /** UserHubTasks only — nested subtask open/create uses Popup_WbcLURdUXx. */
  onOpenSubtaskRow = null,
  taskBulkSelectEnabled = false,
  taskSelectedRowIds = null,
  onTaskToggleRowSelect = null,
  onTaskToggleAllRowsSelect = null,
  getTaskRowSelectId = null,
}) {
  const { kf: kfFromContext, identityReady } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null) ?? (typeof kf !== 'undefined' ? kf : null);
  const [userName, setUserName] = useState('User');
  const [roleName, setRoleName] = useState('Admin');
  const [activeSection, setActiveSection] = useState('kpi');
  const [apiProjectData, setApiProjectData] = useState(() => {
    try {
      const email = String(JSON.parse(localStorage.getItem('iam_user') || 'null')?.email || '').trim().toLowerCase()
      if (!email) return []
      const snap = JSON.parse(sessionStorage.getItem(`pm:snap:projects:${email}`) || 'null')
      return Array.isArray(snap?.rows) ? snap.rows : []
    } catch {
      return []
    }
  });
  const [apiSubtaskData, setApiSubtaskData] = useState([]);
  const [apiProcessSubtaskData, setApiProcessSubtaskData] = useState([]);
  const [refreshingTasks, setRefreshingTasks] = useState(false);
  /** User dashboard only: Me = my work, My Team = manager report (same as UserSpecificPT). */
  const [userViewScope, setUserViewScope] = useState('Me');
  const [selectedTeamMember, setSelectedTeamMember] = useState('');
  /** Admin dashboard — filter entire portfolio by owner / assignee. */
  const [portfolioUserFilter, setPortfolioUserFilter] = useState('');
  const [myTeamProjects, setMyTeamProjects] = useState([]);
  const [myTeamTasks, setMyTeamTasks] = useState([]);
  const [myTeamProjectsLoading, setMyTeamProjectsLoading] = useState(false);
  const [myTeamTasksLoading, setMyTeamTasksLoading] = useState(false);
  const [myTeamError, setMyTeamError] = useState(null);
  const [dimensionFilters, setDimensionFilters] = useState(() => {
    const emptyPeriod = getEmptyPeriodState();
    return {
      company: '',
      department: '',
      lineOfBusiness: '',
      functionType: '',
      periodMode: emptyPeriod.mode,
      periodFrom: emptyPeriod.range.from,
      periodTo: emptyPeriod.range.to,
      periodLabel: emptyPeriod.summaryLabel,
      periodRanges: [],
      periodParts: [],
      periodFyStartYear: null,
      createdYear: '',
      createdPeriod: '',
    };
  });
  const [detailModal, setDetailModal] = useState(null);
  const [insightFocus, setInsightFocus] = useState(null);
  const sectionRefs = useRef({});
  const headerRef = useRef(null);
  const insightPulseTimerRef = useRef(null);
  const isDesktopLg = useIsDesktopLg();

  const userEmail = String(scopeUser?.Email || scopeUser?.email || kfInstance?.user?.Email || '').trim();
  const userId = String(scopeUser?._id || scopeUser?.Id || kfInstance?.user?._id || kfInstance?.user?.Id || '').trim();
  const scopingUser = scopeUser || kfInstance?.user;
  const isMyTeamView = scopeToCurrentUser && userViewScope === 'My Team';
  /** User Hub tasks: table rows come from myitems/pending/participated — skip heavy report portfolio. */
  const lightHubTasksMode =
    Boolean(embeddedInHub) && contentView === 'tasks' && overrideTasks != null;

  const dashboardFetchKey = [
    contentView,
    lightHubTasksMode ? 'hub-tasks' : 'full',
    userEmail.toLowerCase(),
    scopeToCurrentUser ? 'scoped' : 'all',
    identityReady ? 'ready' : 'wait',
  ].join('|');
  const lastDashboardFetchKeyRef = useRef('');

  const reloadDashboardData = useCallback(async () => {
    if (!kfInstance?.api) return;
    if (scopeToCurrentUser && !identityReady) return;
    if (scopeToCurrentUser && !userEmail) return;
    if (lastDashboardFetchKeyRef.current === dashboardFetchKey) return;
    lastDashboardFetchKeyRef.current = dashboardFetchKey;

    const loadProjects = contentView === 'all' || contentView === 'projects';
    const loadTasks = contentView === 'all' || contentView === 'tasks';
    const loadProcessSubtasks = contentView === 'all' || contentView === 'tasks';

    // Hub tasks already load the email-scoped task list in UserHubTasksPage.
    // Skip the extra full Sub_Task_Process_A00 walk on this tab.
    if (lightHubTasksMode) {
      setApiProjectData([]);
      setApiSubtaskData([]);
      return;
    }

    let projectsRes = { status: 'fulfilled', value: null };
    let subtasksRes = { status: 'fulfilled', value: null };
    let processSubtasksRes = { status: 'fulfilled', value: null };
    if (loadProjects) {
      try {
        const projectData = scopeToCurrentUser
          ? await fetchEmployeeDashboardProjects(kfInstance, { email: userEmail })
          : await fetchProjectDashboardData(kfInstance);
        projectsRes = { status: 'fulfilled', value: projectData };
      } catch (error) {
        projectsRes = { status: 'rejected', reason: error };
      }
    }
    if (loadTasks) {
      try {
        subtasksRes = { status: 'fulfilled', value: await fetchSubtaskTrackerData(kfInstance) };
      } catch (error) {
        subtasksRes = { status: 'rejected', reason: error };
      }
    }
    if (loadProcessSubtasks) {
      try {
        processSubtasksRes = { status: 'fulfilled', value: await fetchAllSubtasks(kfInstance) };
      } catch (error) {
        processSubtasksRes = { status: 'rejected', reason: error };
      }
    }

    const rows = projectsRes.status === 'fulfilled' ? (projectsRes.value?.rows ?? []) : [];
    const subtasks =
      subtasksRes.status === 'fulfilled'
        ? (subtasksRes.value ?? [])
        : (projectsRes.status === 'fulfilled' ? (projectsRes.value?.subtasks ?? []) : []);
    const processSubtasks =
      processSubtasksRes.status === 'fulfilled'
        ? (processSubtasksRes.value?.items ?? []).map(mapProcessSubtaskItem)
        : [];

    setApiProjectData(loadProjects ? rows : []);
    setApiSubtaskData(loadTasks ? subtasks : []);
    setApiProcessSubtaskData(loadProcessSubtasks ? processSubtasks : []);
  }, [kfInstance, lightHubTasksMode, scopeToCurrentUser, userEmail, identityReady, contentView, dashboardFetchKey]);

  const handleOpenTaskDetail = useCallback((row) => {
    if (!row) return false;
    if (typeof onOpenTaskRow === 'function') {
      const opened = onOpenTaskRow(row, kfInstance);
      if (opened !== false) return true;
    }
    requestOpenTaskDetails(taskRowToFormDefaults(row));
    return true;
  }, [onOpenTaskRow, kfInstance]);

  const handleOpenSubtaskDetail = useCallback((row) => {
    if (!row) return false;
    if (typeof onOpenSubtaskRow === 'function') {
      const opened = onOpenSubtaskRow(row, kfInstance);
      if (opened !== false) return true;
    }
    requestOpenSubtaskDetails(subtaskRowToFormDefaults(row));
    return true;
  }, [onOpenSubtaskRow, kfInstance]);

  const handleOpenProjectDetail = useCallback((row) => {
    if (!row) return false;
    if (typeof onOpenProjectRow === 'function') {
      return onOpenProjectRow(row, kfInstance) !== false;
    }
    setDetailModal({ type: 'project', row });
    return true;
  }, [onOpenProjectRow, kfInstance]);

  const handleOpenDelayDetail = useCallback((row) => {
    if (!row) return;
    setDetailModal({ type: 'project', row });
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setDetailModal(null);
  }, []);

  const handleRefreshTasks = useCallback(async () => {
    setRefreshingTasks(true);
    try {
      await reloadDashboardData();
      return true;
    } catch (error) {
      console.warn('Refresh tasks failed:', error);
      return false;
    } finally {
      setRefreshingTasks(false);
    }
  }, [reloadDashboardData]);

  const handleCreateTaskForProject = useCallback(
    async (project) => {
      if (isProjectClosed(project?.status)) {
      const sdk = kfInstance ?? ((typeof kf !== 'undefined' ? kf : null) ?? (typeof window !== 'undefined' ? window.kf : null));
        sdk?.client?.showInfo?.('Cannot add a task to a closed project.');
        return false;
      }

      const sdk = kfInstance ?? ((typeof kf !== 'undefined' ? kf : null) ?? (typeof window !== 'undefined' ? window.kf : null));
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
          projectId,
          projectName: project?.name || project?.projectName || '',
        })
        return true
      }

      const lockKey = `proj-${project?.id ?? projectId}`;
      if (dashboardRowCreateLock.has(lockKey)) return false;

      dashboardRowCreateLock.add(lockKey);
      try {
        const created = await createTaskInstance(sdk, projectId);
        if (created?.webhookOnly) {
          sdk?.client?.showInfo?.('Task sent to the Kissflow integration.');
          return true;
        }
        void openTaskDraft(sdk, created.instanceId, created.activityInstanceId)
          .then(() => reloadDashboardData())
          .catch((openError) => {
            console.warn('Open task draft failed:', openError);
            sdk?.client?.showInfo?.(openError?.message || 'Failed to open task form.');
          });
        return true;
      } catch (error) {
        console.warn('Create task failed:', error);
        sdk?.client?.showInfo?.(error?.message || 'Failed to create task.');
        return false;
      } finally {
        dashboardRowCreateLock.delete(lockKey);
      }
    },
    [kfInstance, reloadDashboardData],
  );

  const handleCreateSubtaskForTask = useCallback(
    async (taskRow) => {
      if (isTaskCompleted(taskRow?.status)) {
        const sdk = kfInstance ?? ((typeof kf !== 'undefined' ? kf : null) ?? (typeof window !== 'undefined' ? window.kf : null));
        sdk?.client?.showInfo?.('Cannot add a subtask to a completed task.');
        return false;
      }

      const sdk = kfInstance ?? ((typeof kf !== 'undefined' ? kf : null) ?? (typeof window !== 'undefined' ? window.kf : null));
      if (!sdk) {
        console.warn('Create subtask: Kissflow SDK not available');
        return false;
      }

      // Hub myitems/pending often omit Subtaxk_id — resolve or fetch once from instance.
      const taskId = await ensureTaskBusinessIdForCreate(sdk, taskRow);
      const fallbackTaskId = String(taskRow?.taskId || taskRow?.id || taskRow?.InstanceID || '').trim();
      const resolvedTaskId = taskId || fallbackTaskId;
      if (!resolvedTaskId) {
        sdk?.client?.showInfo?.('Missing task id on this row (expected e.g. Task-PRJ-...).');
        return false;
      }

      if (typeof sdk?.app?.page?.openPopup !== 'function') {
        requestOpenSubtaskDetails({
          taskId: resolvedTaskId,
          taskName: taskRow?.taskName || '',
          projectName: taskRow?.projectName || '',
          projectId: taskRow?.projectId || '',
        })
        return true
      }

      const lockKey = `task-${taskRow?.id ?? taskId}`;
      if (dashboardRowCreateLock.has(lockKey)) return false;

      dashboardRowCreateLock.add(lockKey);
      try {
        const created = await createSubtaskInstance(sdk, taskId);
        if (created?.webhookOnly) {
          sdk?.client?.showInfo?.('Subtask sent to the Kissflow integration.');
          return true;
        }
        const draftRow = {
          InstanceID: created.instanceId,
          ActivityID: created.activityInstanceId,
          id: created.instanceId,
          _id: created.instanceId,
          _activity_instance_id: created.activityInstanceId,
        };

        // UserHubTasks: Popup_WbcLURdUXx; elsewhere: process openForm.
        if (typeof onOpenSubtaskRow === 'function') {
          const opened = onOpenSubtaskRow(draftRow, kfInstance);
          if (opened === false) {
            sdk?.client?.showInfo?.('Subtask created but the form could not be opened.');
          }
          void reloadDashboardData();
          return true;
        }

        void openSubtaskDraft(sdk, created.instanceId, created.activityInstanceId)
          .then(() => reloadDashboardData())
          .catch((openError) => {
            console.warn('Open subtask draft failed:', openError);
            sdk?.client?.showInfo?.(openError?.message || 'Failed to open subtask form.');
          });
        return true;
      } catch (error) {
        console.warn('Create subtask failed:', error);
        sdk?.client?.showInfo?.(error?.message || 'Failed to create subtask.');
        return false;
      } finally {
        dashboardRowCreateLock.delete(lockKey);
      }
    },
    [kfInstance, reloadDashboardData, onOpenSubtaskRow],
  );

  /** Offset by sticky header height so section titles aren't hidden under the bar */
  const scrollToSection = useCallback((key) => {
    setActiveSection(key);
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

  useEffect(() => {
    const user = scopeUser || kfInstance?.user;
    if (!user) return;
    const resolvedName = String(user.Name || user.FirstName || 'User').trim();
    const resolvedRole = resolveRoleName(user.Role || user.Roles?.[0] || 'Admin');
    if (resolvedName) setUserName(resolvedName);
    if (resolvedRole) setRoleName(resolvedRole);
  }, [kfInstance, scopeUser]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        await reloadDashboardData();
      } catch (error) {
        if (!cancelled) {
          console.warn('Project items fetch failed:', error?.message || error);
          setApiProjectData([]);
          setApiSubtaskData([]);
          setApiProcessSubtaskData([]);
        }
      }
    }
    run();
    return () => { cancelled = true; };
  }, [reloadDashboardData]);

  // User dashboard → My Team projects (same report as UserSpecificPT).
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isMyTeamView) return;
      if (!scopingUser) return;
      if (scopingUser._external) {
        setMyTeamProjects([]);
        setMyTeamProjectsLoading(false);
        return;
      }

      const cacheKey = `userDashboard:myTeamProjects:v2:${String(userEmail || userId || 'me').toLowerCase()}`;
      let hasCache = false;
      try {
        const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
        if (Array.isArray(cached) && cached.length > 0) {
          setMyTeamProjects(cached);
          hasCache = true;
        }
      } catch { /* ignore */ }

      if (!hasCache) setMyTeamProjectsLoading(true);
      setMyTeamError(null);
      try {
        const { projects } = await fetchMyTeamProjects(kfInstance, { loggedInEmail: userEmail });
        if (cancelled) return;
        setMyTeamProjects(projects);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(projects));
        } catch { /* ignore */ }
      } catch (e) {
        console.warn('UserDashboard: My Team projects failed', e);
        if (!cancelled) {
          setMyTeamError(e?.message || 'Failed to load My Team projects');
          if (!hasCache) setMyTeamProjects([]);
        }
      } finally {
        if (!cancelled) setMyTeamProjectsLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [isMyTeamView, kfInstance, userEmail, userId]);

  // User dashboard → My Team tasks (same report as UserSpecificPT).
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isMyTeamView) return;
      if (!scopingUser) return;
      if (scopingUser._external) {
        setMyTeamTasks([]);
        setMyTeamTasksLoading(false);
        return;
      }
      if (myTeamProjectsLoading) return;

      const allowedProjectIds = new Set();
      (Array.isArray(myTeamProjects) ? myTeamProjects : []).forEach((p) => {
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

      const cacheKey = `userDashboard:myTeamTasks:v3:${String(userEmail || userId || 'me').toLowerCase()}`;
      let hasCache = false;
      try {
        const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
        if (Array.isArray(cached) && cached.length > 0) {
          const me = String(userEmail || '').trim().toLowerCase();
          const byEmail = filterTasksByManagerEmail(cached, me);
          const byProject = filterTasksByAllowedProjects(cached, allowedProjectIds);
          const seen = new Set();
          const scoped = [];
          for (const row of [...byEmail, ...byProject]) {
            const key = String(row?.id || row?.InstanceID || '').trim();
            if (key && seen.has(key)) continue;
            if (key) seen.add(key);
            scoped.push(row);
          }
          setMyTeamTasks(scoped);
          hasCache = scoped.length > 0;
        }
      } catch { /* ignore */ }

      if (!hasCache) setMyTeamTasksLoading(true);
      setMyTeamError(null);
      try {
        const { tasks } = await fetchMyTeamTasks(kfInstance, {
          loggedInEmail: userEmail,
          allowedProjectIds,
        });
        if (cancelled) return;
        setMyTeamTasks(tasks);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(tasks));
        } catch { /* ignore */ }
      } catch (e) {
        console.warn('UserDashboard: My Team tasks failed', e);
        if (!cancelled) {
          setMyTeamError(e?.message || 'Failed to load My Team tasks');
          if (!hasCache) setMyTeamTasks([]);
        }
      } finally {
        if (!cancelled) setMyTeamTasksLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [isMyTeamView, kfInstance, userEmail, userId, myTeamProjects, myTeamProjectsLoading]);

  /** Full portfolio vs Me / My Team slice — same UI, different base rows. */
  const scopedPortfolio = useMemo(() => {
    if (!scopeToCurrentUser) {
      return {
        projects: Array.isArray(apiProjectData) ? apiProjectData : [],
        tasks: apiSubtaskData,
        processSubtasks: apiProcessSubtaskData,
      };
    }

    if (userViewScope === 'My Team') {
      let projects = (Array.isArray(myTeamProjects) ? myTeamProjects : [])
        .map(mapMyTeamProjectToDashboardRow)
        .filter(Boolean);
      let tasks = (Array.isArray(myTeamTasks) ? myTeamTasks : [])
        .map(mapMyTeamTaskToDashboardRow)
        .filter(Boolean);

      const member = String(selectedTeamMember || '').trim();
      if (member) {
        projects = projects.filter((p) => String(p.owner || '').trim() === member);
        tasks = tasks.filter((t) => String(t.assignedTo || '').trim() === member);
      }

      return {
        projects,
        tasks,
        processSubtasks: filterProcessSubtasksByTaskKeys(apiProcessSubtaskData, tasks),
      };
    }

    const scoped = scopeDashboardDataToCurrentUser(
      apiProjectData,
      apiSubtaskData,
      apiProcessSubtaskData,
      scopingUser,
      { ownerOnlyProjects: projectsScopeOwnerOnly },
    );
    /** Projects already match login email === externlemail from externalreport_A00. */
    return {
      ...scoped,
      projects: Array.isArray(apiProjectData) ? apiProjectData : [],
    };
  }, [
    scopeToCurrentUser,
    userViewScope,
    selectedTeamMember,
    apiProjectData,
    apiSubtaskData,
    apiProcessSubtaskData,
    scopingUser,
    projectsScopeOwnerOnly,
    myTeamProjects,
    myTeamTasks,
  ]);

  /** My Team member list from report rows (owners + assignees), same idea as UserSpecificPT. */
  const teamMembers = useMemo(() => {
    if (!isMyTeamView) return [];
    const unique = new Map();
    const bump = (name, id = '', email = '') => {
      const n = String(name || '').trim();
      if (!n || n === '—') return;
      const key = String(id || '').trim() || n.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, { name: n, id: String(id || '').trim(), email: String(email || '').trim() });
      }
    };
    (Array.isArray(myTeamProjects) ? myTeamProjects : []).forEach((p) => {
      bump(p?.owner, p?.ownerId, p?.ownerEmail);
    });
    (Array.isArray(myTeamTasks) ? myTeamTasks : []).forEach((t) => {
      bump(t?.assignee, t?.assigneeId, t?.assigneeEmail);
    });
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [isMyTeamView, myTeamProjects, myTeamTasks]);

  const showPortfolioUserFilter = !isMyTeamView && !(scopeToCurrentUser && userViewScope === 'Me');

  useEffect(() => {
    if (!isMyTeamView) {
      if (selectedTeamMember) setSelectedTeamMember('');
      return;
    }
    if (!selectedTeamMember) return;
    const allowed = new Set(teamMembers.map((m) => m.name));
    if (!allowed.has(selectedTeamMember)) setSelectedTeamMember('');
  }, [isMyTeamView, teamMembers, selectedTeamMember]);

  /** Dimension options from full scoped portfolio (not narrowed by User). */
  const filterOptions = useMemo(
    () => {
      const projects = scopedPortfolio.projects;
      const itProjects = projects.filter((p) => isInformationTechnologyCategory(p.lineOfBusiness));
      return {
        company: collectUniqueFieldValues(projects, 'companyName'),
        department: collectUniqueFieldValues(projects, 'department'),
        lineOfBusiness: collectUniqueFieldValues(projects, 'lineOfBusiness'),
        functionType: collectUniqueFieldValues(itProjects, 'functionType'),
        createdYear: buildCreatedYearOptions(projects),
      };
    },
    [scopedPortfolio.projects],
  );

  /** Apply company / function / year first — User options and User filter hang off this set. */
  const dimensionFilteredProjects = useMemo(
    () => filterProjectsByDimensions(scopedPortfolio.projects, dimensionFilters),
    [scopedPortfolio.projects, dimensionFilters],
  );

  const effectiveTaskRows = useMemo(() => {
    if (overrideTasks != null) return Array.isArray(overrideTasks) ? overrideTasks : [];
    return scopedPortfolio.tasks;
  }, [overrideTasks, scopedPortfolio.tasks]);

  const dimensionFilteredTasks = useMemo(
    () =>
      overrideTasks != null
        ? effectiveTaskRows
        : filterTasksByProjects(effectiveTaskRows, dimensionFilteredProjects, dimensionFilters),
    [overrideTasks, effectiveTaskRows, dimensionFilteredProjects, dimensionFilters],
  );

  const dimensionFilteredProcessSubtasks = useMemo(
    () => filterProcessSubtasksByTasks(scopedPortfolio.processSubtasks, dimensionFilteredTasks, dimensionFilters),
    [scopedPortfolio.processSubtasks, dimensionFilteredTasks, dimensionFilters],
  );

  /** Owners + assignees only from dimension-filtered projects/tasks. */
  const portfolioUsers = useMemo(() => {
    if (!showPortfolioUserFilter) return [];
    return collectPortfolioUsers(dimensionFilteredProjects, dimensionFilteredTasks);
  }, [showPortfolioUserFilter, dimensionFilteredProjects, dimensionFilteredTasks]);

  useEffect(() => {
    if (!showPortfolioUserFilter) {
      if (portfolioUserFilter) setPortfolioUserFilter('');
      return;
    }
    if (!portfolioUserFilter) return;
    const allowed = new Set(portfolioUsers.map((m) => m.name));
    if (!allowed.has(portfolioUserFilter)) setPortfolioUserFilter('');
  }, [showPortfolioUserFilter, portfolioUsers, portfolioUserFilter]);

  const userFilteredPortfolio = useMemo(() => {
    const base = {
      projects: dimensionFilteredProjects,
      tasks: dimensionFilteredTasks,
      processSubtasks: dimensionFilteredProcessSubtasks,
    };
    if (!showPortfolioUserFilter || !portfolioUserFilter) return base;
    const member = portfolioUsers.find((m) => m.name === portfolioUserFilter);
    if (!member) return base;
    return filterPortfolioByUser(base.projects, base.tasks, base.processSubtasks, member);
  }, [
    showPortfolioUserFilter,
    portfolioUserFilter,
    portfolioUsers,
    dimensionFilteredProjects,
    dimensionFilteredTasks,
    dimensionFilteredProcessSubtasks,
  ]);

  const filteredSubtaskData = userFilteredPortfolio.tasks;

  const effectiveMetricsTaskRows = useMemo(() => {
    if (overrideTasksForMetrics != null) {
      return Array.isArray(overrideTasksForMetrics) ? overrideTasksForMetrics : [];
    }
    return effectiveTaskRows;
  }, [overrideTasksForMetrics, effectiveTaskRows]);

  const taskRowsForMetricsSource = overrideTasksForMetrics != null
    ? effectiveMetricsTaskRows
    : filteredSubtaskData;
  const taskRowsForMetricsLoading = overrideTasksForMetrics != null
    ? Boolean(overrideTasksForMetricsLoading) && effectiveMetricsTaskRows.length === 0
    : overrideTasksLoading;

  const filteredProjectData = useMemo(
    () =>
      userFilteredPortfolio.projects.map((project) => {
        const progressTaskSource = isMyTeamView
          ? scopedPortfolio.tasks
          : scopeToCurrentUser
            ? apiSubtaskData
            : filteredSubtaskData;
        const progressFields = computeProjectProgressFromTasks(
          project,
          // Me: progress from full task list on the project. My Team: team report tasks.
          progressTaskSource,
        );
        const effectiveEnd = resolveEffectiveProjectEndDate(
          project.revisedEndDate,
          project.originalEndDate || project.plannedEndDate,
        );
        const delayDays = computeProjectDelayDays(project.status, effectiveEnd);
        const rag = computeProjectRag({
          status: project.status,
          delayDays,
          progress: progressFields.progress,
          startDate: project.startDate,
          endDate: effectiveEnd,
        });
        return {
          ...project,
          ...progressFields,
          delayDays,
          rag,
        };
      }),
    [
      userFilteredPortfolio.projects,
      filteredSubtaskData,
      scopeToCurrentUser,
      isMyTeamView,
      apiSubtaskData,
      scopedPortfolio.tasks,
    ],
  );

  const filteredProcessSubtaskData = userFilteredPortfolio.processSubtasks;

  /**
   * Nested accordion pool for the main tasks table.
   * Hub override tasks (myitems/pending) are not the report task set, so re-key
   * process subtasks against the rows actually shown in the table.
   */
  const nestedProcessSubtasksForTable = useMemo(() => {
    if (overrideTasks != null) {
      return filterProcessSubtasksByTaskKeys(apiProcessSubtaskData, filteredSubtaskData);
    }
    return filteredProcessSubtaskData;
  }, [overrideTasks, apiProcessSubtaskData, filteredSubtaskData, filteredProcessSubtaskData]);

  const hasActiveFilters = hasActiveDimensionFilters(dimensionFilters) || Boolean(portfolioUserFilter);

  const handleDimensionFilterChange = useCallback((key, value) => {
    setDimensionFilters((prev) => {
      if (key === 'period') {
        const nextPeriod = value && typeof value === 'object' ? value : getEmptyPeriodState();
        return {
          ...prev,
          periodMode: nextPeriod.mode || 'all',
          periodFrom: nextPeriod.range?.from || '',
          periodTo: nextPeriod.range?.to || '',
          periodLabel: nextPeriod.summaryLabel || 'All time',
          periodRanges: Array.isArray(nextPeriod.ranges) ? nextPeriod.ranges : [],
          periodParts: Array.isArray(nextPeriod.parts) ? nextPeriod.parts : [],
          periodFyStartYear: Number.isFinite(Number(nextPeriod.fyStartYear))
            ? Number(nextPeriod.fyStartYear)
            : null,
          // Clear legacy year/period selects when using the adaptive picker.
          createdYear: '',
          createdPeriod: '',
        };
      }
      const next = { ...prev, [key]: value };
      if (key === 'lineOfBusiness' && !isInformationTechnologyCategory(value)) {
        next.functionType = '';
      }
      if (key === 'createdYear') {
        next.createdPeriod = '';
      }
      return next;
    });
  }, []);

  const handleClearDimensionFilters = useCallback(() => {
    const emptyPeriod = getEmptyPeriodState();
    setPortfolioUserFilter('');
    setDimensionFilters({
      company: '',
      department: '',
      lineOfBusiness: '',
      functionType: '',
      periodMode: emptyPeriod.mode,
      periodFrom: emptyPeriod.range.from,
      periodTo: emptyPeriod.range.to,
      periodLabel: emptyPeriod.summaryLabel,
      periodRanges: [],
      periodParts: [],
      periodFyStartYear: null,
      createdYear: '',
      createdPeriod: '',
    });
  }, []);

  const portfolioUserSelectOptions = showPortfolioUserFilter
    ? [
        {
          value: '',
          label: portfolioUsers.length > 0 ? `All Users (${portfolioUsers.length})` : 'All Users',
        },
        ...portfolioUsers.map((m) => ({
          value: m.name,
          label: m.name,
        })),
      ]
    : null;

  const portfolioUserFilterControl = showPortfolioUserFilter ? (
    <label className="flex min-w-[11rem] shrink-0 snap-start flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">User</span>
      <PtSelect
        value={portfolioUserFilter}
        onChange={(e) => setPortfolioUserFilter(e.target.value)}
        leadingIcon="ri-user-line"
        aria-label="Filter by user"
        className="w-full sm:min-w-[12rem]"
        triggerClassName="text-xs sm:text-sm py-2 h-auto min-h-[2.25rem]"
        options={portfolioUserSelectOptions}
      />
    </label>
  ) : null;

  const dimensionFilterExtraProps = {
    portfolioUserFilter,
    onPortfolioUserChange: showPortfolioUserFilter ? setPortfolioUserFilter : null,
    portfolioUserOptions: portfolioUserSelectOptions,
    hideCompanyFunctionFilters,
  };

  const totalProjects = filteredProjectData.length;
  const activeProjects = filteredProjectData.filter((p) => !isProjectClosed(p.status)).length;
  const completedProjects = filteredProjectData.filter((p) => isProjectClosed(p.status)).length;
  const delayedProjects = filteredProjectData.filter((p) => p.delayDays > 0 && !isProjectClosed(p.status)).length;
  const taskRowsForMetrics = taskRowsForMetricsLoading ? [] : taskRowsForMetricsSource;
  const totalSubtasks = taskRowsForMetrics.length;
  const completedTasks = taskRowsForMetrics.filter((t) => isTaskCompleted(t.status)).length;
  const overdueTasks = taskRowsForMetrics.filter(
    (t) => String(t.status || '').trim() === 'Overdue' || Boolean(t.isOverdue),
  ).length;
  const openTasks = Math.max(0, totalSubtasks - completedTasks);
  const totalProjectsTrend = computeQuarterOverQuarterTrend(filteredProjectData);

  const kpiMetrics = {
    totalProjects, activeProjects, completedProjects, delayedProjects,
    totalSubtasks, openTasks, completedTasks, overdueTasks,
    trendTotalProjects: totalProjectsTrend.label,
    trendTotalProjectsPositive: totalProjectsTrend.positive,
    trendActiveProjects: `${Math.round((activeProjects / Math.max(totalProjects, 1)) * 100)}% of total`,
    trendCompletedProjects: `${Math.round((completedProjects / Math.max(totalProjects, 1)) * 100)}% completion rate`,
    trendDelayedProjects: `${Math.round((delayedProjects / Math.max(totalProjects, 1)) * 100)}% at risk`,
  };
  const content = (
    <div className={embeddedInHub ? 'min-w-0 overflow-x-clip' : 'overflow-x-clip bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff]'}>
      <div className={embeddedInHub ? 'min-w-0' : 'p-3 pb-6 sm:p-6'}>
        {!hideWelcomeHeader ? (
        <motion.header
          ref={headerRef}
          data-dashboard-header
          className="sticky top-0 z-30 -mx-3 mb-3 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-3 pb-2.5 pt-2 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.2)] backdrop-blur-md sm:-mx-6 sm:mb-5 sm:px-6 sm:pb-4 sm:pt-3"
          initial={{ opacity: 0, y: isDesktopLg ? -12 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            isDesktopLg
              ? { type: 'spring', stiffness: 220, damping: 26 }
              : { duration: 0.2 }
          }
        >
          <div className="mx-auto flex max-w-[1800px] flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="min-w-0 shrink text-center lg:w-auto lg:py-0.5 lg:text-left">
              <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl md:text-3xl">
                {getGreetingText()}, <span className="font-semibold text-slate-900">{userName}</span>
              </h1>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 lg:text-sm">
                {contentView === 'projects' ? (
                  <>
                    Your projects · <span className="text-slate-600">{roleName}</span>
                  </>
                ) : contentView === 'tasks' ? (
                  <>
                    Your tasks · <span className="text-slate-600">{roleName}</span>
                  </>
                ) : scopeToCurrentUser ? (
                  <>
                    {isMyTeamView ? 'My Team workspace' : 'Your workspace'} ·{' '}
                    <span className="text-slate-600">{roleName}</span>
                  </>
                ) : (
                  <>
                Logged in as <span className="text-slate-600">{roleName}</span>
                  </>
                )}
              </p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2 lg:items-end">
              <DashboardDimensionFilters
                filters={dimensionFilters}
                options={filterOptions}
                onChange={handleDimensionFilterChange}
                onClear={handleClearDimensionFilters}
                hasActiveFilters={hasActiveFilters}
                {...dimensionFilterExtraProps}
                prefix={
                  <>
                    {toolbarPrefix}
                    {scopeToCurrentUser && !hideUserScopeToggle ? (
                    <div className="flex w-full flex-col gap-2 lg:contents">
                      <label className="flex w-full shrink-0 flex-col gap-1 lg:w-max lg:snap-start">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">View</span>
                        <div className="inline-flex h-10 w-full items-stretch rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm lg:h-9 lg:w-auto">
                          {['Me', 'My Team'].map((x) => (
                            <button
                              key={x}
                              type="button"
                              onClick={() => {
                                setUserViewScope(x);
                                if (x === 'Me') setSelectedTeamMember('');
                              }}
                              className={`min-h-[36px] flex-1 whitespace-nowrap rounded-lg px-3.5 text-[11px] font-semibold transition-all lg:flex-none ${
                                userViewScope === x
                                  ? 'bg-[#1E62F0] text-white shadow-sm'
                                  : 'bg-transparent text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {x}
                            </button>
                          ))}
                        </div>
                      </label>

                      {isMyTeamView ? (
                        <label className="flex w-full min-w-0 shrink-0 flex-col gap-1 lg:min-w-[11rem] lg:snap-start">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Team Member
                          </span>
                          {myTeamProjectsLoading || myTeamTasksLoading ? (
                            <div className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm">
                              <i className="ri-loader-4-line animate-spin" aria-hidden />
                              Loading…
                            </div>
                          ) : myTeamError && teamMembers.length === 0 ? (
                            <div className="inline-flex min-h-[2.25rem] max-w-full items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-3 text-[11px] font-semibold text-rose-700 shadow-sm lg:max-w-[14rem]">
                              <i className="ri-error-warning-line shrink-0" aria-hidden />
                              <span className="truncate">Unable to load team</span>
                            </div>
                          ) : (
                            <PtSelect
                              value={selectedTeamMember}
                              onChange={(e) => setSelectedTeamMember(e.target.value)}
                              leadingIcon="ri-team-line"
                              aria-label="Filter by team member"
                              className="w-full lg:min-w-[12rem]"
                              triggerClassName="text-xs sm:text-sm py-2 h-auto min-h-[2.25rem]"
                              options={[
                                {
                                  value: '',
                                  label:
                                    teamMembers.length > 0
                                      ? `All Members (${teamMembers.length})`
                                      : 'No team members',
                                },
                                ...teamMembers.map((m) => ({
                                  value: m.name,
                                  label: m.name,
                                })),
                              ]}
                            />
                          )}
                        </label>
                      ) : null}
                    </div>
                    ) : null}
                  </>
                }
                suffix={portfolioUserFilterControl}
              />
            </div>
            {/* Dashboard section tab bar temporarily hidden per request.
            <nav className="min-w-0 shrink-0 lg:max-w-none" aria-label="Dashboard sections">
              <LayoutGroup>
                <div className="mx-auto w-full max-w-full rounded-xl border border-slate-200/90 bg-white/95 p-0.5 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.18)] backdrop-blur-sm lg:w-max lg:rounded-2xl lg:p-1.5">
                  <div className="flex w-full snap-x snap-mandatory items-stretch justify-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] lg:inline-flex lg:w-auto lg:snap-none lg:flex-wrap lg:justify-end [&::-webkit-scrollbar]:hidden">
                    {NAV_ITEMS.map((item) => {
                      const isActive = activeSection === item.key;
                      return (
                        <motion.button
                          key={item.key}
                          type="button"
                          onClick={() => scrollToSection(item.key)}
                          whileHover={{ y: -2, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
                          whileTap={{
                            scale: 0.94,
                            transition: { type: 'spring', stiffness: 500, damping: 22 },
                          }}
                          className={`relative inline-flex min-h-[2.35rem] shrink-0 snap-center items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold leading-tight sm:px-3 sm:text-xs lg:min-h-0 lg:gap-2 lg:rounded-xl lg:px-4 lg:py-2.5 lg:text-sm ${
                            isActive ? 'text-white' : 'text-slate-600'
                          }`}
                        >
                          {isActive ? (
                            <motion.span
                              layoutId="dashboard-nav-active-pill"
                              className="absolute inset-0 z-0 rounded-lg bg-[#0f172a] shadow-[0_4px_14px_-4px_rgba(15,23,42,0.55)] lg:rounded-xl"
                              transition={JELLY_SPRING}
                              style={{ borderRadius: 14 }}
                            />
                          ) : null}
                          <span className="relative z-10 flex max-w-[5.5rem] flex-col items-center gap-0.5 sm:max-w-none sm:flex-row sm:gap-2">
                            <motion.span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs lg:h-7 lg:w-7 lg:rounded-lg lg:text-base"
                              animate={
                                isActive
                                  ? { scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] }
                                  : { scale: 1, rotate: 0 }
                              }
                              transition={
                                isActive
                                  ? { duration: 0.65, ease: [0.34, 1.56, 0.64, 1] }
                                  : { duration: 0.2 }
                              }
                            >
                              <i className={item.icon} aria-hidden />
                            </motion.span>
                            <span className="line-clamp-2 text-center sm:line-clamp-none lg:text-left">{item.label}</span>
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </LayoutGroup>
            </nav>
            */}
          </div>
        </motion.header>
        ) : hubWelcome ? (
          <div ref={headerRef} className="mb-4 sm:mb-5">
            <div className="mx-auto flex max-w-[1800px] flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
              <UserHubWelcome {...hubWelcome} className="mb-0 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2 lg:items-end">
                <DashboardDimensionFilters
                  filters={dimensionFilters}
                  options={filterOptions}
                  onChange={handleDimensionFilterChange}
                  onClear={handleClearDimensionFilters}
                  hasActiveFilters={hasActiveFilters}
                  {...dimensionFilterExtraProps}
                  prefix={toolbarPrefix}
                  suffix={portfolioUserFilterControl}
                />
              </div>
            </div>
          </div>
        ) : (
          <div ref={headerRef} className="mb-3 flex justify-end">
            <DashboardDimensionFilters
              filters={dimensionFilters}
              options={filterOptions}
              onChange={handleDimensionFilterChange}
              onClear={handleClearDimensionFilters}
              hasActiveFilters={hasActiveFilters}
              {...dimensionFilterExtraProps}
              prefix={toolbarPrefix}
              suffix={portfolioUserFilterControl}
            />
          </div>
        )}

        <div className="space-y-4 lg:space-y-6">
          {(contentView === 'all' || contentView === 'projects') && (
          <motion.section
            ref={(el) => { sectionRefs.current.kpi = el; }}
            id="kpi"
            className="scroll-mt-24 lg:scroll-mt-32"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-1.5 px-0.5 sm:mb-3">
              <h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">Project Insights</h2>
            </div>
            <KPISection metrics={kpiMetrics} onKpiClick={handleKpiClick} activeKey={insightFocus?.key} group="projects" />
          </motion.section>
          )}

          {(contentView === 'all' || contentView === 'projects') && (
          <motion.section
            ref={(el) => { sectionRefs.current.rag = el; }}
            id="rag"
            className="scroll-mt-24 lg:scroll-mt-32"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="mb-1.5 px-0.5 sm:mb-3">
              <h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">Project Health Monitor</h2>
            </div>
            <RAGSummaryBar
              data={filteredProjectData}
              onCardClick={handleKpiClick}
              activeKey={insightFocus?.key}
            />
          </motion.section>
          )}

          {(contentView === 'all' || contentView === 'tasks') && (
          <motion.section
            ref={(el) => { sectionRefs.current['task-kpi'] = el; }}
            id="task-kpi"
            className="scroll-mt-24 lg:scroll-mt-32"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <div className="mb-1.5 px-0.5 sm:mb-3">
              <h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">Task Insights</h2>
            </div>
            {taskRowsForMetricsLoading && overrideTasksForMetrics != null ? (
              <div className="flex min-h-[5rem] items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-6 text-sm font-medium text-slate-600">
                <i className="ri-loader-4-line mr-2 animate-spin text-lg" aria-hidden />
                Loading tasks…
              </div>
            ) : (
              <KPISection metrics={kpiMetrics} onKpiClick={handleKpiClick} activeKey={insightFocus?.key} group="tasks" />
            )}
          </motion.section>
          )}

          {(contentView === 'all' || contentView === 'tasks') && (
          <motion.section
            ref={(el) => { sectionRefs.current['task-rag'] = el; }}
            id="task-rag"
            className="scroll-mt-24 lg:scroll-mt-32"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="mb-1.5 px-0.5 sm:mb-3">
              <h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">Task Health Monitor</h2>
            </div>
            {taskRowsForMetricsLoading ? (
              <div className="flex min-h-[5rem] items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-6 text-sm font-medium text-slate-600">
                <i className="ri-loader-4-line mr-2 animate-spin text-lg" aria-hidden />
                Loading tasks…
              </div>
            ) : (
              <TaskHealthMonitorBar
                data={taskRowsForMetricsSource}
                onCardClick={handleKpiClick}
                activeKey={insightFocus?.key}
              />
            )}
          </motion.section>
          )}

          {(contentView === 'all' || contentView === 'projects') && (
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
            transition={{ delay: 0.12 }}
          >
            <ProjectHealthTable
              data={filteredProjectData}
              allTasks={filteredSubtaskData}
              allProcessSubtasks={filteredProcessSubtaskData}
              onOpenTaskPopup={handleOpenTaskDetail}
              onOpenSubtaskPopup={handleOpenSubtaskDetail}
              onOpenProjectPopup={handleOpenProjectDetail}
              onCreateTaskPopup={handleCreateTaskForProject}
              onCreateSubtask={handleCreateSubtaskForTask}
              onRefreshTasks={handleRefreshTasks}
              refreshingTasks={refreshingTasks}
              insightFilter={
                insightFocus?.section === 'health'
                  ? {
                      token: insightFocus.token,
                      status: insightFocus.projectStatus,
                      rag: insightFocus.projectRag,
                    }
                  : null
              }
              headerActions={
                typeof onCreateProjectRecord === 'function' ? (
                  <button
                    type="button"
                    onClick={() => onCreateProjectRecord()}
                    className="shrink-0 snap-start inline-flex items-center gap-2 rounded-2xl bg-[#1E88E5] px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-95 sm:text-xs"
                  >
                    <i className="ri-add-line" aria-hidden />
                    Create project
                  </button>
                ) : null
              }
            />
          </motion.section>
          )}

          {(contentView === 'all' || contentView === 'tasks') && (
          <motion.section
            ref={(el) => { sectionRefs.current.subtasks = el; }}
            id="subtasks"
            className={`scroll-mt-24 rounded-2xl transition-[box-shadow,ring] duration-500 lg:scroll-mt-32 lg:rounded-3xl ${
              insightFocus?.section === 'subtasks' && insightFocus?.pulse
                ? 'ring-2 ring-[#1E88E5] ring-offset-2 ring-offset-[#edf1ff] shadow-[0_0_0_6px_rgba(30,136,229,0.12)]'
                : ''
            }`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/50 shadow-sm backdrop-blur-sm lg:rounded-3xl">
              {taskTableToolbar ? (
                <div className="min-w-0 border-b border-slate-200/60 bg-gradient-to-r from-slate-50/70 to-white/40 px-3 py-3 sm:px-3 sm:py-3">
                  {taskTableToolbar}
                </div>
              ) : null}
              <div className="min-w-0">
                {overrideTasksLoading && !(Array.isArray(filteredSubtaskData) && filteredSubtaskData.length) ? (
                  <div className="flex min-h-[12rem] items-center justify-center bg-white/70 px-4 py-10 text-sm font-medium text-slate-600">
                    <i className="ri-loader-4-line mr-2 animate-spin text-lg" aria-hidden />
                    Loading tasks…
                  </div>
                ) : (
                  <SubtaskTable
                    data={filteredSubtaskData}
                    onOpenPopup={handleOpenTaskDetail}
                    onOpenSubtaskPopup={handleOpenSubtaskDetail}
                    nestedMode
                    allProcessSubtasks={nestedProcessSubtasksForTable}
                    onCreateSubtask={handleCreateSubtaskForTask}
                    bulkSelectEnabled={taskBulkSelectEnabled}
                    selectedRowIds={taskSelectedRowIds}
                    onToggleRowSelect={onTaskToggleRowSelect}
                    onToggleAllRowsSelect={onTaskToggleAllRowsSelect}
                    getRowSelectId={getTaskRowSelectId}
                    hideTaskIds={overrideTasks != null}
                    headerActions={
                      typeof onCreateTaskRecord === 'function' ? (
                        <button
                          type="button"
                          onClick={() => onCreateTaskRecord()}
                          className="shrink-0 snap-start inline-flex items-center gap-2 rounded-2xl bg-[#1E88E5] px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-95 sm:text-xs"
                        >
                          <i className="ri-add-line" aria-hidden />
                          Create task
                        </button>
                      ) : null
                    }
                    insightFilter={
                      insightFocus?.section === 'subtasks'
                        ? { token: insightFocus.token, status: insightFocus.taskStatus }
                        : null
                    }
                  />
                )}
              </div>
            </div>
          </motion.section>
          )}

          {contentView === 'all' && (
          <motion.section
            ref={(el) => { sectionRefs.current.delay = el; }}
            id="delay"
            className={`scroll-mt-24 rounded-2xl transition-[box-shadow,ring] duration-500 lg:scroll-mt-32 lg:rounded-3xl ${
              insightFocus?.section === 'delay' && insightFocus?.pulse
                ? 'ring-2 ring-[#1E88E5] ring-offset-2 ring-offset-[#edf1ff] shadow-[0_0_0_6px_rgba(30,136,229,0.12)]'
                : ''
            }`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <DelayRevisionSection
              data={filteredProjectData}
              onRowClick={handleOpenDelayDetail}
              insightFilter={
                insightFocus?.section === 'delay'
                  ? { token: insightFocus.token, type: insightFocus.delayType }
                  : null
              }
            />
          </motion.section>
          )}
        </div>

        <DashboardDetailModal
          detail={detailModal}
          onClose={handleCloseDetailModal}
          viewerName={userName}
          onOpenKissflowForm={typeof onOpenTaskRow === 'function' ? (row) => onOpenTaskRow(row, kfInstance) : null}
        />

      </div>
    </div>
  );
  if (!useLayout) return content;
  return <AppLayout>{content}</AppLayout>;
}

/**
 * Premium project dashboard — single file for Kissflow custom components (copy-paste friendly).
 * In the SPA, `DashboardPage.jsx` passes useLayout={true}; Kissflow embed uses default useLayout={false}.
 * Pass scopeToCurrentUser to limit portfolio to the logged-in user's projects & tasks (UserDashboardPage).
 */
export default function ProjectDashboardPage({
  useLayout = false,
  scopeToCurrentUser = false,
  contentView = 'all',
  overrideTasks = null,
  overrideTasksLoading = false,
  overrideTasksForMetrics = null,
  overrideTasksForMetricsLoading = false,
  hideUserScopeToggle = false,
  toolbarPrefix = null,
  taskTableToolbar = null,
  hideWelcomeHeader = false,
  scopeUser = null,
  projectsScopeOwnerOnly = false,
  embeddedInHub = false,
  hideCompanyFunctionFilters = false,
  hubWelcome = null,
  onCreateProjectRecord = null,
  onCreateTaskRecord = null,
  onOpenProjectRow = null,
  onOpenTaskRow = null,
  onOpenSubtaskRow = null,
  taskBulkSelectEnabled = false,
  taskSelectedRowIds = null,
  onTaskToggleRowSelect = null,
  onTaskToggleAllRowsSelect = null,
  getTaskRowSelectId = null,
}) {
  return (
    <DashboardPagePremium
      useLayout={useLayout}
      scopeToCurrentUser={scopeToCurrentUser}
      contentView={contentView}
      overrideTasks={overrideTasks}
      overrideTasksLoading={overrideTasksLoading}
      overrideTasksForMetrics={overrideTasksForMetrics}
      overrideTasksForMetricsLoading={overrideTasksForMetricsLoading}
      hideUserScopeToggle={hideUserScopeToggle}
      toolbarPrefix={toolbarPrefix}
      taskTableToolbar={taskTableToolbar}
      hideWelcomeHeader={hideWelcomeHeader}
      scopeUser={scopeUser}
      projectsScopeOwnerOnly={projectsScopeOwnerOnly}
      embeddedInHub={embeddedInHub}
      hideCompanyFunctionFilters={hideCompanyFunctionFilters}
      hubWelcome={hubWelcome}
      onCreateProjectRecord={onCreateProjectRecord}
      onCreateTaskRecord={onCreateTaskRecord}
      onOpenProjectRow={onOpenProjectRow}
      onOpenTaskRow={onOpenTaskRow}
      onOpenSubtaskRow={onOpenSubtaskRow}
      taskBulkSelectEnabled={taskBulkSelectEnabled}
      taskSelectedRowIds={taskSelectedRowIds}
      onTaskToggleRowSelect={onTaskToggleRowSelect}
      onTaskToggleAllRowsSelect={onTaskToggleAllRowsSelect}
      getTaskRowSelectId={getTaskRowSelectId}
    />
  );
}
