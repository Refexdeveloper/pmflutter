/** Kissflow IT Service Management — report mapping & helpers */

import { kfGetJson, kfMutateJson } from './kfRuntime.js';

export const APP_ID = 'IT_Service_Management_A00';
export const PROCESS_ID = 'Live_IT_Service_Request_A00';
export const REPORT_ID = 'Live_IT_Service_Request_A00_All_Items';
export const DEFAULT_ACCOUNT_ID = 'AcCMptp3yqcn';

export const DEV_KISSFLOW_ORIGIN = 'https://development-refexgroup.kissflow.com';
export const LIVE_KISSFLOW_ORIGIN = 'https://refexgroup.kissflow.com';

/** Column FieldId → internal key */
export const COL = {
  requesterEmail: 'Column_d6WEUYBK5K',
  requesterName: 'Column_xqsbvNRvRD',
  requestedDate: 'Column_Wemyx4l6xt',
  requestedDateTime: 'Column_T2P0u0D-sw',
  status: 'Column_vlunW1aLEU',
  ticketType: 'Column_Pmla_o_AxA',
  category: 'Column_UW4Oe8SANE',
  subCategory: 'Column_gQJQPt-NvN',
  summary: 'Column_IZZr7-YTGK',
  description: 'Column_jM2xzzEdH8',
  attachments: 'Column_1th22rsBYB',
  criticality: 'Column_XwzBoYrFdR',
  itemStatus: 'Column_nyHECOMNah',
  solution: 'Column_vwycPza-ry',
  holdReason: 'Column_mWFV6UPyKW',
  slaMinutes: 'Column_c9k71UiWFq',
  requestId: 'Column_ul9j0VUNd1',
  lastCompletedStep: 'Column_ZBd4KxwpW2',
  name: 'Column_M51HU39Q4g',
  createdBy: 'Column_XS9N8vaa-F',
  modifiedBy: 'Column_w-2Rcc6-Av',
  createdAt: 'Column_QOwvoXvcys',
  modifiedAt: 'Column_6rmYKKBs4C',
  flowName: 'Column__5ZuzvnBGk',
  currentStep: 'Column_27XUPVQc7e',
  assignedTo: 'Column_PVeBBMZg7b',
  systemStatus: 'Column_McylhavuPn',
};

export const WORKFLOW_STEPS = ['Start', 'IT Agent', 'IT Manager'];

export const STATUS_TABS = [
  { key: 'InProgress', label: 'In Progress', gradient: 'from-cyan-600 via-indigo-600 to-violet-600', sdkStatus: 'inprogress' },
  { key: 'Completed', label: 'Completed', gradient: 'from-emerald-500 to-teal-600', sdkStatus: 'completed' },
];

/** IT Agent dashboard tabs — filter by Item_Status + current step */
export const AGENT_STATUS_TABS = [
  { key: 'PendingTask', label: 'Pending Task', gradient: 'from-cyan-600 via-indigo-600 to-violet-600', sdkStatus: 'inprogress' },
  { key: 'Completed', label: 'Completed', gradient: 'from-emerald-500 to-teal-600', sdkStatus: 'completed' },
];

/** IT Manager dashboard tabs */
export const MANAGER_STATUS_TABS = [
  { key: 'PendingTask', label: 'Pending Task', gradient: 'from-cyan-600 via-indigo-600 to-violet-600', sdkStatus: 'inprogress' },
  { key: 'Completed', label: 'Completed', gradient: 'from-emerald-500 to-teal-600', sdkStatus: 'completed' },
  { key: 'AgentPending', label: 'Agent Pending Tasks', gradient: 'from-violet-500 to-indigo-600', sdkStatus: 'agent' },
];

/** IT Admin dashboard tabs */
export const ADMIN_STATUS_TABS = [
  { key: 'All', label: 'All', gradient: 'from-slate-600 to-indigo-700' },
  { key: 'ITAgent', label: 'IT Agent', gradient: 'from-cyan-600 via-indigo-600 to-violet-600' },
  { key: 'ITManager', label: 'IT Manager', gradient: 'from-indigo-500 to-violet-600' },
  { key: 'Completed', label: 'Completed', gradient: 'from-emerald-500 to-teal-600' },
];

export const IT_AGENT_FORM_FIELDS = {
  itemStatus: 'Item_Status',
  solution: 'Solution',
  holdReason: 'Reason',
};

/** FieldId keys (process-report) and process field names (getMyItems) */
const FIELD = {
  requesterEmail: ['Column_d6WEUYBK5K', 'Requester_Email'],
  requesterName: ['Column_xqsbvNRvRD', 'Requester_Name'],
  requestedDate: ['Column_Wemyx4l6xt', 'Requested_Date'],
  requestedDateTime: ['Column_T2P0u0D-sw', 'Requester_Date__Time'],
  status: ['Column_vlunW1aLEU', 'Statu', 'Column_McylhavuPn', '_status'],
  ticketType: ['Column_Pmla_o_AxA', 'Ticket_Type'],
  category: ['Column_UW4Oe8SANE', 'Category'],
  subCategory: ['Column_gQJQPt-NvN', 'SubCategory'],
  summary: ['Column_IZZr7-YTGK', 'Summary'],
  description: ['Column_jM2xzzEdH8', 'Description'],
  attachments: ['Column_1th22rsBYB', 'Supporting_Documents'],
  criticality: ['Column_XwzBoYrFdR', 'Criticality'],
  itemStatus: ['Column_nyHECOMNah', 'Item_Status'],
  solution: ['Column_vwycPza-ry', 'Solution'],
  holdReason: ['Column_mWFV6UPyKW', 'Reason'],
  managerComments: ['Manager_Comments'],
  slaMinutes: ['Column_c9k71UiWFq', 'SLA_Timing_Min'],
  requestId: ['Column_ul9j0VUNd1', 'Request_ID'],
  lastCompletedStep: ['Column_ZBd4KxwpW2', 'last_completed_step_name'],
  name: ['Column_M51HU39Q4g', 'Name', '_name'],
  createdBy: ['Column_XS9N8vaa-F', '_created_by'],
  modifiedBy: ['Column_w-2Rcc6-Av', '_modified_by'],
  createdAt: ['Column_QOwvoXvcys', '_created_at'],
  modifiedAt: ['Column_6rmYKKBs4C', '_modified_at'],
  flowName: ['Column__5ZuzvnBGk', '_flow_name'],
  currentStep: ['Column_27XUPVQc7e', '_current_step'],
  assignedTo: ['Column_PVeBBMZg7b', '_current_assigned_to'],
};

