/**
 * Task process APIs — mis-table-kf pattern (light + parallel):
 * - Tasks Created by Me  (My Items)     → myitems/status/count + myitems/{segment}?page
 * - Tasks Assigned to me (My Tasks)     → pending/activity/count + pending/{id} (parallel)
 * - Assigned Closed      (Participated) → participated/activity/count + list (parallel)
 */

import { getApiBase } from '../apiBase.js';
import { buildPmProcessApiPaths } from './kfPmMyItemsPaths.js';
import { TASKS_ENTITY } from './pmMyItemsEntities.js';
import { mapAdminTaskRow } from './kfTaskTracker.js';
import { kfGetJson, runWithConcurrency } from './kfRuntime.js';

export const HUB_TASK_PAGE_SIZE = 50;
const ACTIVITY_LIST_CONCURRENCY = 2;
const ACTIVITY_CACHE_TTL_MS = 15_000;

export const MYITEMS_STATUS_OPTIONS = ['Draft', 'In progress', 'Completed', 'Withdrawn', 'Rejected'];

const STATUS_TO_SEGMENT = {
  Draft: 'draft',
  'In progress': 'inprogress',
  Completed: 'completed',
  Withdrawn: 'withdrawn',
  Rejected: 'rejected',
};

const activityCache = {
  pending: { at: 0, data: null },
  participated: { at: 0, data: null },
  statusCounts: { at: 0, data: null },
};

function readCache(key) {
  const entry = activityCache[key];
  if (!entry?.data) return null;
  if (Date.now() - entry.at > ACTIVITY_CACHE_TTL_MS) return null;
  return entry.data;
}

function writeCache(key, data) {
  activityCache[key] = { at: Date.now(), data };
}

export function invalidateHubTaskCaches() {
  activityCache.pending = { at: 0, data: null };
  activityCache.participated = { at: 0, data: null };
  activityCache.statusCounts = { at: 0, data: null };
}

