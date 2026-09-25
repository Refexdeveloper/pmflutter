import { kfGetJson, resolveKissflowAccountId, fetchAllAdminProcessItems, runWithConcurrency, isKissflowRateLimited, isAuthError } from './kfRuntime.js';
import { filterRowsForRequester, rowRequesterEmail } from './pmRequesterScope.js';
import { loginEmailOf } from './kfEmployeeTasksReport.js';
import { cacheKey, getCachedOrLoad, invalidateListCache } from './kfListCache.js';
import { reportAssigneeEmail, reportAssigneeName } from './kfUserField.js';

const DEFAULT_ACCOUNT_ID = 'AcCMptp3yqcn';
export const SUBTASK_PROCESS_ID = 'Sub_Task_Process_A00';

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

export function isSubtaskCompleted(status) {
  const s = String(status || '').trim().toLowerCase();
  return s.includes('complete') || s.includes('closed') || s.includes('done');
}

/**
 * Display title for a subtask row.
 * Prefer form field Sub_task_Name; SubTask_Summary is free text; Kissflow `Name`
 * is often a system label like "Sub-Task Process from …".
 */
export function resolveSubtaskDisplayName(source, fallback = 'Untitled subtask') {
  const row = source && typeof source === 'object' ? source : {};
  const raw = row.raw && typeof row.raw === 'object' ? row.raw : {};

  const isPlaceholder = (s) => {
    const t = String(s || '').trim().toLowerCase();
    return !t || t === '—' || t === '-' || t === 'untitled' || t === 'untitled subtask' || t === 'untitled task';
  };
  const isProcessLabel = (s) => /^sub[-\s]?task process from\b/i.test(String(s || '').trim());
  const isPkId = (s) => /^Pk[A-Za-z0-9]+$/.test(String(s || '').trim());

  const pick = (...vals) => {
    for (const v of vals) {
      const s = String(v ?? '').trim();
      if (isPlaceholder(s) || isProcessLabel(s) || isPkId(s)) continue;
      return s;
    }
    return '';
  };

  const named = pick(
    row.Sub_task_Name,
    raw.Sub_task_Name,
    row.Sub_Task_Name,
    raw.Sub_Task_Name,
    row.Subtask_Name,
    raw.Subtask_Name,
    row.subtaskName,
    row.taskName,
  );
  if (named) return named;

  const summary = pick(row.SubTask_Summary, raw.SubTask_Summary, row.summary, raw.summary);
  if (summary) return summary;

  const loose = pick(row.name, raw.Name, row.Name);
  if (loose) return loose;

  return fallback;
}

function resolveParentTaskId(r) {
  const hidden = String(r?.Task_ID_Hidden ?? '').trim();
  if (hidden) return hidden;

  const ref = r?.Task_ID;
  if (ref && typeof ref === 'object') {
    return String(
      ref?.Subtaxk_id ||
        ref?.Task_ID_Formulated ||
        ref?.Task_ID_Hidden ||
        ref?.Project_Task_ID ||
        ref?.Project_ID_1 ||
        '',
    ).trim();
  }
  if (typeof ref === 'string' && ref.trim()) return ref.trim();
  return String(r?.Project_Task_ID ?? '').trim();
}

function resolveParentTaskName(r) {
  const ref = r?.Task_ID;
  if (ref && typeof ref === 'object') {
    // Parent is Project_Sub_Task_A01 — display name lives on Sub_Task_Name (Name is often empty).
    const name = String(
      ref?.Sub_Task_Name ||
        ref?.Task_Name ||
        ref?.Name ||
        ref?.Subject ||
        ref?.title ||
        '',
    ).trim();
    if (name) return name;
  }
  // Prefer business id over a blank dash when the Task ID lookup is present.
  const id = resolveParentTaskId(r);
  return id || '—';
}

/** RAG for subtask rows based on status and age. */
export function mapSubtaskRag(row) {
  const status = String(row?.status ?? '').toLowerCase();
  if (isSubtaskCompleted(status)) return 'Green';
  if ((row?.agingDays ?? 0) > 21) return 'Red';
  if (status.includes('progress') || status.includes('open') || status.includes('pending')) return 'Amber';
  return 'Amber';
}