export const KPI_VARS = {
  userName: 'User_Name',
  totalRecords: 'total_records',
  openTickets: 'open_tickets',
  completedRecords: 'completed_records',
  slaBreached: 'sla_breached',
};

export const AGENT_KPI_VARS = {
  userName: 'User_Name',
  totalRecords: 'total_records_agent',
  openTickets: 'open_agents',
  completedRecords: 'completed_agents',
  pendingTasks: 'pending_agents',
};

export const MANAGER_KPI_VARS = {
  userName: 'User_Name',
  totalRecords: 'total_manager',
  openTickets: 'open_manager',
  completedRecords: 'completed_manager',
  pendingTasks: 'pending_manager',
  agentPendingTasks: 'pending_full_manager',
};

export const ADMIN_KPI_VARS = {
  userName: 'User_Name',
  totalRecords: 'total_admin',
  openRecords: 'open_admin',
  completedRecords: 'completed_admin',
  pendingRecords: 'pending_admin',
};

export const MANAGER_FORM_FIELDS = {
  managerComments: 'Manager_Comments',
};

export const IT_AGENT_STEP = 'IT Agent';
export const IT_AGENT_ACTIVITY_ID = 'IT Agent';
export const IT_MANAGER_STEP = 'IT Manager';

const IT_AGENT_ACTIVITY_IDS = ['IT Agent', 'IT_Agent', 'IT_Agent_A00'];
const IT_MANAGER_ACTIVITY_IDS = ['IT Manager', 'IT_Manager', 'IT_Manager_A00'];

function buildITProcessApiPaths(kfInstance) {
  const accountId = resolveAccountId(kfInstance);
  const appQuery = `_application_id=${encodeURIComponent(APP_ID)}`;
  const base = `/process/2/${accountId}/${PROCESS_ID}`;
  return {
    pendingAtStepPath(activityId, pageNumber = 1, pageSize = 100) {
      return `${base}/pending/${encodeURIComponent(activityId)}?apply_preference=true&page_number=${pageNumber}&page_size=${pageSize}&skip_aggregation=true&${appQuery}`;
    },
    myItemsPath(status = 'all', pageNumber = 1, pageSize = 100) {
      return `${base}/myitems/${status}?apply_preference=true&page_number=${pageNumber}&page_size=${pageSize}&skip_aggregation=true&${appQuery}`;
    },
    participatedPath(pageNumber = 1, pageSize = 100) {
      return `${base}/participated?apply_preference=true&page_number=${pageNumber}&page_size=${pageSize}&skip_aggregation=true&${appQuery}`;
    },
    instancePath(instanceId) {
      return `${base}/${encodeURIComponent(instanceId)}?${appQuery}`;
    },
    instanceWithActivityPath(instanceId, activityInstanceId) {
      return `${base}/${encodeURIComponent(instanceId)}/${encodeURIComponent(activityInstanceId)}?${appQuery}`;
    },
    instanceSubmitPath(instanceId, activityInstanceId) {
      return `${base}/${encodeURIComponent(instanceId)}/${encodeURIComponent(activityInstanceId)}/submit?${appQuery}`;
    },
    instanceActivityPath(instanceId) {
      return `${base}/${encodeURIComponent(instanceId)}/activity?${appQuery}`;
    },
  };
}

export function extractItemsFromResponse(resp) {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  const keys = ['Data', 'data', 'items', 'Items', 'records', 'Records'];
  for (const key of keys) {
    if (Array.isArray(resp[key])) return resp[key];
  }
  if (Array.isArray(resp?.data?.items)) return resp.data.items;
  if (Array.isArray(resp?.Data?.items)) return resp.Data.items;
  return [];
}

function mergeUniqueItems(batches) {
  const seen = new Set();
  const merged = [];
  for (const batch of batches) {
    for (const item of batch || []) {
      const id = normalizeText(item?._id || item?._item_id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(item);
    }
  }
  return merged;
}

export const ITEM_STATUS_OPTIONS = ['Completed', 'On Hold', 'In Progress', 'Escalated'];

export function isSlaBreached(itemOrRow) {
  const itemStatus = normalizeText(itemOrRow?.itemStatus ?? itemOrRow?.[COL.itemStatus]).toLowerCase();
  if (itemStatus.includes('breach')) return true;

  const status = normalizeText(itemOrRow?.status ?? itemOrRow?.[COL.status]).toLowerCase();
  if (status === 'completed' || status === 'closed') return false;

  const slaMinutes = Number(itemOrRow?.slaMinutes ?? itemOrRow?.[COL.slaMinutes]);
  if (!Number.isFinite(slaMinutes) || slaMinutes <= 0) return false;

  const startTime =
    itemOrRow?.requestedDateTimeRaw
    ?? itemOrRow?.[COL.requestedDateTime]
    ?? itemOrRow?.[COL.createdAt];
  if (!startTime) return false;

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return false;

  const elapsedMinutes = (Date.now() - start.getTime()) / (1000 * 60);
  return elapsedMinutes > slaMinutes;
}

function resolveKissflowBaseUrl() {
  const origin = typeof window !== 'undefined' && window?.location?.origin
    ? String(window.location.origin)
    : '';
  if (origin && origin.includes('kissflow.com')) return origin;

  const isDev =
    (typeof import.meta !== 'undefined' && import.meta?.env?.DEV) ||
    (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development');

  return isDev ? DEV_KISSFLOW_ORIGIN : LIVE_KISSFLOW_ORIGIN;
}

export function resolveAccountId(kfInstance) {
  const sdkAccountId = String(kfInstance?.account?._id || '').trim();
  if (sdkAccountId) return sdkAccountId;

  const candidates = [];
  const push = (v) => { if (v) candidates.push(String(v)); };
  push(typeof window !== 'undefined' ? window?.location?.href : '');
  push(typeof window !== 'undefined' ? window?.location?.pathname : '');

  const re = /\/(?:flow|case|metadata|process-report)\/2\/([^/]+)/i;
  for (const raw of candidates) {
    const match = raw.match(re);
    if (match?.[1]) return match[1];
  }
  return DEFAULT_ACCOUNT_ID;
}

export function getReportPath(accountId, page = 1, pageSize = 100) {
  return `/process-report/2/${accountId}/${PROCESS_ID}/${REPORT_ID}?page_number=${page}&page_size=${pageSize}&_application_id=${APP_ID}`;
}

function normalizeText(v) {
  return String(v ?? '').trim();
}

function normalizeEmail(v) {
  return normalizeText(v).toLowerCase();
}

function parseUserRef(ref) {
  if (!ref || typeof ref !== 'object') return { id: '', name: '', email: '' };
  return {
    id: normalizeText(ref._id || ref.Id || ref.id),
    name: normalizeText(ref.Name || ref.name),
    email: normalizeEmail(ref.Email || ref.email),
  };
}

function formatAssignedTo(list) {
  if (!Array.isArray(list)) return '—';
  const names = list.map((a) => normalizeText(a?.Name)).filter(Boolean);
  return names.length ? names.join(', ') : '—';
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return normalizeText(value);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return normalizeText(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getWorkflowStepIndex(stepName) {
  const s = normalizeText(stepName);
  const idx = WORKFLOW_STEPS.findIndex((step) => step.toLowerCase() === s.toLowerCase());
  return idx >= 0 ? idx : 0;
}

export function isAssignedToUser(assignedList, user) {
  if (!user || !Array.isArray(assignedList)) return false;
  const userId = normalizeText(user._id || user.Id);
  const userName = normalizeText(user.Name || user.FirstName).toLowerCase();
  const userEmail = normalizeEmail(user.Email);

  return assignedList.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const entryId = normalizeText(entry._id || entry.Id);
    const entryName = normalizeText(entry.Name).toLowerCase();
    if (userId && entryId && userId === entryId) return true;
    if (userName && entryName && userName === entryName) return true;
    if (userEmail && entryName && entryName === userEmail) return true;
    return false;
  });
}

function stringifyKfValue(val) {
  if (val == null) return '';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val).trim();
  }
  if (Array.isArray(val)) {
    const parts = val.map(stringifyKfValue).filter(Boolean);
    return parts.length ? parts.join(', ') : '';
  }
  if (typeof val === 'object') {
    if (val.Name != null) return String(val.Name).trim();
    if (val._name != null) return String(val._name).trim();
    if (val.label != null) return String(val.label).trim();
    if (val.value != null) return stringifyKfValue(val.value);
  }
  return '';
}