async function fetchKfJson(kf, path, options = {}) {
  if ((options.method || 'GET') === 'GET' && !options.body) {
    return kfGetJson(kf, path);
  }
  if (kf?.api) {
    const resp = await kf.api(path, {
      method: options.method || 'GET',
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      ...(options.body != null ? { body: options.body } : {}),
    });
    return resp?.data ?? resp ?? null;
  }
  const res = await fetch(getApiBase() + path, {
    method: options.method || 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    ...(options.body != null ? { body: options.body } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function extractListPayload(response) {
  if (Array.isArray(response)) return response;
  return response?.Data ?? response?.data ?? response?.Item ?? response?.items ?? [];
}

function extractAggregationTotal(response, fallback = 0) {
  const agg = response?.Aggregation;
  if (agg && typeof agg === 'object') {
    const first = Object.values(agg)[0];
    if (first != null && first.Count != null) return Number(first.Count) || 0;
  }
  return fallback;
}

function dedupeRawRows(rows) {
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const id = String(row?._id || row?._item_id || row?.InstanceID || '').trim();
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    unique.push(row);
  }
  return unique;
}

async function mapRowsWithRevisionDetail(_kfInstance, rows) {
  const unique = dedupeRawRows(rows);
  return unique.map((row, idx) => mapAdminTaskRow(row, idx)).filter(Boolean);
}

function buildTaskProcessPaths(kfInstance) {
  return buildPmProcessApiPaths(kfInstance, TASKS_ENTITY);
}

function appQuery(paths) {
  return paths?.applicationId
    ? `_application_id=${encodeURIComponent(paths.applicationId)}`
    : '';
}

function sumActivityCounts(activities) {
  return (Array.isArray(activities) ? activities : []).reduce(
    (sum, a) => sum + (Number(a?.Count) || 0),
    0,
  );
}

function activitiesWithWork(activities) {
  return (Array.isArray(activities) ? activities : []).filter(
    (a) => a?._id && (Number(a?.Count) || 0) > 0,
  );
}

export async function fetchMyItemsStatusCounts(kfInstance) {
  const cached = readCache('statusCounts');
  if (cached) return cached;

  const paths = buildTaskProcessPaths(kfInstance);
  if (!paths?.statusCountPath) return null;
  try {
    const response = await fetchKfJson(kfInstance, paths.statusCountPath);
    if (!response || typeof response !== 'object') return null;
    const counts = {
      Draft: Number(response.Draft ?? response.draft ?? 0) || 0,
      'In progress': Number(response.InProgress ?? response.inprogress ?? response['In progress'] ?? 0) || 0,
      Completed: Number(response.Completed ?? response.completed ?? 0) || 0,
      Withdrawn: Number(response.Withdrawn ?? response.withdrawn ?? 0) || 0,
      Rejected: Number(response.Rejected ?? response.rejected ?? 0) || 0,
    };
    writeCache('statusCounts', counts);
    return counts;
  } catch (e) {
    console.warn('UserHub: status count fetch failed', e?.message || e);
    return null;
  }
}

export async function fetchMyCreatedTasksByStatus(
  kfInstance,
  statusLabel,
  { page = 1, pageSize = HUB_TASK_PAGE_SIZE } = {},
) {
  const paths = buildTaskProcessPaths(kfInstance);
  if (!paths) return { rows: [], total: 0, page, pageSize };

  const segment = STATUS_TO_SEGMENT[statusLabel] || 'draft';
  const pn = Math.max(1, Number(page) || 1);
  const ps = Math.min(1000, Math.max(1, Number(pageSize) || HUB_TASK_PAGE_SIZE));
  const path =
    `/process/2/${paths.accountId}/${paths.processId}/myitems/${segment}` +
    `?apply_preference=true&page_number=${pn}&page_size=${ps}&${appQuery(paths)}`;

  const response = await fetchKfJson(kfInstance, path);
  const rows = await mapRowsWithRevisionDetail(kfInstance, extractListPayload(response));
  const total = extractAggregationTotal(response, rows.length);
  return { rows, total, page: pn, pageSize: ps };
}

export async function fetchMyCreatedProcessTasks(kfInstance) {
  const pages = await Promise.all(
    MYITEMS_STATUS_OPTIONS.map((label) =>
      fetchMyCreatedTasksByStatus(kfInstance, label, { page: 1, pageSize: HUB_TASK_PAGE_SIZE }),
    ),
  );
  const merge = [];
  pages.forEach(({ rows }) => merge.push(...(rows || [])));
  const seen = new Set();
  return merge.filter((row) => {
    const id = String(row?.InstanceID ?? row?.id ?? '').trim();
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function resolveTaskDraftDeleteId(row) {
  return String(
    row?.InstanceID ?? row?.raw?._id ?? row?._id ?? row?.id ?? '',
  ).trim();
}

export async function deleteTaskDraftRecords(kfInstance, recordIds) {
  const paths = buildTaskProcessPaths(kfInstance);
  if (!paths || !kfInstance) return { successIds: [], failed: recordIds.length };
  const ids = (Array.isArray(recordIds) ? recordIds : []).map((id) => String(id || '').trim()).filter(Boolean);
  if (!ids.length) return { successIds: [], failed: 0 };

  const results = await Promise.allSettled(
    ids.map(async (id) => {
      const path = `/process/2/${paths.accountId}/admin/${paths.processId}/${encodeURIComponent(id)}`;
      if (kfInstance?.api) {
        await kfInstance.api(path, { method: 'DELETE', headers: { Accept: 'application/json' } });
        return id;
      }
      const res = await fetch(getApiBase() + path, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      return id;
    }),
  );

  const successIds = [];
  let failed = 0;
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') successIds.push(ids[idx]);
    else failed += 1;
  });
  invalidateHubTaskCaches();
  return { successIds, failed };
}

export async function fetchPendingTaskActivities(kfInstance, { force = false } = {}) {
  if (!force) {
    const cached = readCache('pending');
    if (cached) return cached;
  }
  const paths = buildTaskProcessPaths(kfInstance);
  if (!paths?.pendingCountPath) return [];
  const response = await fetchKfJson(kfInstance, paths.pendingCountPath);
  const list = Array.isArray(response) ? response : extractListPayload(response);
  const activities = Array.isArray(list) ? list.filter((a) => a?._id) : [];
  writeCache('pending', activities);
  return activities;
}

export async function fetchAssignedOpenProcessTasks(
  kfInstance,
  { page = 1, pageSize = HUB_TASK_PAGE_SIZE, activities: preloaded } = {},
) {
  const paths = buildTaskProcessPaths(kfInstance);
  if (!paths) return { rows: [], total: 0, page, pageSize };

  const activities = preloaded || (await fetchPendingTaskActivities(kfInstance));
  const total = sumActivityCounts(activities);
  const pn = Math.max(1, Number(page) || 1);
  const ps = Math.min(1000, Math.max(1, Number(pageSize) || HUB_TASK_PAGE_SIZE));
  const work = activitiesWithWork(activities);

  const batches = await runWithConcurrency(work, ACTIVITY_LIST_CONCURRENCY, async (activity) => {
    const path = paths.getPendingListPath(activity._id, pn, ps);
    const response = await fetchKfJson(kfInstance, path);
    return extractListPayload(response);
  });

  return { rows: await mapRowsWithRevisionDetail(kfInstance, batches.flat()), total, page: pn, pageSize: ps };
}

export async function fetchParticipatedTaskActivities(kfInstance, { force = false } = {}) {
  if (!force) {
    const cached = readCache('participated');
    if (cached) return cached;
  }
  const paths = buildTaskProcessPaths(kfInstance);
  if (!paths) return [];
  const appQ = appQuery(paths);
  const path = `/process/2/${paths.accountId}/${paths.processId}/participated/activity/count${appQ ? `?${appQ}` : ''}`;
  const data = await fetchKfJson(kfInstance, path);
  const steps = Array.isArray(data) ? data.filter((s) => s?._id) : [];
  writeCache('participated', steps);
  return steps;
}

export async function fetchAssignedClosedProcessTasks(
  kfInstance,
  { page = 1, pageSize = HUB_TASK_PAGE_SIZE, activities: preloaded } = {},
) {
  const paths = buildTaskProcessPaths(kfInstance);
  if (!paths) return { rows: [], total: 0, page, pageSize };

  const steps = preloaded || (await fetchParticipatedTaskActivities(kfInstance));
  const total = sumActivityCounts(steps);
  const pn = Math.max(1, Number(page) || 1);
  const ps = Math.min(1000, Math.max(1, Number(pageSize) || HUB_TASK_PAGE_SIZE));
  const appQ = appQuery(paths);
  const work = activitiesWithWork(steps);

  const batches = await runWithConcurrency(work, ACTIVITY_LIST_CONCURRENCY, async (step) => {
    const path =
      `/process/2/${paths.accountId}/${paths.processId}/participated/activity/${encodeURIComponent(String(step._id))}` +
      `?apply_preference=true&page_number=${pn}&page_size=${ps}&skip_aggregation=true${appQ ? `&${appQ}` : ''}`;
    const response = await fetchKfJson(kfInstance, path);
    return extractListPayload(response);
  });

  return { rows: await mapRowsWithRevisionDetail(kfInstance, batches.flat()), total, page: pn, pageSize: ps };
}

export async function fetchAllAssignedProcessTasks(kfInstance) {
  const [open, closed] = await Promise.all([
    fetchAssignedOpenProcessTasks(kfInstance, { page: 1, pageSize: HUB_TASK_PAGE_SIZE }),
    fetchAssignedClosedProcessTasks(kfInstance, { page: 1, pageSize: HUB_TASK_PAGE_SIZE }),
  ]);
  const seen = new Set();
  const out = [];
  for (const row of [...(open.rows || []), ...(closed.rows || [])]) {
    const id = String(row?.InstanceID ?? row?.id ?? row?.raw?._id ?? '').trim();
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    out.push(row);
  }
  return out;
}

export async function fetchUserHubTaskCounts(kfInstance) {
  try {
    const [statusCounts, pendingActs, participatedActs] = await Promise.all([
      fetchMyItemsStatusCounts(kfInstance),
      fetchPendingTaskActivities(kfInstance),
      fetchParticipatedTaskActivities(kfInstance),
    ]);
    const created = statusCounts
      ? Object.values(statusCounts).reduce((sum, n) => sum + (Number(n) || 0), 0)
      : 0;
    return {
      created,
      assignedOpen: sumActivityCounts(pendingActs),
      assignedClosed: sumActivityCounts(participatedActs),
      statusCounts,
      pendingActivities: pendingActs,
      participatedActivities: participatedActs,
    };
  } catch {
    return {
      created: 0,
      assignedOpen: 0,
      assignedClosed: 0,
      statusCounts: null,
      pendingActivities: [],
      participatedActivities: [],
    };
  }
}

export function unwrapTaskPageResult(result) {
  if (Array.isArray(result)) return { rows: result, total: result.length };
  if (result && Array.isArray(result.rows)) {
    return {
      rows: result.rows,
      total: Number(result.total) || result.rows.length,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
  return { rows: [], total: 0 };
}