export function mapAdminSubtaskRow(r, idx = 0) {
  const now = new Date();
  const created = parseKfDate(r?._created_at);
  const agingDays = created
    ? Math.max(0, Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const assigneeName = reportAssigneeName(r);
  const assignedToEmail = reportAssigneeEmail(r);
  // Form field is Sub_task_Name; Name is often a system copy of it.
  const named = resolveSubtaskDisplayName(r, '');
  const summary = String(r?.SubTask_Summary ?? '').trim();
  const subtaskName = named || summary || 'Untitled subtask';
  // Table status uses form select TStatus (e.g. Open), not workflow _status.
  const status = String(r?.TStatus ?? r?._status ?? '—').trim() || '—';
  const parentTaskId = resolveParentTaskId(r);
  const parentTaskName = resolveParentTaskName(r);
  const priority = String(r?.Sub_task_Priority ?? r?.Sub_Task_Priority ?? '—').trim() || '—';

  const activityRaw = r?._activity_instance_id;
  const activityId = Array.isArray(activityRaw) ? (activityRaw[0] ?? '') : (activityRaw ?? '');

  const row = {
    id: String(r?._id ?? `SUB-${idx + 1}`).trim(),
    subtaskName,
    summary: summary || named || '—',
    parentTaskName,
    parentTaskId: parentTaskId || '—',
    parentTaskBusinessId: parentTaskId || '',
    projectId: String(r?.Project_ID ?? '—').trim() || '—',
    projectTaskId: String(r?.Project_Task_ID ?? '—').trim() || '—',
    boardId: String(r?.Board_ID ?? '—').trim() || '—',
    processId: String(r?.Process_ID ?? '—').trim() || '—',
    assignedTo: assigneeName || '—',
    assignedToEmail,
    externalemail: assignedToEmail,
    requesterEmail: String(
      r?.requester_email ||
        r?.Requester_Email ||
        r?.['Requester Email'] ||
        r?.Created_by_flat_field_email ||
        r?._created_by?.Email ||
        r?._created_by?.email ||
        '',
    ).trim(),
    // Keep initials in sync with displayed name (avoids "RJ" badge next to a "—" name).
    assigneeAvatar: toInitials(assigneeName),
    createdBy: String(r?._created_by?.Name ?? '—').trim() || '—',
    createdDate: fmtDate(created) || '—',
    agingDays,
    priority,
    status,
    workflowStatus: String(r?._status ?? '').trim() || '—',
    InstanceID: String(r?._id ?? '').trim(),
    ActivityID: activityId,
    _id: r?._id,
    _activity_instance_id: activityRaw,
    raw: { ...(r || {}), externalemail: assignedToEmail || r?.externalemail },
  };

  return { ...row, rag: mapSubtaskRag(row) };
}

async function fetchAdminSubtaskRows(kfInstance, applyPreference) {
  const accountId = resolveKissflowAccountId(kfInstance, DEFAULT_ACCOUNT_ID);
  const pref = applyPreference === false ? '0' : applyPreference === true ? '1' : 'default';
  return getCachedOrLoad(cacheKey('admin-subtasks', accountId, pref), () =>
    fetchAllAdminProcessItems(kfInstance, SUBTASK_PROCESS_ID, {
      applyPreference,
      accountId,
    }),
  );
}

/**
 * Loads subtasks from Sub_Task_Process_A00 admin API (all pages).
 */
export async function fetchSubtaskProcessData(kfInstance, options = {}) {
  if (!kfInstance) return [];
  const email = loginEmailOf(kfInstance, options.email);
  const user = { Email: email };

  const scopeRows = (rows) => {
    const mapped = rows.map((r, idx) => mapAdminSubtaskRow(r, idx));
    return email ? filterRowsForRequester(mapped, user) : mapped;
  };

  if (options.bust) {
    invalidateListCache('admin-subtasks');
  }

  try {
    const unfiltered = await fetchAdminSubtaskRows(kfInstance, false);
    return scopeRows(unfiltered);
  } catch (error) {
    if (isAuthError(error)) return [];
    if (isKissflowRateLimited(error)) throw error;
    console.warn('[fetchSubtaskProcessData] admin list failed', error?.message || error);
    return [];
  }
}

/**
 * Same split as Employee_Tasks:
 * assigned → login email equals externalemail
 * created  → login email equals requester email
 */
export async function fetchSubtasksByScope(kfInstance, options = {}) {
  const email = loginEmailOf(kfInstance, options.email);
  const scope = options.scope === 'created' ? 'created' : 'assigned';
  if (!email || !email.includes('@')) {
    return { email: '', scope, rows: [] };
  }
  const rows = await fetchSubtaskProcessData(kfInstance, { email, bust: options.bust });
  const mine = email.toLowerCase();
  const picked = (Array.isArray(rows) ? rows : []).filter((row) => {
    if (scope === 'created') return rowRequesterEmail(row) === mine;
    return reportAssigneeEmail(row).toLowerCase() === mine;
  });
  return { email: mine, scope, rows: picked };
}

function unwrapSubtaskDetail(response) {
  if (!response || typeof response !== 'object') return null;
  if (response.Data && typeof response.Data === 'object' && !Array.isArray(response.Data)) {
    return response.Data;
  }
  if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
    return response.data;
  }
  return response;
}

function activityInstanceIdOfSubtask(row) {
  const raw =
    row?._activity_instance_id ??
    row?.ActivityID ??
    row?.activityInstanceId ??
    row?._entity_id;
  if (Array.isArray(raw)) return String(raw[0] || '').trim();
  return String(raw || '').trim();
}

