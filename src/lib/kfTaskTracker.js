import { kfGetJson, kfMutateJson, fetchAllAdminProcessItems, runWithConcurrency, isKissflowRateLimited, isAuthError } from './kfRuntime.js';
import { buildPmProcessApiPaths } from './kfPmMyItemsPaths.js';
import { TASKS_ENTITY } from './pmMyItemsEntities.js';
import { reportAssigneeEmail, reportAssigneeName } from './kfUserField.js';

const DEFAULT_ACCOUNT_ID = 'AcCMptp3yqcn';
const TASK_PROCESS_ID = 'Project_Sub_Task_A01';
const TASK_DETAIL_CONCURRENCY = 2;

function dedupeTaskRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = String(row?.id ?? row?.taskId ?? '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function toInitials(name) {
  const txt = String(name || '').trim();
  if (!txt) return 'NA';
  const parts = txt.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || 'NA';
}

export function parseKfDate(dateLike) {
  if (!dateLike) return null;
  const cleaned = String(dateLike).replace(/\s+[A-Za-z_/]+$/, '');
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(d) {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export function isTaskCompleted(status) {
  const s = String(status || '').toLowerCase();
  return s.includes('complete') || s.includes('closed') || s.includes('done');
}

export function isTaskOverdue(task) {
  const s = String(task?.status || '').toLowerCase();
  return (task?.delayDays ?? 0) > 0 || s.includes('overdue');
}

/** RAG for task rows — mirrors project health semantics. */
export function mapTaskRag(task) {
  const s = String(task?.status || '').toLowerCase();
  if ((task?.delayDays ?? 0) > 0 || s.includes('overdue')) return 'Red';
  if (isTaskCompleted(s)) return 'Green';
  return 'Amber';
}

/** True for Kissflow process instance ids (Pk…), not business Task-PRJ-… ids. */
function isKissflowPkId(value) {
  const text = String(value ?? '').trim();
  return !text || text.startsWith('Pk') || text === '[object Object]';
}

/**
 * Pick first usable task business id (Task-PRJ-… / formulated), never Pk instance ids.
 * Accepts nested Kissflow lookup objects (e.g. Task_ID: { Subtaxk_id }).
 */
export function pickTaskBusinessId(...candidates) {
  for (const candidate of candidates) {
    if (candidate == null || candidate === '') continue;
    if (typeof candidate === 'object') {
      const nested = pickTaskBusinessId(
        candidate.Subtaxk_id,
        candidate.Task_ID_Formulated,
        candidate.Task_ID_Hidden,
        candidate.Project_Task_ID,
        candidate.Name,
        candidate._id,
      );
      if (nested) return nested;
      continue;
    }
    const text = String(candidate).trim();
    if (isKissflowPkId(text)) continue;
    return text;
  }
  return '';
}

export function resolveTaskBusinessIdFromRow(row) {
  const raw = row?.raw && typeof row.raw === 'object' ? row.raw : {};
  const nameLike = String(raw?.Name || row?.taskName || row?.name || '').trim();
  const nameAsId = /^Task[-_]/i.test(nameLike) ? nameLike : '';

  return pickTaskBusinessId(
    row?.taskBusinessId,
    row?.taskId,
    row?.id,
    raw?.Subtaxk_id,
    raw?.Task_ID_Formulated,
    raw?.Task_ID_Hidden,
    raw?.Project_Task_ID,
    raw?.Task_ID,
    row?.Task_ID,
    nameAsId,
  );
}

/**
 * Hub myitems/pending rows often omit Subtaxk_id. Resolve from row first; if missing,
 * fetch that one instance detail and read the business id — for Add subtask only.
 */
export async function ensureTaskBusinessIdForCreate(kfInstance, row) {
  const existing = resolveTaskBusinessIdFromRow(row);
  if (existing) return existing;

  const instanceId = String(
    row?.InstanceID || row?._id || row?.raw?._id || row?.raw?._item_id || '',
  ).trim();
  if (!instanceId || !kfInstance) return '';

  // Prefer admin item detail (same path for Open + Withdrawn; includes Subtaxk_id).
  const adminDetail = await fetchTaskAdminItemDetail(kfInstance, instanceId);
  if (adminDetail) {
    const fromAdmin = resolveTaskBusinessIdFromRow({
      raw: adminDetail,
      taskId: adminDetail?.Subtaxk_id || adminDetail?.Task_ID_Formulated,
      id: adminDetail?.Subtaxk_id || adminDetail?.Task_ID_Formulated,
    });
    if (fromAdmin) return fromAdmin;
  }

  const seed = {
    ...(row?.raw && typeof row.raw === 'object' ? row.raw : {}),
    _id: instanceId,
    _item_id: instanceId,
    _activity_instance_id:
      row?.ActivityID ||
      row?._activity_instance_id ||
      row?.raw?._activity_instance_id ||
      undefined,
  };
  delete seed['Table::Task_History'];

  const enriched = await enrichRawTaskRowsWithInstanceDetail(kfInstance, [seed], { maxRows: 1 });
  const detail = enriched?.[0];
  return resolveTaskBusinessIdFromRow({
    raw: detail,
    taskId: detail?.Subtaxk_id || detail?.Task_ID_Formulated,
    id: detail?.Subtaxk_id || detail?.Task_ID_Formulated,
  });
}

/** Normalize Kissflow `Table::Task_History` (array or single object). */
export function normalizeTaskHistory(raw) {
  const hist = raw?.['Table::Task_History'] ?? raw?.Task_History;
  if (hist == null) return [];
  return Array.isArray(hist) ? hist.filter(Boolean) : [hist];
}

/**
 * Task timeline revisions from `Table::Task_History` (`New_Timeline`, `Changed_on`).
 * Same semantics as project `deriveTimelineEndDates`:
 * - index 0 = baseline / planned end (not counted as a revision)
 * - length 1 → revisedCount 0 (no real revision yet)
 * - length 4 → revisedCount 3 (show 3x; history entries 1,2,3)
 */
export function deriveTaskRevisionFields(raw, originalEndDate = null) {
  const history = normalizeTaskHistory(raw)
    .map((rev) => {
      const changedAt = parseKfDate(rev?.Changed_on || rev?._modified_at || rev?._created_at);
      return {
        newDate: fmtDate(parseKfDate(rev?.New_Timeline || rev?.New_Revised_Date || rev?.Changed_on)),
        changedAt,
        revisedBy: rev?._created_by?.Name || rev?._modified_by?.Name || 'System',
        raw: rev,
      };
    })
    .filter((r) => r.newDate)
    .sort((a, b) => (a.changedAt?.getTime() || 0) - (b.changedAt?.getTime() || 0));

  const plannedEndDate = history[0]?.newDate ?? originalEndDate ?? null;

  if (history.length === 0) {
    return {
      revisedCount: 0,
      hasRevision: false,
      revisedEndDate: null,
      previousEndDate: originalEndDate || null,
      originalEndDate: originalEndDate || null,
      plannedEndDate: null,
      revisionHistory: [],
    };
  }

  if (history.length === 1) {
    return {
      revisedCount: 0,
      hasRevision: false,
      revisedEndDate: null,
      previousEndDate: plannedEndDate,
      originalEndDate: plannedEndDate || originalEndDate || null,
      plannedEndDate,
      revisionHistory: history.map((h, i) => ({
        date: fmtDate(h.changedAt),
        previousEndDate: originalEndDate || '—',
        newEndDate: h.newDate,
        reason: 'Baseline timeline',
        revisedBy: h.revisedBy,
        key: h.raw?._id || `TASK-REV-${i + 1}`,
      })),
    };
  }

  const revisedCount = history.length - 1;
  const revisedEndDate = history[history.length - 1].newDate;
  const previousEndDate = history[history.length - 2].newDate;

  return {
    revisedCount,
    hasRevision: true,
    revisedEndDate,
    previousEndDate,
    originalEndDate: plannedEndDate || originalEndDate || null,
    plannedEndDate,
    revisionHistory: history.map((h, i) => ({
      date: fmtDate(h.changedAt),
      previousEndDate: i > 0 ? history[i - 1].newDate : (originalEndDate || '—'),
      newEndDate: h.newDate,
      reason: i === 0 ? 'Baseline timeline' : 'Timeline updated',
      revisedBy: h.revisedBy,
      key: h.raw?._id || `TASK-REV-${i + 1}`,
    })),
  };
}

function activityInstanceIdOf(row) {
  const raw =
    row?._activity_instance_id ??
    row?.ActivityID ??
    row?.activityInstanceId ??
    row?._entity_id;
  if (Array.isArray(raw)) return String(raw[0] || '').trim();
  return String(raw || '').trim();
}

function unwrapInstanceDetail(response) {
  if (!response || typeof response !== 'object') return null;
  if (response.Data && typeof response.Data === 'object' && !Array.isArray(response.Data)) {
    return response.Data;
  }
  if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
    return response.data;
  }
  return response;
}

function displayish(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    return String(value.Name || value.name || value._id || '').trim();
  }
  return String(value).trim();
}