function getItemValue(item, fieldKeys) {
  if (!item || !fieldKeys?.length) return undefined;
  const sources = [item, item?.Data, item?.data].filter(Boolean);

  for (const src of sources) {
    for (const key of fieldKeys) {
      const v = src[key];
      if (v !== undefined && v !== null && v !== '') return v;
    }

    const lowerKeys = new Set(fieldKeys.map((k) => String(k).toLowerCase()));
    for (const [k, v] of Object.entries(src)) {
      if (v !== undefined && v !== null && v !== '' && lowerKeys.has(String(k).toLowerCase())) {
        return v;
      }
    }
  }

  return undefined;
}

function mapFieldText(item, fieldKeys) {
  const text = stringifyKfValue(getItemValue(item, fieldKeys));
  return text || '—';
}

export const ITEM_STATUS_WAITING_LABEL = 'Waiting for IT Agent Approval';

export function formatItemStatusDisplay(raw) {
  const text = stringifyKfValue(raw);
  if (!text || text.toLowerCase() === 'not picked yet') {
    return ITEM_STATUS_WAITING_LABEL;
  }
  return text;
}

function mergeITItemWithReport(item, reportItem) {
  if (!reportItem) return item;
  if (!item) return reportItem;

  const merged = { ...reportItem, ...item };
  for (const keys of Object.values(FIELD)) {
    for (const key of keys) {
      const itemVal = item[key];
      const reportVal = reportItem[key];
      if (
        (itemVal === undefined || itemVal === null || itemVal === '')
        && reportVal !== undefined
        && reportVal !== null
        && reportVal !== ''
      ) {
        merged[key] = reportVal;
      }
    }
  }
  return merged;
}

export function normalizeStatusKey(statusLike) {
  const s = normalizeText(statusLike).toLowerCase().replace(/\s+/g, '');
  if (s === 'inprogress' || s === 'open') return 'InProgress';
  if (s === 'completed' || s === 'closed') return 'Completed';
  if (s === 'reopened') return 'Reopened';
  if (s === 'draft') return 'Draft';
  return normalizeText(statusLike) || 'InProgress';
}

export function matchesStatusTab(row, tabKey) {
  const key = normalizeStatusKey(row?.status);
  if (tabKey === 'InProgress') return key === 'InProgress';
  if (tabKey === 'Completed') return key === 'Completed';
  return true;
}

export function getRawItemStatus(itemOrRow) {
  if (!itemOrRow) return '';
  if (itemOrRow.itemStatusRaw != null && itemOrRow.itemStatusRaw !== '') {
    return normalizeText(itemOrRow.itemStatusRaw);
  }
  return stringifyKfValue(
    itemOrRow?.Column_nyHECOMNah ?? getItemValue(itemOrRow, FIELD.itemStatus),
  );
}

/** Agent tabs: Pending Task = at IT Agent step & Item_Status ≠ Completed; Completed = Item_Status Completed */
export function matchesAgentStatusTab(row, tabKey) {
  const itemStatus = getRawItemStatus(row).toLowerCase();
  const atAgentStep = isITAgentStep(row);

  if (tabKey === 'PendingTask') {
    return atAgentStep && itemStatus !== 'completed';
  }
  if (tabKey === 'Completed') {
    return itemStatus === 'completed';
  }
  return true;
}

/** My items = requester's own tickets (matches Kissflow My items view) */
export function isMyItem(row, user, { fromMyItemsApi = false } = {}) {
  if (!row) return false;
  if (fromMyItemsApi) return true;

  const email = normalizeEmail(user?.Email);
  if (!email) return true;

  const requesterEmail = normalizeEmail(row.requesterEmail);
  if (requesterEmail && requesterEmail === email) return true;

  const userId = normalizeText(user?._id || user?.Id);
  const createdById = normalizeText(row.createdById);
  if (userId && createdById && userId === createdById) return true;

  return false;
}

