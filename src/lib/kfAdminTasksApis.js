/**
 * Kissflow helpers used ONLY by AdminTasks.jsx.
 * See `.cursor/skills/admin-tasks-kissflow/SKILL.md`.
 */

import { kfGetJson, resolveKissflowAccountId } from './kfRuntime.js';

const DEFAULT_ACCOUNT_ID = 'AcCMptp3yqcn';
export const ADMIN_TASKS_PROCESS_ID = 'Project_Sub_Task_A01';
export const ADMIN_TASKS_REPORT_ID = 'Live_Sub_Task_Task_Wise_A00';

function accountId(kfInstance) {
  return resolveKissflowAccountId(kfInstance, DEFAULT_ACCOUNT_ID);
}

/**
 * GET /process-report/2/:account_id/:process_id/:report_id/count?q=
 * Retrieves the count of items within the report.
 */
export async function fetchAdminTasksReportCount(
  kfInstance,
  { reportId = ADMIN_TASKS_REPORT_ID, q = '' } = {},
) {
  const acc = accountId(kfInstance);
  const query = q ? `?q=${encodeURIComponent(q)}` : '';
  const path = `/process-report/2/${acc}/${ADMIN_TASKS_PROCESS_ID}/${encodeURIComponent(reportId)}/count${query}`;
  const payload = await kfGetJson(kfInstance, path);
  if (typeof payload === 'number') return payload;
  if (payload?.Count != null) return Number(payload.Count) || 0;
  if (payload?.count != null) return Number(payload.count) || 0;
  if (payload?.Total != null) return Number(payload.Total) || 0;
  if (payload?.total != null) return Number(payload.total) || 0;
  return Number(payload?.Data ?? payload?.data ?? 0) || 0;
}

/**
 * GET /process-report/2/:account_id/:process_id/:report_id/:instance_id
 * Retrieves field values of a specific item from a process tabular report.
 */
export async function fetchAdminTasksReportItemDetails(
  kfInstance,
  instanceId,
  { reportId = ADMIN_TASKS_REPORT_ID } = {},
) {
  const id = String(instanceId || '').trim();
  if (!id) return null;
  const acc = accountId(kfInstance);
  const path = `/process-report/2/${acc}/${ADMIN_TASKS_PROCESS_ID}/${encodeURIComponent(reportId)}/${encodeURIComponent(id)}`;
  return kfGetJson(kfInstance, path);
}

/**
 * GET /process/2/:account_id/admin/:process_id/:instance_id/:table_id/:row_id/:field_id/image
 * Downloads an image from a table field (Process Admin). Returns a Blob when possible.
 *
 * Access-key headers are for server clients only — Page SPAs use kf.api session auth.
 */
export async function fetchAdminTasksTableFieldImage(
  kfInstance,
  { instanceId, tableId, rowId, fieldId, processId = ADMIN_TASKS_PROCESS_ID },
) {
  const acc = accountId(kfInstance);
  const path = [
    `/process/2/${acc}/admin`,
    encodeURIComponent(processId),
    encodeURIComponent(String(instanceId || '').trim()),
    encodeURIComponent(String(tableId || '').trim()),
    encodeURIComponent(String(rowId || '').trim()),
    encodeURIComponent(String(fieldId || '').trim()),
    'image',
  ].join('/');

  if (typeof kfInstance?.api === 'function') {
    const resp = await kfInstance.api(path, {
      method: 'GET',
      headers: { Accept: 'application/octet-stream' },
    });
    if (resp instanceof Blob) return resp;
    if (resp?.data instanceof Blob) return resp.data;
    return resp?.data ?? resp ?? null;
  }

  const { getApiBase } = await import('../apiBase.js');
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/octet-stream' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

/** Merge report item details into an admin list row (fills missing activity / fields). */
export function mergeAdminTaskRowWithReportDetails(row, detail) {
  if (!detail || typeof detail !== 'object') return row;
  const activity =
    detail._activity_instance_id
    ?? detail.ActivityInstanceID
    ?? detail.activityInstanceId
    ?? row?.ActivityID;
  const activityId = Array.isArray(activity) ? (activity[0] ?? '') : activity;
  return {
    ...row,
    ActivityID: String(activityId || row?.ActivityID || '').trim() || row?.ActivityID,
    raw: {
      ...(row?.raw && typeof row.raw === 'object' ? row.raw : {}),
      ...detail,
    },
  };
}