function rawRowNeedsInstanceEnrichment(row) {
  if (!row || typeof row !== 'object') return false;

  // List APIs omit history and often omit form fields used by the task detail popup.
  const hasHistory = Object.prototype.hasOwnProperty.call(row, 'Table::Task_History');
  const hasEntity = Boolean(displayish(row.Entity ?? row.Entity_1));
  const hasFunctions = Boolean(displayish(row.Functions ?? row.Function ?? row.Department));
  const hasTaskType = Boolean(displayish(row.Task_type ?? row.Task_Type ?? row.Type));
  const hasBusinessId = Boolean(
    displayish(row.Subtaxk_id || row.Task_ID_Formulated || row.Task_ID_Hidden),
  );

  if (!hasHistory) return true;
  if (!hasEntity || !hasFunctions || !hasTaskType) return true;
  if (!hasBusinessId) return true;
  return false;
}

/**
 * Prefer admin item detail (works for Open + Withdrawn / no activity):
 *   GET /process/2/{acc}/admin/Project_Sub_Task_A01/{instanceId}?_application_id=…
 *   Headers: X-Access-Key-Id / X-Access-Key-Secret
 *
 * Returns Entity, Functions, Task_type, Subtaxk_id, Table::Task_History for
 * Revised badges + custom task detail popup fields (dev + prod same path shape).
 *
 * Fallback: instance/activity path when admin detail is unavailable.
 */