export function pickActivityInstanceId(item) {
  const raw = item?._activity_instance_id
    ?? item?.activityInstanceId
    ?? item?._activity_id
    ?? item?.Activity_Instance_Id
    ?? '';
  return Array.isArray(raw) ? String(raw[0] || '').trim() : String(raw || '').trim();
}

async function resolveITAgentActivityInstanceId(kfInstance, instanceId, hintId = '') {
  const paths = buildITProcessApiPaths(kfInstance);

  try {
    const activities = await kfGetJson(kfInstance, paths.instanceActivityPath(instanceId));
    const list = Array.isArray(activities) ? activities : extractItemsFromResponse(activities);
    for (const act of list || []) {
      const step = normalizeText(
        act?.Name || act?.Activity_Name || act?.activity_name || act?.Step_Name || act?.step_name,
      );
      const actId = normalizeText(
        act?._activity_instance_id || act?._id || act?.Id || act?.activity_instance_id,
      );
      const actStatus = normalizeText(act?.Status || act?._status || act?.status).toLowerCase();
      if (!actId) continue;
      if (step.toLowerCase() === IT_AGENT_STEP.toLowerCase() && actStatus !== 'completed') {
        return actId;
      }
    }
    for (const act of list || []) {
      const actStatus = normalizeText(act?.Status || act?._status || act?.status).toLowerCase();
      const actId = normalizeText(
        act?._activity_instance_id || act?._id || act?.Id || act?.activity_instance_id,
      );
      if (actId && actStatus !== 'completed') return actId;
    }
  } catch (err) {
    console.warn('instance activity lookup failed:', err?.message || err);
  }

  try {
    const detail = await kfGetJson(kfInstance, paths.instancePath(instanceId));
    const fromDetail = pickActivityInstanceId(detail);
    if (fromDetail) return fromDetail;
  } catch (err) {
    console.warn('instance detail lookup failed:', err?.message || err);
  }

  return normalizeText(hintId);
}

async function resolveITAgentActivityForSubmit(kfInstance, row) {
  const instanceId = normalizeText(row?.id);
  const paths = buildITProcessApiPaths(kfInstance);
  let activityInstanceId = pickActivityInstanceId(row?.raw) || normalizeText(row?.activityInstanceId);

  if (!activityInstanceId && kfInstance?.api) {
    for (const activityId of IT_AGENT_ACTIVITY_IDS) {
      try {
        const resp = await kfGetJson(kfInstance, paths.pendingAtStepPath(activityId, 1, 100));
        const match = extractItemsFromResponse(resp).find(
          (it) => normalizeText(it?._id) === instanceId,
        );
        if (match) {
          activityInstanceId = pickActivityInstanceId(match);
          if (activityInstanceId) break;
        }
      } catch {
        // try next activity id
      }
    }
  }

  if (!activityInstanceId) {
    activityInstanceId = await resolveITAgentActivityInstanceId(kfInstance, instanceId, '');
  }

  return { instanceId, activityInstanceId };
}

export async function submitITAgentWork(kfInstance, row, formData) {
  if (!kfInstance?.api) {
    throw new Error('Submit not available — open inside Kissflow');
  }

  const { instanceId, activityInstanceId } = await resolveITAgentActivityForSubmit(kfInstance, row);
  if (!instanceId) throw new Error('Missing instance id for this task');
  if (!activityInstanceId) throw new Error('Could not resolve IT Agent activity for this task');

  const submitPayload = {
    [IT_AGENT_FORM_FIELDS.itemStatus]: formData.itemStatus,
    [IT_AGENT_FORM_FIELDS.solution]: formData.solution,
    [IT_AGENT_FORM_FIELDS.holdReason]: formData.holdReason || '',
  };

  const paths = buildITProcessApiPaths(kfInstance);
  const submitPath = paths.instanceSubmitPath(instanceId, activityInstanceId);
  const process = getITProcess(kfInstance);

  try {
    const submitResp = await kfMutateJson(kfInstance, submitPath, {
      method: 'POST',
      body: submitPayload,
    });
    const successText = normalizeText(submitResp?.success || submitResp?.Success || submitResp?.message);
    if (successText && !/success/i.test(successText)) {
      throw new Error(successText);
    }
    return submitResp;
  } catch (restErr) {
    if (process?.updateItem && process?.submitItem) {
      await process.updateItem({
        instanceId,
        activityInstanceId,
        data: submitPayload,
      });
      await process.submitItem({
        instanceId,
        activityInstanceId,
        comment: formData.comment || '',
      });
      return { success: 'Submitted successfully' };
    }
    throw restErr;
  }
}

export function getITProcess(kfInstance) {
  return kfInstance?.app?.getProcess?.(PROCESS_ID) || kfInstance?.getProcess?.(PROCESS_ID) || null;
}

/** Current workflow step from report JSON (`Column_27XUPVQc7e` / `_current_step`) */
export function getCurrentStepValue(itemOrRow) {
  if (!itemOrRow) return '';
  const raw = itemOrRow.raw ?? itemOrRow;
  const step =
    raw?.[COL.currentStep]
    ?? raw?.Column_27XUPVQc7e
    ?? raw?._current_step
    ?? itemOrRow?.currentStep
    ?? getItemValue(raw, FIELD.currentStep);
  return normalizeText(step);
}

export function isITAgentStep(rowOrItem) {
  return getCurrentStepValue(rowOrItem) === IT_AGENT_STEP;
}

export function countAgentPendingTasks(rowsOrItems) {
  return (rowsOrItems || []).filter((row) => getCurrentStepValue(row) === IT_AGENT_STEP).length;
}

/** Current step or last completed step at IT Agent (for Completed tab) */
export function isAgentRelevantItem(item) {
  if (isITAgentStep(item)) return true;
  const lastStep = normalizeText(getItemValue(item, FIELD.lastCompletedStep)).toLowerCase();
  return lastStep === IT_AGENT_STEP.toLowerCase();
}

/** Direct user assignment or IT Agents AppRole queue */
export function isAgentTaskForUser(item, user) {
  const assigned = getItemValue(item, FIELD.assignedTo);
  if (!user) return true;
  if (isAssignedToUser(assigned, user)) return true;
  if (!Array.isArray(assigned) || assigned.length === 0) return true;

  return assigned.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const kind = normalizeText(entry.Kind).toLowerCase();
    const name = normalizeText(entry.Name).toLowerCase();
    return kind === 'approle' && name.includes('it agent');
  });
}