/** Pending/myitems list rows often omit Task_ID, TStatus, Sub_task_Priority. */
export function rawSubtaskRowNeedsDetailEnrichment(row) {
  if (!row || typeof row !== 'object') return false;
  const hasTaskId = Boolean(row.Task_ID || row.Task_ID_Hidden);
  const hasTStatus = Boolean(String(row.TStatus || '').trim());
  const hasPriority = Boolean(String(row.Sub_task_Priority || row.Sub_Task_Priority || '').trim());
  return !hasTaskId || !hasTStatus || !hasPriority;
}

/**
 * Merge admin item detail onto slim pending/myitems rows so the table can show
 * Parent task (Task_ID.Sub_Task_Name), Priority (Sub_task_Priority), Status (TStatus).
 */
export async function enrichRawSubtaskRowsWithInstanceDetail(kfInstance, rows, options = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length || !kfInstance) return list;

  const accountId = resolveKissflowAccountId(kfInstance, DEFAULT_ACCOUNT_ID);
  const maxRows = Math.max(0, Number(options.maxRows) || 80);
  const concurrency = Math.max(1, Number(options.concurrency) || 2);
  const needIdx = [];
  list.forEach((row, idx) => {
    if (maxRows && needIdx.length >= maxRows) return;
    const id = String(row?._id || row?._item_id || row?.InstanceID || '').trim();
    if (id && rawSubtaskRowNeedsDetailEnrichment(row)) needIdx.push(idx);
  });
  if (!needIdx.length) return list;

  const details = await runWithConcurrency(needIdx, concurrency, async (idx) => {
    const row = list[idx];
    const id = String(row?._id || row?._item_id || row?.InstanceID || '').trim();
    const act = activityInstanceIdOfSubtask(row);
    const adminPath =
      `/process/2/${accountId}/admin/${SUBTASK_PROCESS_ID}/${encodeURIComponent(id)}` +
      `?_application_id=Project_Management_Tracker_A00`;
    const tryPaths = [adminPath];
    if (act) {
      tryPaths.push(
        `/process/2/${accountId}/${SUBTASK_PROCESS_ID}/${encodeURIComponent(id)}/${encodeURIComponent(act)}`,
      );
    }
    tryPaths.push(`/process/2/${accountId}/${SUBTASK_PROCESS_ID}/${encodeURIComponent(id)}`);

    for (const path of tryPaths) {
      try {
        const response = await kfGetJson(kfInstance, path);
        const detail = unwrapSubtaskDetail(response);
        if (
          detail &&
          (detail._id ||
            detail.Task_ID ||
            detail.TStatus ||
            detail.Sub_task_Name ||
            detail.Sub_task_Priority)
        ) {
          return { idx, detail };
        }
      } catch {
        // try next
      }
    }
    return { idx, detail: null };
  });

  const out = list.slice();
  for (const entry of details) {
    if (!entry?.detail) continue;
    const listRow = out[entry.idx];
    out[entry.idx] = {
      ...listRow,
      ...entry.detail,
      // Keep list activity id if detail omits it (common on admin GET).
      _id: listRow?._id || entry.detail._id,
      _activity_instance_id:
        listRow?._activity_instance_id || entry.detail._activity_instance_id || undefined,
    };
  }
  return out;
}

/** Full admin detail for one Sub_Task_Process_A00 instance (popup fields). */
export async function fetchSubtaskAdminDetailById(kfInstance, instanceId) {
  const id = String(instanceId || '').trim();
  if (!id) throw new Error('Missing subtask instance id');
  if (!kfInstance?.api) {
    throw new Error('Kissflow SDK not ready — open this page inside Kissflow.');
  }
  const accountId = resolveKissflowAccountId(kfInstance, DEFAULT_ACCOUNT_ID);
  const path =
    `/process/2/${accountId}/admin/${SUBTASK_PROCESS_ID}/${encodeURIComponent(id)}` +
    `?_application_id=Project_Management_Tracker_A00`;
  return kfGetJson(kfInstance, path);
}

export function computeSubtaskKpiMetrics(subtasks) {
  const list = Array.isArray(subtasks) ? subtasks : [];
  const total = list.length;
  const completed = list.filter((s) => isSubtaskCompleted(s.status)).length;
  const open = list.filter((s) => !isSubtaskCompleted(s.status)).length;
  const stale = list.filter((s) => !isSubtaskCompleted(s.status) && (s.agingDays ?? 0) > 21).length;
  const denom = Math.max(total, 1);

  return {
    totalSubtasks: total,
    openSubtasks: open,
    completedSubtasks: completed,
    staleSubtasks: stale,
    openPct: Math.round((open / denom) * 100),
    completedPct: Math.round((completed / denom) * 100),
    stalePct: Math.round((stale / denom) * 100),
  };
}
