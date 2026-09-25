/** Kissflow Project Management case — shared list/detail mapping & fetch (CTO + employee dashboards). */

import { resolveKissflowAccountId, resolveKissflowOrigin, kfGetJson, runWithConcurrency, fetchAllPagedRows } from './kfRuntime.js';
import { cacheKey, getCachedOrLoad } from './kfListCache.js';

const DEFAULT_ACCOUNT_ID = 'AcCMptp3yqcn';
export const CASE_ID = 'Project_Management_A01';

export const BASE_URL = resolveKissflowOrigin();

function getAccountId(kfInstance) {
  return resolveKissflowAccountId(kfInstance, DEFAULT_ACCOUNT_ID);
}

function getFieldsPath(accountId) {
  return `/case/2/${accountId}/${CASE_ID}/fields`;
}

/** Prefer case /list (honors page_size). View list/items caps ~21/page and needs walking. */
function getProjectListPath(accountId, pageNumber = 1, pageSize = 500) {
  const pn = Math.max(1, Number(pageNumber) || 1);
  const ps = Math.max(1, Math.min(1000, Number(pageSize) || 500));
  return `/case/2/${accountId}/${CASE_ID}/list?page_number=${pn}&page_size=${ps}`;
}

function getProjectViewItemsPath(accountId, pageNumber = 1, pageSize = 100) {
  const pn = Math.max(1, Number(pageNumber) || 1);
  const ps = Math.max(1, Number(pageSize) || 100);
  return `/case/2/${accountId}/${CASE_ID}/view/Project_Management_A01_all/list/items?page_number=${pn}&page_size=${ps}`;
}

/** Load every project case item (view endpoint only returns ~21 without pagination). */
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

export function resolveRoleName(roleLike) {
  if (!roleLike) return '';
  if (typeof roleLike === 'string') return roleLike.trim();
  if (typeof roleLike === 'object') return String(roleLike.Name || roleLike.name || '').trim();
  return '';
}

export function getGreetingText() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function toInitials(name) {
  const txt = String(name || '').trim();
  if (!txt) return 'NA';
  const parts = txt.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || 'NA';
}

export function parseKfDate(dateLike) {
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
  const ymd = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const local = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return Number.isNaN(local.getTime()) ? null : local;
  }
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(d) {
  if (!d) return null;
  const local = d instanceof Date ? d : parseKfDate(d);
  if (!local) return null;
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function mapStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('complete') || s.includes('closed') || s === 'done') return 'Completed';
  if (s.includes('plan') || s.includes('new') || s.includes('notstart')) return 'Planning';
  if (s.includes('hold')) return 'On Hold';
  return 'Active';
}

const RAG_AT_RISK_WINDOW_DAYS = 14;
const RAG_PROGRESS_SLACK_PCT = 10;

export function isClosedProjectStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return s.includes('complete') || s.includes('closed') || s === 'done';
}

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

export function computeProjectDelayDays(status, endDateLike, now = new Date()) {
  if (isClosedProjectStatus(status)) return 0;
  return calendarDaysPast(endDateLike, now);
}