/** Include pending at IT Agent, completed agent work, and items last handled at IT Agent */
export function isAgentDashboardItem(item, user) {
  const itemStatus = stringifyKfValue(getItemValue(item, FIELD.itemStatus));
  const lastStep = normalizeText(getItemValue(item, FIELD.lastCompletedStep));
  const solution = stringifyKfValue(getItemValue(item, FIELD.solution));

  if (itemStatus === 'Completed') {
    if (lastStep === IT_AGENT_STEP || lastStep === 'IT Manager' || solution) {
      return true;
    }
  }

  if (!isAgentTaskForUser(item, user)) return false;
  if (isITAgentStep(item)) return true;
  return lastStep === IT_AGENT_STEP;
}

async function fetchAgentTasksFromReport(kfInstance, page, pageSize, user) {
  const report = await fetchITServiceReport(kfInstance, page, pageSize);
  return extractItemsFromResponse(report).filter((item) => isAgentDashboardItem(item, user));
}

export function mapReportRow(item) {
  const assignedRaw = getItemValue(item, FIELD.assignedTo);
  const createdBy = parseUserRef(getItemValue(item, FIELD.createdBy));
  const rawStatus = getItemValue(item, FIELD.status);
  const status = normalizeStatusKey(rawStatus);

  return {
    id: normalizeText(item?._id),
    requestId: normalizeText(getItemValue(item, FIELD.requestId)) || '—',
    name: normalizeText(getItemValue(item, FIELD.name)),
    requesterName: normalizeText(getItemValue(item, FIELD.requesterName)) || createdBy.name,
    requesterEmail: normalizeText(getItemValue(item, FIELD.requesterEmail)),
    requestedDate: formatDate(getItemValue(item, FIELD.requestedDate)),
    requestedDateTime: formatDateTime(getItemValue(item, FIELD.requestedDateTime)),
    status,
    statusLabel: status === 'InProgress' ? 'In Progress' : status,
    ticketType: mapFieldText(item, FIELD.ticketType),
    category: mapFieldText(item, FIELD.category),
    subCategory: mapFieldText(item, FIELD.subCategory),
    summary: mapFieldText(item, FIELD.summary),
    description: mapFieldText(item, FIELD.description),
    criticality: mapFieldText(item, FIELD.criticality),
    itemStatusRaw: stringifyKfValue(getItemValue(item, FIELD.itemStatus)),
    itemStatus: formatItemStatusDisplay(getItemValue(item, FIELD.itemStatus)),
    solution: normalizeText(getItemValue(item, FIELD.solution)) || '—',
    holdReason: normalizeText(getItemValue(item, FIELD.holdReason)) || '—',
    managerComments: mapFieldText(item, FIELD.managerComments),
    slaMinutes: getItemValue(item, FIELD.slaMinutes) ?? '—',
    requestedDateTimeRaw: getItemValue(item, FIELD.requestedDateTime) || getItemValue(item, FIELD.createdAt) || null,
    slaBreached: isSlaBreached(item),
    lastCompletedStep: normalizeText(getItemValue(item, FIELD.lastCompletedStep)) || '—',
    currentStep: getCurrentStepValue(item) || '—',
    assignedTo: formatAssignedTo(assignedRaw),
    assignedToRaw: Array.isArray(assignedRaw) ? assignedRaw : [],
    flowName: normalizeText(getItemValue(item, FIELD.flowName)) || 'Live IT Service Request',
    createdAt: formatDateTime(getItemValue(item, FIELD.createdAt)),
    modifiedAt: formatDateTime(getItemValue(item, FIELD.modifiedAt)),
    createdBy: createdBy.name || '—',
    createdById: createdBy.id,
    activityInstanceId: pickActivityInstanceId(item),
    attachments: Array.isArray(getItemValue(item, FIELD.attachments)) ? getItemValue(item, FIELD.attachments) : [],
    raw: item,
  };
}

function unwrapReportData(resp) {
  return extractItemsFromResponse(resp);
}

export async function fetchITMyItems(kfInstance, page = 1, pageSize = 100) {
  const process = getITProcess(kfInstance);
  let items = [];
  let fromMyItemsApi = false;

  if (process?.getMyItems) {
    try {
      const resp = await process.getMyItems({
        status: 'all',
        pageNumber: page,
        pageSize,
      });
      items = unwrapReportData(resp);
      fromMyItemsApi = items.length > 0;
    } catch (err) {
      console.warn('getMyItems failed, falling back to process-report', err);
    }
  }

  try {
    const report = await fetchITServiceReport(kfInstance, page, pageSize);
    const reportItems = unwrapReportData(report);

    if (reportItems.length) {
      const reportById = new Map(
        reportItems.map((row) => [normalizeText(row?._id), row]),
      );

      if (items.length) {
        items = items.map((item) => {
          const full = reportById.get(normalizeText(item?._id));
          return mergeITItemWithReport(item, full);
        });
      } else {
        items = reportItems;
        fromMyItemsApi = false;
      }
    }
  } catch (err) {
    if (!items.length) {
      console.warn('process-report failed for my items', err);
    }
  }

  if (!fromMyItemsApi && items.length) {
    const email = normalizeEmail(kfInstance?.user?.Email);
    if (email) {
      items = items.filter((item) => {
        const requester = normalizeEmail(getItemValue(item, FIELD.requesterEmail));
        return requester === email;
      });
    }
  }

  return { items, fromMyItemsApi };
}