export async function enrichRawTaskRowsWithInstanceDetail(kfInstance, rows, options = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length || !kfInstance) return list;

  const paths = buildPmProcessApiPaths(kfInstance, TASKS_ENTITY);
  if (!paths) return list;

  const maxRows = Math.max(0, Number(options.maxRows) || 80);
  const needIdx = [];
  list.forEach((row, idx) => {
    if (maxRows && needIdx.length >= maxRows) return;
    const id = String(row?._id || row?._item_id || row?.InstanceID || '').trim();
    if (id && rawRowNeedsInstanceEnrichment(row)) needIdx.push(idx);
  });
  if (!needIdx.length) return list;

  const details = await runWithConcurrency(needIdx, TASK_DETAIL_CONCURRENCY, async (idx) => {
    const row = list[idx];
    const id = String(row?._id || row?._item_id || row?.InstanceID || '').trim();
    const act = activityInstanceIdOf(row);
    const adminDetailPath =
      typeof paths.getAdminItemDetailPath === 'function'
        ? paths.getAdminItemDetailPath(id)
        : `${paths.itemBase}/${encodeURIComponent(id)}?_application_id=${encodeURIComponent(paths.applicationId || '')}`;

    /** @type {{ path: string, useAccessKeys?: boolean }[]} */
    const tryCalls = [];

    // 1) Admin item detail — reliable for Withdrawn / completed (no activity id) + form fields.
    tryCalls.push({ path: adminDetailPath, useAccessKeys: true });
    tryCalls.push({ path: adminDetailPath, useAccessKeys: false });

    // 2) Instance + activity (Postman open-step shape) when activity is present.
    if (act) {
      tryCalls.push({
        path: `/process/2/${paths.accountId}/${paths.processId}/${encodeURIComponent(id)}/${encodeURIComponent(act)}`,
        useAccessKeys: true,
      });
      tryCalls.push({ path: paths.getInstancePath(id, act), useAccessKeys: true });
      tryCalls.push({ path: paths.getInstancePath(id, act), useAccessKeys: false });
    }

    // 3) Instance without activity.
    tryCalls.push({ path: paths.getInstancePath(id), useAccessKeys: true });
    tryCalls.push({ path: paths.getInstancePath(id), useAccessKeys: false });

    for (const call of tryCalls) {
      try {
        let response;
        if (call.useAccessKeys) {
          response = await kfMutateJson(kfInstance, call.path, {
            method: 'GET',
            useAccessKeys: true,
            allowSdkFallback: true,
          });
        } else {
          response = await kfGetJson(kfInstance, call.path);
        }
        const detail = unwrapInstanceDetail(response);
        if (
          detail &&
          (detail._id ||
            detail.Project_ID ||
            detail.Sub_Task_Name ||
            detail.Entity ||
            detail.Functions ||
            detail.Task_type ||
            detail.Task_Type ||
            detail['Table::Task_History'])
        ) {
          return { idx, detail };
        }
      } catch {
        // try next path
      }
    }
    // Mark attempted so callers that re-check won't keep treating as "needs enrich".
    return {
      idx,
      detail: {
        'Table::Task_History': Array.isArray(row?.['Table::Task_History'])
          ? row['Table::Task_History']
          : [],
      },
    };
  });

  const out = list.slice();
  for (const entry of details) {
    if (!entry?.detail) continue;
    const listRow = out[entry.idx];
    out[entry.idx] = {
      ...listRow,
      ...entry.detail,
      _id: listRow?._id || entry.detail._id,
      _item_id: listRow?._item_id || entry.detail._item_id,
      _activity_instance_id:
        listRow?._activity_instance_id || entry.detail._activity_instance_id,
      _activity_id: listRow?._activity_id || entry.detail._activity_id,
      _current_step: listRow?._current_step || entry.detail._current_step,
    };
  }
  return out;
}