export function computeProjectRag({ status, delayDays, progress, startDate, endDate, now = new Date() }) {
  if (isClosedProjectStatus(status)) return 'Green';

  const overdueDays = Number(delayDays) > 0 ? Number(delayDays) : calendarDaysPast(endDate, now);
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

/** Prefer schedule over stale Kissflow RAG_Calculation labels. */
export function mapRag(value, delayDays, status) {
  if (isClosedProjectStatus(status)) return 'Green';
  if (Number(delayDays) > 0) return 'Red';
  const s = String(value || '').toLowerCase();
  if (s.includes('amber') || s.includes('yellow')) return 'Amber';
  // Ignore API "red" when the project is not past its end date.
  return 'Green';
}

/** Map internal RAG → UserSpecificPT / employee Health column labels. */
export function ragToHealthLabel(rag, status) {
  if (isClosedProjectStatus(status)) return 'Completed';
  if (rag === 'Amber') return 'At Risk';
  if (rag === 'Red') return 'Delayed';
  return 'On Track';
}

/**
 * Recompute delay / rag / health from schedule + progress (same rules as ProjectDashboardPage).
 * Safe to run on My Work and My Team project rows (including cached ones).
 */
export function enrichProjectScheduleHealth(project, now = new Date()) {
  if (!project || typeof project !== 'object') return project;

  const status = project.status;
  const progress = isClosedProjectStatus(status)
    ? 100
    : (Number.isFinite(Number(project.progress))
      ? Math.max(0, Math.min(100, Number(project.progress)))
      : 0);
  const end =
    project.revisedEndDate ||
    project.end ||
    project.originalEndDate ||
    project.dueDate ||
    project.plannedEndDate ||
    null;
  const start = project.startDate || project.start || null;
  const delayDays = computeProjectDelayDays(status, end, now);
  const rag = computeProjectRag({
    status,
    delayDays,
    progress,
    startDate: start,
    endDate: end,
    now,
  });

  return {
    ...project,
    progress,
    delayDays,
    delay: delayDays > 0 ? `+${delayDays}d` : 'On time',
    rag,
    health: ragToHealthLabel(rag, status),
  };
}

export function mapSubtaskStatus(raw, endDate) {
  const s = String(raw || '').trim().toLowerCase();
  const completed = s.includes('complete') || s.includes('closed') || s.includes('done');
  if (completed) return 'Completed';
  const due = parseKfDate(endDate);
  if (due && due < new Date()) return 'Overdue';
  if (s.includes('progress') || s.includes('review')) return 'In Progress';
  if (s.includes('overdue') || s.includes('delay')) return 'Overdue';
  return 'Pending';
}

export function pickDisplayRef(detail, item, subtasks, fallbackId) {
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

export function mapItemsToProjectRows(items, detailById, activityById, availableFieldIds) {
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
    const status = mapStatus(detail?._status_name || item?._status_name || detail?._category || item?._category || '');
    const dueDate = parseKfDate(detail?.End_Date || detail?.DueDate || item?.DueDate);
    const startDate = parseKfDate(detail?.Start_Date || detail?._start_date || item?._start_date || item?._created_at);
    const timeline = Array.isArray(detail?.['Table::Project_Timeline_History']) ? detail['Table::Project_Timeline_History'] : [];
    const activities = Array.isArray(activityById[id]) ? activityById[id] : [];
    const subtasks = Array.isArray(detail?.['Table::Project_Subtasks']) ? detail['Table::Project_Subtasks'] : [];
    const completedTasks = subtasks.filter((s) => mapSubtaskStatus(s?.Task_Status_1, s?.End_date_2) === 'Completed').length;
    const totalTasks = subtasks.length;
    const progressFromApi = Number(detail?.Project_Objectives ?? item?.Project_Objectives);
    const progress = isClosedProjectStatus(status)
      ? 100
      : Number.isFinite(progressFromApi)
        ? Math.max(0, Math.min(100, Math.round(progressFromApi)))
        : totalTasks > 0
          ? Math.round((completedTasks / totalTasks) * 100)
          : (status === 'Planning' ? 20 : 55);
    const latestRevisionDate = timeline.length > 0
      ? fmtDate(
        parseKfDate(
          timeline[timeline.length - 1]?.New_Revised_Date ||
          timeline[timeline.length - 1]?.Changed_on ||
          timeline[timeline.length - 1]?._created_at,
        ),
      )
      : null;
    const effectiveEndDate = parseKfDate(latestRevisionDate) || dueDate;
    const delayDays = computeProjectDelayDays(status, effectiveEndDate, now);
    const rag = computeProjectRag({
      status,
      delayDays,
      progress,
      startDate,
      endDate: effectiveEndDate,
      now,
    });
    const displayId = pickDisplayRef(detail, item, subtasks, id);
    const businessOwnerRef = extractPersonRef(detail?.Business_Owner, '');
    const sponsorRef = extractPersonRef(detail?.Sponsor, '');
    const projectOwnerRef = extractPersonRef(detail?.Project_Owner, ownerName);
    const cosOwnerRef = extractPersonRef(detail?.COS_Owner, '');
    const developerRef = extractPersonRef(detail?.Developer, '');
    const createdByRef = extractPersonRef(detail?._created_by || item?._created_by, '');
    return {
      id,
      displayId,
      name: hasField('Project_Name') ? (detail?.Project_Name || item?.Name || `Project ${id}`) : (item?.Name || `Project ${id}`),
      owner: ownerName,
      ownerId: ownerRef.id,
      ownerEmail: ownerRef.email,
      ownerAvatar: toInitials(ownerName),
      businessOwner: businessOwnerRef.name,
      businessOwnerId: businessOwnerRef.id,
      businessOwnerEmail: businessOwnerRef.email,
      sponsor: sponsorRef.name,
      sponsorId: sponsorRef.id,
      sponsorEmail: sponsorRef.email,
      projectOwner: projectOwnerRef.name,
      projectOwnerId: projectOwnerRef.id,
      projectOwnerEmail: projectOwnerRef.email,
      cosOwner: cosOwnerRef.name,
      cosOwnerId: cosOwnerRef.id,
      cosOwnerEmail: cosOwnerRef.email,
      developer: developerRef.name,
      developerId: developerRef.id,
      developerEmail: developerRef.email,
      createdBy: createdByRef.name,
      createdById: createdByRef.id,
      createdByEmail: createdByRef.email,
      companyName: (() => {
        const v = detail?.Company_Name;
        if (v == null || v === '') return '';
        if (typeof v === 'object') return String(v.Name || v.name || '').trim();
        return String(v).trim();
      })(),
      lineOfBusiness: (() => {
        const raw = hasField('Project_Category')
          ? (detail?.Project_Category || 'Project Management')
          : (detail?.Project_Category || 'Project Management');
        if (raw && typeof raw === 'object') return String(raw.Name || raw.name || 'Project Management').trim();
        return String(raw || 'Project Management').trim();
      })(),
      functionType: (() => {
        const v = detail?.Function_Type;
        if (v == null || v === '') return '';
        if (typeof v === 'object') return String(v.Name || v.name || '').trim();
        return String(v).trim();
      })(),
      department: hasField('Department') ? (detail?.Department || detail?.Project_Department || detail?.Department_1 || 'N/A') : (detail?.Department || detail?.Project_Department || detail?.Department_1 || 'N/A'),
      priority: detail?._priority_name || item?._priority_name || detail?.Priority_1 || 'Low',
      startDate: fmtDate(startDate),
      originalEndDate: fmtDate(dueDate),
      revisedEndDate: latestRevisionDate,
      revisedCount: timeline.length,
      progress,
      rag,
      status,
      delayDays,
      totalTasks,
      completedTasks,
      risk: hasField('Risk') ? (detail?.Risk || 'N/A') : 'N/A',
      governanceFrequency: hasField('Governance_Frequency') ? (detail?.Governance_Frequency || 'N/A') : 'N/A',
      entity: hasField('Entity') ? (detail?.Entity || 'N/A') : 'N/A',
      aiUsage: hasField('AI_Usage') ? Boolean(detail?.AI_Usage) : false,
      createdAt: fmtDate(parseKfDate(detail?._created_at || item?._created_at)),
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
      revisionHistory: timeline.map((rev, revIdx) => ({
        date: fmtDate(parseKfDate(rev?.Changed_on || rev?._created_at)),
        previousEndDate: 'N/A',
        newEndDate: fmtDate(parseKfDate(rev?.New_Revised_Date || rev?.Changed_on)),
        reason: 'Timeline updated',
        revisedBy: rev?._created_by?.Name || 'System',
        key: rev?._id || `${id}-REV-${revIdx + 1}`,
      })),
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

async function fetchJson(kfInstance, path) {
  return kfGetJson(kfInstance, path);
}

/** Loads project rows from the case list (2 calls). Does not fan out per-item detail GETs. */
export async function fetchProjectDashboardData(kfInstance) {
  const { rows } = await fetchProjectListSummary(kfInstance);
  return { rows, subtasks: rows.flatMap((r) => r.subtasks || []) };
}

/**
 * Fast path: fields + list only (2 API calls). Rows use list-item fields; detail/activity empty.
 * Use enrichProjectRows() for per-project detail when needed (employee dashboard).
 */
export async function fetchProjectListSummary(kfInstance) {
  if (!kfInstance?.api) {
    throw new Error('Kissflow SDK not ready — open this page inside Kissflow.');
  }

  const accountId = getAccountId(kfInstance);
  return getCachedOrLoad(cacheKey('projects-summary', accountId), async () => {
    const fieldsPath = getFieldsPath(accountId);
    const fieldsResponse = await fetchJson(kfInstance, fieldsPath);
    const listItems = await fetchAllProjectListItems(kfInstance, accountId);
    const fieldIds = new Set((Array.isArray(fieldsResponse) ? fieldsResponse : []).map((f) => f?.Id).filter(Boolean));
    const rows = mapItemsToProjectRows(listItems, {}, {}, fieldIds);
    return { rows, listItems, fieldIds, accountId };
  });
}

/** Detail + activity for one project (modal / background enrich). */
export async function fetchProjectItemEnrichment(kfInstance, itemId, accountId) {
  const acc = accountId || getAccountId(kfInstance);
  const [detailRes, activityRes] = await Promise.allSettled([
    fetchJson(kfInstance, `/case/2/${acc}/${CASE_ID}/${itemId}`),
    fetchJson(kfInstance, `/case/2/${acc}/${CASE_ID}/${itemId}/activity`),
  ]);

  return {
    detail: detailRes.status === 'fulfilled' ? detailRes.value : null,
    activity: activityRes.status === 'fulfilled' && Array.isArray(activityRes.value) ? activityRes.value : [],
  };
}

/** Fetch full rows for a subset of project ids (bounded concurrency). */
export async function enrichProjectRows(
  kfInstance,
  { listItems, itemIds, fieldIds, accountId, concurrency = 2 },
) {
  const listById = {};
  for (const item of listItems) {
    const id = item?._item_id || item?._id;
    if (id) listById[id] = item;
  }

  const enriched = await runWithConcurrency(itemIds, concurrency, async (id) => {
    const listItem = listById[id];
    if (!listItem) return null;

    const { detail, activity } = await fetchProjectItemEnrichment(kfInstance, id, accountId);
    if (!detail) return null;

    const detailById = { [id]: detail };
    const activityById = { [id]: activity };
    const [row] = mapItemsToProjectRows([listItem], detailById, activityById, fieldIds);
    return row ? { ...row, _enriched: true } : null;
  });

  return enriched.filter(Boolean);
}

/** Normalize Kissflow user field vs display name (assignee / owner). */
export function personMatches(user, displayName) {
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

/**
 * User hub / My Work ownership: Project Owner, Business Owner, Sponsor,
 * COS Owner, Developer, or creator.
 */
export function projectOwnedOrStewardedByUser(user, project) {
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