export async function fetchITAgentMyTasks(kfInstance, page = 1, pageSize = 100) {
  const user = kfInstance?.user;
  const paths = buildITProcessApiPaths(kfInstance);
  const collected = [];

  if (kfInstance?.api) {
    for (const activityId of IT_AGENT_ACTIVITY_IDS) {
      try {
        const resp = await kfGetJson(kfInstance, paths.pendingAtStepPath(activityId, page, pageSize));
        const items = extractItemsFromResponse(resp);
        if (items.length) {
          collected.push(...items);
          break;
        }
      } catch (err) {
        console.warn(`pending/${activityId} failed:`, err?.message || err);
      }
    }

    for (const status of ['inprogress', 'completed', 'all']) {
      try {
        const resp = await kfGetJson(kfInstance, paths.myItemsPath(status, page, pageSize));
        const items = extractItemsFromResponse(resp).filter((item) => isAgentDashboardItem(item, user));
        if (items.length) collected.push(...items);
      } catch (err) {
        console.warn(`myitems/${status} failed:`, err?.message || err);
      }
    }

    try {
      const resp = await kfGetJson(kfInstance, paths.participatedPath(page, pageSize));
      const items = extractItemsFromResponse(resp).filter((item) => isAgentDashboardItem(item, user));
      if (items.length) collected.push(...items);
    } catch (err) {
      console.warn('participated failed:', err?.message || err);
    }
  }

  const process = getITProcess(kfInstance);
  if (process?.getMyTasksItems) {
    for (const activityId of ['', ...IT_AGENT_ACTIVITY_IDS]) {
      try {
        const resp = await process.getMyTasksItems({
          activityId: activityId || '',
          pageNumber: page,
          pageSize,
        });
        const items = extractItemsFromResponse(resp).filter(isAgentRelevantItem);
        if (items.length) {
          collected.push(...items);
          break;
        }
      } catch (err) {
        console.warn('getMyTasksItems failed:', err?.message || err);
      }
    }
  }

  let items = mergeUniqueItems([collected]);
  let fromMyTasksApi = items.length > 0;

  try {
    const reportItems = await fetchAgentTasksFromReport(kfInstance, page, pageSize, user);
    if (reportItems.length) {
      items = mergeUniqueItems([items, reportItems]);
    }
  } catch (err) {
    console.warn('process-report fallback failed:', err?.message || err);
    if (!items.length) throw err;
  }

  return { items, fromMyTasksApi };
}

export async function fetchAgentKpiFromVariables(kfInstance) {
  if (!kfInstance?.app?.getVariable) return null;

  const read = async (key) => {
    try {
      return await kfInstance.app.getVariable(key);
    } catch {
      return 0;
    }
  };

  const [userName, totalRecords, openTickets, completedRecords, pendingTasks] = await Promise.all([
    read(AGENT_KPI_VARS.userName),
    read(AGENT_KPI_VARS.totalRecords),
    read(AGENT_KPI_VARS.openTickets),
    read(AGENT_KPI_VARS.completedRecords),
    read(AGENT_KPI_VARS.pendingTasks),
  ]);

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    userName: normalizeText(userName) || normalizeText(kfInstance?.user?.Name) || 'User',
    totalRecords: toNum(totalRecords),
    openTickets: toNum(openTickets),
    completedRecords: toNum(completedRecords),
    pendingTasks: toNum(pendingTasks),
  };
}

export function computeAgentKpisFromReportItems(items) {
  let totalRecords = 0;
  let openAgents = 0;
  let pendingAgents = 0;
  let completedAgents = 0;

  (items || []).forEach((item) => {
    totalRecords++;

    const currentStep = normalizeText(
      item?.Column_27XUPVQc7e ?? item?.currentStep ?? getItemValue(item, FIELD.currentStep),
    );
    const itemStatus = normalizeText(
      stringifyKfValue(item?.Column_nyHECOMNah ?? item?.itemStatus ?? getItemValue(item, FIELD.itemStatus)),
    );

    if (currentStep === IT_AGENT_STEP && itemStatus !== 'Completed') {
      openAgents++;
    }

    if (currentStep === IT_AGENT_STEP && itemStatus === 'On Hold') {
      pendingAgents++;
    }

    if (itemStatus === 'Completed') {
      completedAgents++;
    }
  });

  return {
    totalRecords,
    openTickets: openAgents,
    completedRecords: completedAgents,
    pendingTasks: pendingAgents,
  };
}

export function computeAgentKpisFromRows(rows) {
  return computeAgentKpisFromReportItems(rows);
}

export function applyAgentFilters(rows, { search = '', statusTab = 'PendingTask' } = {}) {
  let list = rows.filter((row) => matchesAgentStatusTab(row, statusTab));
  const q = normalizeText(search).toLowerCase();
  if (!q) return list;
  return list.filter((row) =>
    [row.requestId, row.summary, row.ticketType, row.category, row.subCategory, row.itemStatus, row.currentStep, row.name, row.requesterName]
      .some((v) => String(v || '').toLowerCase().includes(q)),
  );
}