/** Fetch one task admin detail (Entity / Functions / Task_type / history). Dev + prod. */
export async function fetchTaskAdminItemDetail(kfInstance, instanceId) {
  const id = String(instanceId || '').trim();
  if (!id || !kfInstance) return null;
  const paths = buildPmProcessApiPaths(kfInstance, TASKS_ENTITY);
  if (!paths) return null;
  const path =
    typeof paths.getAdminItemDetailPath === 'function'
      ? paths.getAdminItemDetailPath(id)
      : `${paths.itemBase}/${encodeURIComponent(id)}?_application_id=${encodeURIComponent(paths.applicationId || '')}`;

  try {
    const response = await kfMutateJson(kfInstance, path, {
      method: 'GET',
      useAccessKeys: true,
      allowSdkFallback: true,
    });
    return unwrapInstanceDetail(response);
  } catch {
    try {
      return unwrapInstanceDetail(await kfGetJson(kfInstance, path));
    } catch {
      return null;
    }
  }
}

export function mapProcessSubtaskItem(item) {
  const raw = item?.raw && typeof item.raw === 'object' ? item.raw : null;
  const named = String(
    raw?.Sub_task_Name ||
      raw?.Sub_Task_Name ||
      raw?.Subtask_Name ||
      item?.subtaskName ||
      item?.name ||
      '',
  ).trim();
  const summary = String(item?.summary || raw?.SubTask_Summary || '').trim();
  const systemName = String(raw?.Name || '').trim();
  const isProcessLabel = /^sub[-\s]?task process from\b/i.test(systemName);
  const displayName =
    named ||
    summary ||
    (!isProcessLabel && systemName && !/^Pk[A-Za-z0-9]+$/.test(systemName) ? systemName : '') ||
    'Untitled subtask';
  const assigneeName =
    String(
      item?.assigneeName ||
        item?.people?.[0]?.name ||
        raw?.Assignee_1?.Name ||
        '',
    ).trim() ||
    reportAssigneeEmail(raw || item) ||
    '—';
  const createdBy = String(
    item?.createdBy || raw?._created_by?.Name || '',
  ).trim() || '—';

  return {
    id: item.id,
    parentTaskBusinessId: item.parentTaskBusinessId,
    taskName: displayName,
    subtaskName: displayName,
    summary: summary || named || '—',
    assignedTo: assigneeName,
    assignedToEmail: reportAssigneeEmail(raw || item),
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

function displayFieldValue(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') {
    return String(value.Name || value.name || value.label || value.Value || value.value || '').trim();
  }
  return String(value).trim();
}

/** Normalize Kissflow Project_ID lookup (object, array, or string). */
export function unwrapProjectLookup(raw) {
  if (raw == null || raw === '') return null;
  if (Array.isArray(raw)) {
    const first = raw.find((x) => x != null && x !== '') ?? null;
    return unwrapProjectLookup(first);
  }
  if (typeof raw === 'object') return raw;
  const s = String(raw).trim();
  return s ? { Project_ID: s, Name: s } : null;
}

function isProjectCodeLike(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  // Business codes / Kissflow board ids — not human project titles.
  if (/^PRJ[-_]/i.test(s)) return true;
  if (/^Pk[A-Za-z0-9]+$/.test(s)) return true;
  if (/^PRJ-\d+$/i.test(s)) return true;
  return false;
}

function pickHumanProjectName(...candidates) {
  for (const c of candidates) {
    const s = String(c ?? '').trim();
    if (!s || s === '—' || s === '-' || s.toLowerCase() === 'n/a') continue;
    if (isProjectCodeLike(s)) continue;
    return s;
  }
  return '';
}

/** Collect stable keys used to join a task to a project catalog row. */
export function collectProjectMatchKeys(...values) {
  const keys = new Set();
  const push = (v) => {
    if (v == null || v === '') return;
    if (Array.isArray(v)) {
      v.forEach(push);
      return;
    }
    if (typeof v === 'object') {
      push(v.Project_ID);
      push(v.Project_Name);
      push(v.Name);
      push(v.name);
      push(v._id);
      push(v._item_id);
      push(v.Item_Id);
      push(v.Item_ID);
      push(v.Id);
      push(v.id);
      return;
    }
    const s = String(v).trim();
    if (s) keys.add(s.toLowerCase());
  };
  values.forEach(push);
  return Array.from(keys);
}

export function resolveProjectFieldsFromRaw(r) {
  const projectRef =
    unwrapProjectLookup(r?.Project_ID)
    || unwrapProjectLookup(r?.Project)
    || unwrapProjectLookup(r?.Project_1)
    || unwrapProjectLookup(r?.Project_Lookup)
    || unwrapProjectLookup(r?.Project_Details)
    || unwrapProjectLookup(r?.Datelookup)
    || unwrapProjectLookup(r?.Project_ID_Details_All)
    || unwrapProjectLookup(r?.Project_ID__Reference)
    || null;

  // Prefer Project_Name from the lookup (Kissflow case/project card field).
  let projectName = pickHumanProjectName(
    projectRef?.Project_Name,
    r?.Project_Details?.Project_Name,
    r?.Project_ID_Details_All?.Project_Name,
    r?.Datelookup?.Project_Name,
    r?.Application_Name,
    r?.Project_Name,
    typeof r?.Project === 'string' ? r.Project : null,
    projectRef?.Name,
    projectRef?.name,
  );

  const projectId = String(
    (projectRef
      ? (projectRef.Project_ID
        || projectRef.Item_Id
        || projectRef.Item_ID
        || projectRef._item_id
        || projectRef._id
        || projectRef.Id
        || projectRef.id
        || '')
      : '')
      || r?.Project_ID_Hidden
      || r?.Project_ID_1
      || r?.Project_ID_Details
      || (typeof r?.Project_ID === 'string' ? r.Project_ID : '')
      || '',
  ).trim();

  return {
    projectRef,
    projectId,
    projectName: projectName || '—',
    projectRefCode: String(projectRef?.Project_ID || r?.Project_ID_Details || '').trim(),
  };
}

/**
 * Pending/myitems list rows often omit Project_Name on the lookup.
 * Fill gaps by matching Project_ID / Hidden / Details against a project catalog
 * (and optionally richer admin-tracker task twins).
 */
export function enrichTasksWithProjectCatalog(tasks, projects = [], richerTasks = []) {
  const list = Array.isArray(tasks) ? tasks : [];
  if (!list.length) return list;

  const projectNameByKey = new Map();
  for (const p of Array.isArray(projects) ? projects : []) {
    const name = pickHumanProjectName(p?.name, p?.projectName, p?.raw?.Project_Name);
    if (!name) continue;
    const keys = collectProjectMatchKeys(
      p?.id,
      p?.displayId,
      p?.projectId,
      p?.projectRef,
      p?.raw?.Project_ID,
      p?.raw?.Project_ID_Details,
      p?.raw?._id,
      p?.raw?._item_id,
      name,
    );
    for (const k of keys) {
      if (!projectNameByKey.has(k)) projectNameByKey.set(k, name);
    }
  }

  const richerByKey = new Map();
  for (const t of Array.isArray(richerTasks) ? richerTasks : []) {
    const name = pickHumanProjectName(t?.project, t?.projectName);
    if (!name) continue;
    for (const k of collectProjectMatchKeys(t?.id, t?.taskId, t?.InstanceID, t?._id)) {
      if (!richerByKey.has(k)) richerByKey.set(k, t);
    }
  }

  return list.map((task) => {
    const current = pickHumanProjectName(task?.project, task?.projectName);
    if (current) {
      return current === task.project ? task : { ...task, project: current, projectName: current };
    }

    const twin = richerByKey.get(String(task?.id || '').trim().toLowerCase())
      || richerByKey.get(String(task?.taskId || '').trim().toLowerCase())
      || richerByKey.get(String(task?.InstanceID || '').trim().toLowerCase());
    const twinName = pickHumanProjectName(twin?.project, twin?.projectName);
    if (twinName) {
      return {
        ...task,
        project: twinName,
        projectName: twinName,
        projectId: task.projectId || twin.projectId || '',
      };
    }

    const raw = task?.raw && typeof task.raw === 'object' ? task.raw : {};
    const keys = collectProjectMatchKeys(
      task?.projectId,
      raw.Project_ID,
      raw.Project,
      raw.Project_1,
      raw.Project_Lookup,
      raw.Project_Details,
      raw.Datelookup,
      raw.Project_ID_Hidden,
      raw.Project_ID_1,
      raw.Project_ID_Details,
      raw.Project_ID__Reference,
      raw.Project_ID_Details_All,
    );
    for (const k of keys) {
      const name = projectNameByKey.get(k);
      if (name) {
        return { ...task, project: name, projectName: name };
      }
    }
    return task;
  });
}

/** Map one admin / report raw row into the tasks dashboard row shape. */
export function mapAdminTaskRow(r, idx = 0) {
  const now = new Date();
  const { projectRef, projectId, projectName, projectRefCode } = resolveProjectFieldsFromRaw(r);

  const taskName = String(r?.Sub_Task_Name || r?.Name || r?.Task_Name || '—').trim() || '—';
  const assignedToEmail = reportAssigneeEmail(r);
  const assignedTo = reportAssigneeName(r);

  const start = parseKfDate(r?.Start_Date || r?.fetch_start_date || r?.Start_Date_1);
  const originalEnd = parseKfDate(r?.End_Date || r?.fetch_End_date || r?.Actual_End_Date_1);
  const originalEndDate = fmtDate(originalEnd);
  const revision = deriveTaskRevisionFields(r, originalEndDate);
  const end = parseKfDate(revision.revisedEndDate) || originalEnd;
  const startDate = fmtDate(start);
  const endDate = fmtDate(end) || originalEndDate;

  const status = String(r?.Task_Status || r?._status || r?.Status || '—').trim() || '—';

  const agingDays =
    r?.Aging_Days != null && r?.Aging_Days !== ''
      ? Number(r.Aging_Days)
      : start
        ? Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

  const delayDays =
    r?.Delay_Days != null && r?.Delay_Days !== ''
      ? Number(r.Delay_Days)
      : end && !isTaskCompleted(status)
        ? Math.max(0, Math.ceil((now.getTime() - end.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

  const taskBusinessId = pickTaskBusinessId(
    r?.Subtaxk_id,
    r?.Task_ID_Formulated,
    r?.Task_ID_Hidden,
    r?.Project_Task_ID,
    r?.Task_ID,
  );

  const entity = displayFieldValue(r?.Entity?.Name || r?.Entity || r?.Entity_1);
  const functions = displayFieldValue(r?.Functions || r?.Function || r?.Department);
  const companyName =
    displayFieldValue(r?.Company_Name || r?.Company || (typeof projectRef === 'object' ? projectRef?.Company_Name : '')) || entity;
  const lineOfBusiness =
    displayFieldValue(r?.Project_Category || r?.Functions || r?.Function || r?.Department) || functions;
  const functionType = displayFieldValue(r?.Function_Type);
  const createdAt = fmtDate(parseKfDate(r?._created_at || r?.Created_at));

  const instanceKey = String(r?._id || r?._item_id || `TASK-${idx + 1}`).trim();
  const row = {
    id: taskBusinessId || instanceKey,
    /** Prefer real business id; keep empty rather than Pk so create can enrich. */
    taskId: taskBusinessId || '',
    taskBusinessId: taskBusinessId || '',
    InstanceID: String(r?._id || r?._item_id || '').trim(),
    ActivityID: Array.isArray(r?._activity_instance_id)
      ? (r._activity_instance_id[0] ?? '')
      : (r?._activity_instance_id ?? r?.activityInstanceId ?? ''),
    _id: r?._id || r?._item_id,
    _activity_instance_id: r?._activity_instance_id,
    projectId,
    projectRef: projectRefCode,
    projectName,
    taskName,
    taskType: String(r?.Task_Type || r?.Task_type || '').trim(),
    entity,
    functions,
    companyName,
    lineOfBusiness,
    functionType,
    priority: String(r?.Task_Priority || r?.Priority || '').trim(),
    assignedTo,
    assignedToId: String(r?.Assigned_To?._id || r?.Assignee?._id || '').trim(),
    assignedToEmail,
    requesterEmail: String(
      r?.requester_email ||
        r?.['Requester Email'] ||
        r?.Requester_Email ||
        r?.Created_by_flat_field_email ||
        r?._created_by?.Email ||
        r?._created_by?.email ||
        '',
    ).trim(),
    assigneeAvatar: toInitials(assignedTo),
    startDate,
    endDate,
    originalEndDate: revision.originalEndDate,
    revisedEndDate: revision.revisedEndDate,
    previousEndDate: revision.previousEndDate,
    revisedCount: revision.revisedCount,
    hasRevision: revision.hasRevision,
    revisionHistory: revision.revisionHistory,
    createdAt,
    agingDays: Number.isFinite(agingDays) ? agingDays : 0,
    delayDays: Number.isFinite(delayDays) ? delayDays : 0,
    status,
    raw: r,
  };

  return { ...row, rag: mapTaskRag(row) };
}

function mapSubtaskStatusForEmployee(raw, endDate) {
  const s = String(raw || '').trim().toLowerCase();
  const completed = s.includes('complete') || s.includes('closed') || s.includes('done');
  if (completed) return 'Completed';
  const due = parseKfDate(endDate);
  if (due && due < new Date()) return 'Overdue';
  if (s.includes('progress') || s.includes('review')) return 'In Progress';
  if (s.includes('overdue') || s.includes('delay')) return 'Overdue';
  return 'Pending';
}

/** Row shape for EmployeeDashboardProject (assignee ids + project ref). */
export function mapEmployeeTaskRow(r, idx = 0) {
  const now = new Date();
  const projectRefObj = [r?.Project_ID, r?.Project_Lookup, r?.Project_Details, r?.Datelookup].find(
    (value) =>
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value._id || value._item_id || value.Project_Name || value.Name || value.Project_ID),
  ) || {};
  const projectId = String(projectRefObj?._item_id || projectRefObj?._id || '').trim();
  const projectRef = String(projectRefObj?.Project_ID || r?.Project_ID_Details || '').trim();
  const projectName =
    String(
      projectRefObj?.Project_Name ||
        projectRefObj?.Name ||
        r?.Project_Name ||
        r?.Project ||
        r?.Project_ID_Details ||
        '',
    ).trim() || '—';

  const assignedToEmail = reportAssigneeEmail(r);
  const assignedTo = reportAssigneeName(r);
  const assignedToId = String(r?.Assigned_To?._id || '').trim();
  const requesterEmail = String(
    r?.requester_email ||
      r?.['Requester Email'] ||
      r?.Requester_Email ||
      r?.Created_by_flat_field_email ||
      r?._created_by?.Email ||
      r?._created_by?.email ||
      '',
  ).trim();

  const startRaw = parseKfDate(r?.Start_Date || r?.fetch_start_date);
  const originalEnd = parseKfDate(r?.End_Date || r?.fetch_End_date || r?.Actual_End_Date_1);
  const originalEndDate = fmtDate(originalEnd);
  const revision = deriveTaskRevisionFields(r, originalEndDate);
  const endRaw = parseKfDate(revision.revisedEndDate) || originalEnd;
  const startDate = fmtDate(startRaw);
  const endDate = fmtDate(endRaw) || originalEndDate;

  const formStatus = String(r?.Task_Status || '').trim();
  const status = formStatus || mapSubtaskStatusForEmployee(r?._status, endRaw);
  const agingDays =
    r?.Aging_Days != null && r?.Aging_Days !== ''
      ? Number(r.Aging_Days)
      : startRaw
        ? Math.max(0, Math.ceil((now.getTime() - startRaw.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
  const delayDays =
    r?.Delay_Days != null && r?.Delay_Days !== ''
      ? Number(r.Delay_Days)
      : endRaw && status !== 'Completed'
        ? Math.max(0, Math.ceil((now.getTime() - endRaw.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

  return {
    id: String(r?.Subtaxk_id || r?._id || `TASK-${idx + 1}`).trim(),
    InstanceID: String(r?._id || r?._item_id || '').trim(),
    ActivityID: String(
      Array.isArray(r?._activity_instance_id)
        ? (r._activity_instance_id[0] ?? '')
        : (r?._activity_instance_id ?? r?.activityInstanceId ?? ''),
    ).trim(),
    projectId,
    projectRef,
    projectName,
    taskName: String(r?.Sub_Task_Name || r?.Name || 'Untitled Task').trim() || 'Untitled Task',
    assignedTo,
    assignedToId,
    assignedToEmail,
    requesterEmail,
    assigneeAvatar: toInitials(assignedTo),
    status,
    priority: String(r?.Task_Priority || 'Medium').trim() || 'Medium',
    taskType: String(r?.Task_type || r?.Task_Type || '').trim(),
    entity: String(r?.Entity || '').trim(),
    functions: String(r?.Functions || r?.Function_Type || '').trim(),
    startDate,
    endDate,
    originalEndDate: revision.originalEndDate,
    revisedEndDate: revision.revisedEndDate,
    previousEndDate: revision.previousEndDate,
    revisedCount: revision.revisedCount,
    hasRevision: revision.hasRevision,
    revisionHistory: revision.revisionHistory,
    agingDays: Number.isFinite(agingDays) ? agingDays : 0,
    delayDays: Number.isFinite(delayDays) ? delayDays : 0,
    dueDate: endDate || '',
    isOverdue: status === 'Overdue' || (Number(delayDays) > 0 && status !== 'Completed'),
    completionDate: null,
    createdAt: fmtDate(parseKfDate(r?._created_at || r?.Created_at)),
    raw: r,
  };
}

function mapKarthikaTaskItem(item, idx) {
  const raw = {
    _id: item.id,
    Subtaxk_id: item.taskId || item.taskBusinessId,
    Sub_Task_Name: item.name,
    Task_Status: item.status,
    End_Date: item.due,
    Assigned_To: item.assignedTo ? { Name: item.assignedTo.Name || item.assignedTo } : null,
    Project_ID_Details: item.projectId,
    _activity_instance_id: item.activityInstanceId,
  };
  return mapAdminTaskRow(raw, idx);
}

async function fetchAdminTaskRows(kfInstance, applyPreference, extra = {}) {
  return fetchAllAdminProcessItems(kfInstance, TASK_PROCESS_ID, {
    applyPreference,
    accountId: DEFAULT_ACCOUNT_ID,
    ...extra,
  });
}

function mapRawTaskRows(rawRows) {
  const sourceRows = Array.isArray(rawRows) ? rawRows : [];
  const mapped = sourceRows.map((r, idx) => {
    if (r?.taskName || r?.Sub_Task_Name || r?.Name) {
      return mapAdminTaskRow(r, idx);
    }
    return mapKarthikaTaskItem(r, idx);
  });
  return dedupeTaskRows(mapped);
}

/**
 * Full admin task list (all pages). apply_preference=0 so saved views do not cap results.
 */
async function fetchRawTaskRows(kfInstance, extra = {}) {
  try {
    return await fetchAdminTaskRows(kfInstance, false, extra);
  } catch (error) {
    if (isAuthError(error) || isKissflowRateLimited(error)) return [];
    console.warn('[fetchTaskTrackerData] admin list failed', error?.message || error);
    return [];
  }
}

export async function fetchTaskTrackerData(kfInstance, options = {}) {
  // Opt-in only — per-row instance/activity GETs often 400 and can flood the tenant.
  const enrichDetails = options.enrichDetails === true;
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const rawRows = await fetchRawTaskRows(kfInstance, {
    onBatch: onProgress
      ? (batch) => {
          onProgress(mapRawTaskRows(batch));
        }
      : undefined,
  });
  if (rawRows.length === 0) return [];

  const sourceRows = enrichDetails
    ? await enrichRawTaskRowsWithInstanceDetail(kfInstance, rawRows)
    : rawRows;
  return mapRawTaskRows(sourceRows);
}

/**
 * Admin-only task list — `GET .../admin/Project_Sub_Task_A01/item`
 * (no report / myitems fallbacks).
 */
export async function fetchAdminTaskTrackerData(kfInstance, options = {}) {
  const enrichDetails = options.enrichDetails === true;
  const rawRows = await fetchRawTaskRows(kfInstance);
  if (rawRows.length === 0) return [];

  const sourceRows = enrichDetails
    ? await enrichRawTaskRowsWithInstanceDetail(kfInstance, rawRows)
    : rawRows;

  return dedupeTaskRows(sourceRows.map((r, idx) => mapAdminTaskRow(r, idx)));
}

async function fetchEmployeeRawTaskRows(kfInstance) {
  return fetchRawTaskRows(kfInstance);
}

export async function fetchEmployeeTaskTrackerData(kfInstance, options = {}) {
  const rawRows = await fetchEmployeeRawTaskRows(kfInstance);
  if (rawRows.length === 0) return [];

  const enrichDetails = options.enrichDetails === true;
  const sourceRows = enrichDetails
    ? await enrichRawTaskRowsWithInstanceDetail(kfInstance, rawRows)
    : rawRows;
  const mapped = sourceRows.map((r, idx) => {
    if (r?.Sub_Task_Name || r?.Name || r?.Assigned_To) {
      return mapEmployeeTaskRow(r, idx);
    }
    return mapEmployeeTaskRow(
      {
        _id: r.id,
        Subtaxk_id: r.taskId || r.taskBusinessId,
        Sub_Task_Name: r.name,
        Task_Status: r.status,
        End_Date: r.due,
        Assigned_To:
          typeof r.assignedTo === 'object'
            ? r.assignedTo
            : r.assignedTo
              ? { Name: r.assignedTo }
              : null,
        Project_ID_Details: r.projectId,
        Project_ID: r.projectId ? { _item_id: r.projectId } : null,
        _activity_instance_id: r.activityInstanceId,
      },
      idx,
    );
  });

  const seen = new Set();
  return mapped.filter((row) => {
    const key = String(row?.id ?? '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** @deprecated Use fetchTaskTrackerData — kept for ProjectDashboardPage compatibility */
export async function fetchSubtaskTrackerData(kfInstance) {
  return fetchTaskTrackerData(kfInstance);
}

export function computeTaskKpiMetrics(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const total = list.length;
  const completed = list.filter((t) => isTaskCompleted(t.status)).length;
  const overdue = list.filter((t) => isTaskOverdue(t)).length;
  const open = list.filter((t) => !isTaskCompleted(t.status)).length;
  const denom = Math.max(total, 1);

  return {
    totalTasks: total,
    openTasks: open,
    completedTasks: completed,
    overdueTasks: overdue,
    openPct: Math.round((open / denom) * 100),
    completedPct: Math.round((completed / denom) * 100),
    overduePct: Math.round((overdue / denom) * 100),
  };
}