export async function fetchITServiceReport(kfInstance, page = 1, pageSize = 100) {
  const accountId = resolveAccountId(kfInstance);
  const path = getReportPath(accountId, page, pageSize);

  if (kfInstance?.api) {
    const resp = await kfInstance.api(path, { method: 'GET', headers: { Accept: 'application/json' } });
    return resp?.data ?? resp ?? { Data: [] };
  }

  const base = resolveKissflowBaseUrl();
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Report failed: ${res.status}`);
  return res.json();
}

export async function fetchKpiFromVariables(kfInstance) {
  if (!kfInstance?.app?.getVariable) return null;

  const read = async (key) => {
    try {
      return await kfInstance.app.getVariable(key);
    } catch {
      return 0;
    }
  };

  const [userName, totalRecords, openTickets, completedRecords, slaBreached] = await Promise.all([
    read(KPI_VARS.userName),
    read(KPI_VARS.totalRecords),
    read(KPI_VARS.openTickets),
    read(KPI_VARS.completedRecords),
    read(KPI_VARS.slaBreached),
  ]);

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    userName: normalizeText(userName) || normalizeText(kfInstance?.user?.Name) || 'User',
    totalRecords: toNum(totalRecords),
    openTickets: toNum(openTickets),
    completedRecords: toNum(completedRecords),
    slaBreached: toNum(slaBreached),
  };
}

export function applyITFilters(rows, { search = '', statusTab = 'InProgress' } = {}) {
  let list = rows.filter((row) => matchesStatusTab(row, statusTab));
  const q = normalizeText(search).toLowerCase();
  if (!q) return list;
  return list.filter((row) =>
    [row.requestId, row.summary, row.ticketType, row.category, row.subCategory, row.itemStatus, row.currentStep, row.statusLabel, row.name, row.requesterName]
      .some((v) => String(v || '').toLowerCase().includes(q)),
  );
}

export function computeKpisFromRows(rows, userEmail) {
  const email = normalizeEmail(userEmail);
  let totalRecords = 0;
  let openTickets = 0;
  let completedRecords = 0;
  let slaBreached = 0;

  rows.forEach((row) => {
    if (email && normalizeEmail(row.requesterEmail) !== email) return;

    totalRecords++;
    const status = normalizeStatusKey(row.status);

    if (status === 'InProgress') openTickets++;
    if (status === 'Completed') completedRecords++;
    if (isSlaBreached(row)) slaBreached++;
  });

  return { totalRecords, openTickets, completedRecords, slaBreached };
}

export function isITManagerStep(rowOrItem) {
  return getCurrentStepValue(rowOrItem) === IT_MANAGER_STEP;
}

export function matchesManagerStatusTab(row, tabKey) {
  const itemStatus = getRawItemStatus(row).toLowerCase();
  const step = getCurrentStepValue(row);

  if (tabKey === 'PendingTask') return step === IT_MANAGER_STEP;
  if (tabKey === 'Completed') return itemStatus === 'completed';
  if (tabKey === 'AgentPending') return step === IT_AGENT_STEP;
  return true;
}

export function computeManagerKpisFromReportItems(items) {
  let totalRecords = 0;
  let openTickets = 0;
  let completedRecords = 0;
  let pendingTasks = 0;
  let agentPendingTasks = 0;

  (items || []).forEach((item) => {
    totalRecords++;

    const currentStep = getCurrentStepValue(item);
    const itemStatus = stringifyKfValue(
      item?.Column_nyHECOMNah ?? item?.itemStatusRaw ?? getItemValue(item, FIELD.itemStatus),
    ).toLowerCase();

    if (itemStatus === 'completed') completedRecords++;
    if (itemStatus !== 'completed') openTickets++;
    if (currentStep === IT_MANAGER_STEP) pendingTasks++;
    if (currentStep === IT_AGENT_STEP) agentPendingTasks++;
  });

  return {
    totalRecords,
    openTickets,
    completedRecords,
    pendingTasks,
    agentPendingTasks,
  };
}

export async function fetchManagerKpiFromVariables(kfInstance) {
  if (!kfInstance?.app?.getVariable) return null;

  const read = async (key) => {
    try {
      return await kfInstance.app.getVariable(key);
    } catch {
      return 0;
    }
  };

  const [userName, totalRecords, openTickets, completedRecords, pendingTasks, agentPendingTasks] = await Promise.all([
    read(MANAGER_KPI_VARS.userName),
    read(MANAGER_KPI_VARS.totalRecords),
    read(MANAGER_KPI_VARS.openTickets),
    read(MANAGER_KPI_VARS.completedRecords),
    read(MANAGER_KPI_VARS.pendingTasks),
    read(MANAGER_KPI_VARS.agentPendingTasks),
  ]);

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    userName: normalizeText(userName) || normalizeText(kfInstance?.user?.Name) || 'User',
    totalRecords: toNum(totalRecords),
    openTickets: toNum(openTickets),
    completedRecords: toNum(completedRecords),
    pendingTasks: toNum(pendingTasks),
    agentPendingTasks: toNum(agentPendingTasks),
  };
}

export async function fetchITManagerTasks(kfInstance, page = 1, pageSize = 100) {
  const paths = buildITProcessApiPaths(kfInstance);
  const collected = [];

  if (kfInstance?.api) {
    for (const activityId of IT_MANAGER_ACTIVITY_IDS) {
      try {
        const resp = await kfGetJson(kfInstance, paths.pendingAtStepPath(activityId, page, pageSize));
        const items = extractItemsFromResponse(resp);
        if (items.length) collected.push(...items);
      } catch (err) {
        console.warn(`manager pending/${activityId} failed:`, err?.message || err);
      }
    }
  }

  let items = mergeUniqueItems([collected]);
  let fromMyTasksApi = items.length > 0;

  try {
    const report = await fetchITServiceReport(kfInstance, page, pageSize);
    const reportItems = extractItemsFromResponse(report);
    if (reportItems.length) {
      items = mergeUniqueItems([items, reportItems]);
    }
  } catch (err) {
    console.warn('manager process-report failed:', err?.message || err);
    if (!items.length) throw err;
  }

  return { items, fromMyTasksApi };
}

async function resolveITManagerActivityInstanceId(kfInstance, instanceId, hintId = '') {
  const paths = buildITProcessApiPaths(kfInstance);

  if (kfInstance?.api) {
    for (const activityId of IT_MANAGER_ACTIVITY_IDS) {
      try {
        const resp = await kfGetJson(kfInstance, paths.pendingAtStepPath(activityId, 1, 100));
        const match = extractItemsFromResponse(resp).find(
          (it) => normalizeText(it?._id) === instanceId,
        );
        if (match) {
          const actId = pickActivityInstanceId(match);
          if (actId) return actId;
        }
      } catch {
        // try next
      }
    }
  }

  try {
    const activities = await kfGetJson(kfInstance, paths.instanceActivityPath(instanceId));
    const list = Array.isArray(activities) ? activities : extractItemsFromResponse(activities);
    for (const act of list || []) {
      const step = normalizeText(
        act?.Name || act?.Activity_Name || act?.activity_name || act?.Step_Name || act?.step_name,
      );
      const actId = normalizeText(
        act?._activity_instance_id || act?._id || act?.Id || act?.activity_instance_id,
      );
      const actStatus = normalizeText(act?.Status || act?._status || act?.status).toLowerCase();
      if (!actId) continue;
      if (step.toLowerCase() === IT_MANAGER_STEP.toLowerCase() && actStatus !== 'completed') {
        return actId;
      }
    }
    for (const act of list || []) {
      const actStatus = normalizeText(act?.Status || act?._status || act?.status).toLowerCase();
      const actId = normalizeText(
        act?._activity_instance_id || act?._id || act?.Id || act?.activity_instance_id,
      );
      if (actId && actStatus !== 'completed') return actId;
    }
  } catch (err) {
    console.warn('manager activity lookup failed:', err?.message || err);
  }

  try {
    const detail = await kfGetJson(kfInstance, paths.instancePath(instanceId));
    const fromDetail = pickActivityInstanceId(detail);
    if (fromDetail) return fromDetail;
  } catch (err) {
    console.warn('manager instance detail failed:', err?.message || err);
  }

  return normalizeText(hintId);
}

async function resolveITManagerActivityForSubmit(kfInstance, row) {
  const instanceId = normalizeText(row?.id);
  const activityInstanceId = await resolveITManagerActivityInstanceId(
    kfInstance,
    instanceId,
    row?.activityInstanceId || pickActivityInstanceId(row?.raw),
  );
  return { instanceId, activityInstanceId };
}

export async function submitITManagerWork(kfInstance, row, formData) {
  if (!kfInstance?.api) {
    throw new Error('Submit not available — open inside Kissflow');
  }

  const { instanceId, activityInstanceId } = await resolveITManagerActivityForSubmit(kfInstance, row);
  if (!instanceId) throw new Error('Missing instance id for this task');
  if (!activityInstanceId) throw new Error('Could not resolve IT Manager activity for this task');

  const submitPayload = {
    [MANAGER_FORM_FIELDS.managerComments]: formData.managerComments || '',
  };

  const paths = buildITProcessApiPaths(kfInstance);
  const process = getITProcess(kfInstance);

  try {
    const submitResp = await kfMutateJson(
      kfInstance,
      paths.instanceSubmitPath(instanceId, activityInstanceId),
      { method: 'POST', body: submitPayload },
    );
    const successText = normalizeText(submitResp?.success || submitResp?.Success || submitResp?.message);
    if (successText && !/success/i.test(successText)) {
      throw new Error(successText);
    }
    return submitResp;
  } catch (restErr) {
    if (process?.updateItem && process?.submitItem) {
      await process.updateItem({
        instanceId,
        activityInstanceId,
        data: submitPayload,
      });
      await process.submitItem({
        instanceId,
        activityInstanceId,
        comment: formData.managerComments || '',
      });
      return { success: 'Submitted successfully' };
    }
    throw restErr;
  }
}

export function applyManagerFilters(rows, { search = '', statusTab = 'PendingTask' } = {}) {
  let list = rows.filter((row) => matchesManagerStatusTab(row, statusTab));
  const q = normalizeText(search).toLowerCase();
  if (!q) return list;
  return list.filter((row) =>
    [row.requestId, row.summary, row.ticketType, row.category, row.currentStep, row.itemStatus, row.requesterName, row.managerComments]
      .some((v) => String(v || '').toLowerCase().includes(q)),
  );
}

export function getWorkflowStatusValue(itemOrRow) {
  if (!itemOrRow) return '';
  const raw = itemOrRow.raw ?? itemOrRow;
  const step =
    raw?.[COL.status]
    ?? raw?.Column_vlunW1aLEU
    ?? getItemValue(raw, FIELD.status)
    ?? itemOrRow?.status;
  return normalizeText(step);
}

export function getSystemStatusValue(itemOrRow) {
  if (!itemOrRow) return '';
  const raw = itemOrRow.raw ?? itemOrRow;
  return normalizeText(
    raw?.[COL.systemStatus]
    ?? raw?.Column_McylhavuPn
    ?? itemOrRow?.statusLabel,
  );
}

export function isDraftItem(itemOrRow) {
  const wf = normalizeStatusKey(getWorkflowStatusValue(itemOrRow));
  const sys = normalizeStatusKey(getSystemStatusValue(itemOrRow));
  return wf === 'Draft' || sys === 'Draft';
}

export function isAdminCompletedItem(rowOrItem) {
  const itemStatus = getRawItemStatus(rowOrItem).toLowerCase();
  const wf = normalizeStatusKey(getWorkflowStatusValue(rowOrItem));
  const sys = normalizeStatusKey(getSystemStatusValue(rowOrItem));
  return itemStatus === 'completed' || wf === 'Completed' || sys === 'Completed';
}

export function matchesAdminStatusTab(row, tabKey) {
  if (tabKey === 'All') return !isDraftItem(row);
  if (tabKey === 'ITAgent') return !isDraftItem(row) && getCurrentStepValue(row) === IT_AGENT_STEP;
  if (tabKey === 'ITManager') return !isDraftItem(row) && getCurrentStepValue(row) === IT_MANAGER_STEP;
  if (tabKey === 'Completed') return isAdminCompletedItem(row);
  return true;
}

export function computeAdminKpisFromReportItems(items) {
  let totalRecords = 0;
  let openRecords = 0;
  let completedRecords = 0;
  let pendingRecords = 0;

  (items || []).forEach((item) => {
    totalRecords++;
    const completed = isAdminCompletedItem(item);
    const draft = isDraftItem(item);
    const step = getCurrentStepValue(item);

    if (completed) completedRecords++;
    if (!completed && !draft) openRecords++;
    if (!completed && !draft && (step === IT_AGENT_STEP || step === IT_MANAGER_STEP)) {
      pendingRecords++;
    }
  });

  return { totalRecords, openRecords, completedRecords, pendingRecords };
}

export async function fetchAdminKpiFromVariables(kfInstance) {
  if (!kfInstance?.app?.getVariable) return null;

  const read = async (key) => {
    try {
      return await kfInstance.app.getVariable(key);
    } catch {
      return 0;
    }
  };

  const [userName, totalRecords, openRecords, completedRecords, pendingRecords] = await Promise.all([
    read(ADMIN_KPI_VARS.userName),
    read(ADMIN_KPI_VARS.totalRecords),
    read(ADMIN_KPI_VARS.openRecords),
    read(ADMIN_KPI_VARS.completedRecords),
    read(ADMIN_KPI_VARS.pendingRecords),
  ]);

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    userName: normalizeText(userName) || normalizeText(kfInstance?.user?.Name) || 'User',
    totalRecords: toNum(totalRecords),
    openRecords: toNum(openRecords),
    completedRecords: toNum(completedRecords),
    pendingRecords: toNum(pendingRecords),
  };
}

export async function fetchITAdminReportItems(kfInstance, page = 1, pageSize = 100) {
  const report = await fetchITServiceReport(kfInstance, page, pageSize);
  const items = extractItemsFromResponse(report);
  return { items, fromReportApi: items.length > 0 };
}

export function applyAdminFilters(rows, { search = '', statusTab = 'All' } = {}) {
  let list = rows.filter((row) => matchesAdminStatusTab(row, statusTab));
  const q = normalizeText(search).toLowerCase();
  if (!q) return list;
  return list.filter((row) =>
    [
      row.requestId, row.summary, row.ticketType, row.category, row.subCategory,
      row.currentStep, row.itemStatus, row.statusLabel, row.requesterName, row.requesterEmail,
      row.criticality, row.assignedTo,
    ].some((v) => String(v || '').toLowerCase().includes(q)),
  );
}
