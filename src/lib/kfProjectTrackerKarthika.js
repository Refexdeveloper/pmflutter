import { kf as globalKf } from '@/sdk/index.js';
import { kfMutateJson, fetchAllAdminProcessItems, isAuthError, isKissflowRateLimited } from './kfRuntime.js';
import { cacheKey, getCachedOrLoad } from './kfListCache.js';
import { submitPmCreateWebhook } from './pmCreateWebhook.js';

const PROJECTS_PATH =
  '/case-report/2/{acc}/Project_Management_A01/Your_Projects_A00';
const INDIVIDUAL_TASKS_PATH =
  '/process-report/2/{acc}/Project_Sub_Task_A01/My_Individual_Tasks_A00';
const TASK_PROGRESS_PATH =
  '/process/2/{acc}/Project_Sub_Task_A01/{id}/progress';
const PROJECT_TASKS_PATH =
  '/process-report/2/{acc}/Project_Sub_Task_A01/Live_Sub_Task_Task_Wise_A00';

export const SUBTASK_PROCESS_ID = 'Sub_Task_Process_A00';
export const TASK_PROCESS_ID = 'Project_Sub_Task_A01';
export const SUBTASK_POPUP_ID = 'Popup_RTfumy2xG_';

const ICON_COLORS = ['#1E88E5', '#43A047', '#8B5CF6', '#E53935', '#FB8C00', '#0084AD'];

function resolveKf(kfInstance) {
  const inst = kfInstance || globalKf || (typeof window !== 'undefined' ? window.kf : null);
  if (!inst?.account?._id) {
    throw new Error('Kissflow SDK not ready');
  }
  return inst;
}

function getFieldValue(row, columns, fieldId) {
  if (row && fieldId in row) return row[fieldId];

  const column = columns?.find(
    (col) => col.FieldId === fieldId || col.Id === fieldId,
  );
  if (!column) return null;
  return row[column.Id] ?? row[column.FieldId] ?? null;
}

function isBusinessTaskId(value) {
  const id = String(value ?? '').trim();
  if (!id) return false;
  return !id.startsWith('Pk');
}

function resolveTaskBusinessId(row, columns) {
  const ref = row?.Task_ID;
  const candidates = [
    row?.Subtaxk_id,
    row?.Task_ID_Formulated,
    row?.Task_ID_Hidden,
    row?.Project_Task_ID,
    typeof ref === 'string' ? ref : null,
    ref?.Subtaxk_id,
    ref?.Task_ID_Formulated,
    getFieldValue(row, columns, 'Subtaxk_id'),
    getFieldValue(row, columns, 'Task_ID_Formulated'),
    getFieldValue(row, columns, 'Task_ID_Hidden'),
    getFieldValue(row, columns, 'Project_Task_ID'),
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (isBusinessTaskId(value)) return value;
  }

  return '';
}

export function resolveTaskIdFromRow(row, columns) {
  return resolveTaskBusinessId(row, columns);
}

export function resolveSubtaskParentTaskId(row) {
  const hidden = String(row?.Task_ID_Hidden ?? '').trim();
  if (hidden) return hidden;

  const ref = row?.Task_ID;
  if (ref && typeof ref === 'object') {
    const fromRef = String(ref?.Subtaxk_id || ref?.Task_ID_Formulated || '').trim();
    if (fromRef) return fromRef;
  }

  return String(row?.Project_Task_ID ?? '').trim();
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getIconColor(seed) {
  return ICON_COLORS[hashString(String(seed)) % ICON_COLORS.length];
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

export function normalizeStatus(status) {
  if (!status) return 'In progress';

  const map = {
    Open: 'In progress',
    'In Progress': 'In progress',
    'In progress': 'In progress',
    Completed: 'Done',
    Complete: 'Done',
    Done: 'Done',
    Overdue: 'Overdue',
  };

  return map[status] || status;
}

function userToPerson(user) {
  if (!user?.Name) return null;
  return {
    l: user.Name.trim().charAt(0).toUpperCase(),
    c: getIconColor(user.Name),
    name: user.Name,
    email: user.Email,
  };
}

function mapProjectRow(row, columns) {
  const projectId = getFieldValue(row, columns, 'Project_ID') || row._id;
  const projectName = getFieldValue(row, columns, 'Project_Name') || 'Untitled project';
  const requester = getFieldValue(row, columns, 'Requester');
  const requesterPerson = userToPerson(requester);
  const progress = Number(getFieldValue(row, columns, 'Project_Objectives') ?? 0);
  const priority = getFieldValue(row, columns, 'Priority_1') || '—';
  const status = normalizeStatus(getFieldValue(row, columns, 'Status_1'));

  return {
    id: row._id,
    type: 'project',
    projectId,
    initials: getInitials(projectName),
    iconBg: getIconColor(projectName),
    name: projectName,
    category: getFieldValue(row, columns, 'Project_Category'),
    meta: null,
    status,
    priority,
    progress: Number.isFinite(progress) ? Math.round(progress) : 0,
    people: requesterPerson ? [requesterPerson] : [],
    extra: 0,
    peopleCount: requesterPerson ? 1 : 0,
    due: formatDate(getFieldValue(row, columns, 'End_Date')),
    startDate: getFieldValue(row, columns, 'Start_Date'),
    requester,
    children: [],
  };
}

function resolveProjectIdFromRow(row, columns) {
  const ref = row?.Project_ID ?? getFieldValue(row, columns, 'Project_ID');
  if (ref && typeof ref === 'object') {
    const fromRef = String(ref?.Project_ID || ref?._item_id || ref?._id || '').trim();
    if (fromRef && !fromRef.startsWith('Pk')) return fromRef;
  }

  const details = String(
    row?.Project_ID_Details ?? getFieldValue(row, columns, 'Project_ID_Details') ?? '',
  ).trim();
  if (details) return details;

  const flat = typeof ref === 'string' ? ref.trim() : '';
  if (flat && !flat.startsWith('Pk')) return flat;

  return '';
}

function mapIndividualTaskRow(row, columns) {
  const assignedTo = getFieldValue(row, columns, 'Assigned_To');
  const assignedPerson = userToPerson(assignedTo);
  const priority = getFieldValue(row, columns, 'Task_Priority') || '—';
  const status = normalizeStatus(getFieldValue(row, columns, 'Task_Status'));
  const taskId = resolveTaskBusinessId(row, columns);
  const projectId = resolveProjectIdFromRow(row, columns);

  return {
    id: row._id,
    type: 'task',
    taskId,
    taskBusinessId: taskId,
    projectId: projectId || null,
    name: getFieldValue(row, columns, 'Sub_Task_Name') || row?.Name || 'Untitled task',
    meta: taskId || null,
    status,
    priority,
    progress: null,
    people: assignedPerson ? [assignedPerson] : [],
    extra: 0,
    peopleCount: assignedPerson ? 1 : 0,
    due: formatDate(getFieldValue(row, columns, 'End_Date')),
    assignedTo,
    children: [],
  };
}

function mapSubtaskRow(row) {
  const parentTaskBusinessId = resolveSubtaskParentTaskId(row);
  const named = String(
    row?.Sub_task_Name || row?.Sub_Task_Name || row?.Subtask_Name || '',
  ).trim();
  const summary = String(row?.SubTask_Summary || '').trim();
  const systemName = String(row?.Name || '').trim();
  const isProcessLabel = /^sub[-\s]?task process from\b/i.test(systemName);
  const displayName =
    named ||
    summary ||
    (!isProcessLabel && systemName && !/^Pk[A-Za-z0-9]+$/.test(systemName) ? systemName : '') ||
    'Untitled subtask';
  const assigneeName = String(row?.Assignee_1?.Name || '').trim();
  const createdByName = String(row?._created_by?.Name || '').trim();
  const assigneePerson = userToPerson(row?.Assignee_1);

  return {
    id: row._id,
    type: 'subtask',
    parentTaskBusinessId,
    /** Prefer Sub_task_Name (form), then SubTask_Summary — Name is often a process label. */
    name: displayName,
    summary: summary || named || null,
    subtaskName: displayName,
    assigneeName: assigneeName || '—',
    createdBy: createdByName || '—',
    meta: [assigneeName && `Assignee ${assigneeName}`, createdByName && `Created by ${createdByName}`]
      .filter(Boolean)
      .join(' · ') || null,
    status: normalizeStatus(row?._status),
    priority: '—',
    progress: String(row?._status || '').toLowerCase().includes('complete') ? 100 : null,
    people: assigneePerson ? [assigneePerson] : [],
    extra: 0,
    peopleCount: assigneePerson ? 1 : 0,
    due: formatDate(row?._created_at),
    activityInstanceId: Array.isArray(row?._activity_instance_id)
      ? row._activity_instance_id[0]
      : row?._activity_instance_id || null,
    children: [],
    raw: row,
  };
}

async function fetchReport(kfInstance, path, query) {
  const kf = resolveKf(kfInstance);
  const accId = kf.account._id;
  const queryString = new URLSearchParams({
    apply_preference: 'true',
    ...query,
  }).toString();

  const url = `${path.replace('{acc}', accId)}?${queryString}`;
  return kf.api(url, { method: 'GET' });
}

export async function fetchMyProjects(kfInstance) {
  const kf = resolveKf(kfInstance);
  const userEmail = kf?.user?.Email || kf?.user?.email;
  if (!userEmail) {
    return { items: [], columns: [], raw: null };
  }
  const response = await fetchReport(kf, PROJECTS_PATH, {
    $current_email: userEmail,
  });

  return {
    items: (response?.Data || []).map((row) => mapProjectRow(row, response.Columns)),
    columns: response?.Columns || [],
    raw: response,
  };
}

export async function fetchMyIndividualTasks(kfInstance) {
  const kf = resolveKf(kfInstance);
  const userEmail = kf?.user?.Email || kf?.user?.email;
  if (!userEmail) {
    return { items: [], columns: [], raw: null };
  }
  const response = await fetchReport(kf, INDIVIDUAL_TASKS_PATH, {
    $created_by_flat_field_email: userEmail,
  });

  return {
    items: (response?.Data || []).map((row) => mapIndividualTaskRow(row, response.Columns)),
    columns: response?.Columns || [],
    raw: response,
  };
}

export function parseIndividualTaskProgress(response) {
  const startStep = response?.Steps?.find((step) => step.Name === 'Start');

  if (!response?._id) {
    throw new Error('Task instance id not found in progress response');
  }

  if (!startStep?._activity_instance_id) {
    throw new Error('Start step activity instance id not found');
  }

  return {
    instanceId: response._id,
    activityInstanceId: startStep._activity_instance_id,
    startStep,
    progress: Number(response._progress ?? 0),
    processStatus: response._status,
    raw: response,
  };
}

export async function fetchIndividualTaskProgress(taskId, kfInstance) {
  const kf = resolveKf(kfInstance);
  const accId = kf.account._id;
  const apiUrl = TASK_PROGRESS_PATH.replace('{acc}', accId).replace('{id}', taskId);

  try {
    const rawResponse = await kf.api(apiUrl, { method: 'GET' });
    const parsed = parseIndividualTaskProgress(rawResponse);

    return {
      ...parsed,
      taskId,
      apiUrl,
    };
  } catch (error) {
    throw new Error(
      `Progress API failed for ${taskId}: ${error?.message || 'Unknown error'}`,
    );
  }
}

export async function fetchProjectTasks(projectId, kfInstance) {
  const kf = resolveKf(kfInstance);
  const userEmail = kf.user.Email;
  const response = await fetchReport(kf, PROJECT_TASKS_PATH, {
    $created_by_flat_field_email: userEmail,
    $project_id_details: projectId,
  });

  const items = (response?.Data || []).map((row) =>
    mapIndividualTaskRow(row, response.Columns),
  );

  return {
    items,
    columns: response?.Columns || [],
    raw: response,
  };
}

export async function fetchAllSubtasks(kfInstance) {
  const kf = resolveKf(kfInstance);
  const accId = kf.account._id;
  try {
    const rows = await getCachedOrLoad(cacheKey('admin-subtasks', accId, '0'), () =>
      fetchAllAdminProcessItems(kf, SUBTASK_PROCESS_ID, {
        applyPreference: false,
        accountId: accId,
      }),
    );
    return {
      items: rows.map((row) => mapSubtaskRow(row)),
      raw: null,
    };
  } catch (error) {
    if (isAuthError(error) || isKissflowRateLimited(error)) {
      return { items: [], raw: null };
    }
    console.warn('fetchAllSubtasks failed', error?.message || error);
    return { items: [], raw: null };
  }
}

export function filterSubtasksForTask(allSubtasks, taskBusinessId) {
  const key = String(taskBusinessId || '').trim();
  if (!key) return [];
  return (allSubtasks || []).filter((item) => item.parentTaskBusinessId === key);
}

export function attachSubtaskCounts(tasks, allSubtasks) {
  return (tasks || []).map((task) => {
    const count = filterSubtasksForTask(allSubtasks, task.taskId || task.taskBusinessId).length;
    const taskIdLabel = task.taskId || task.taskBusinessId || '';
    const countLabel = count > 0 ? `${count} subtask${count === 1 ? '' : 's'}` : '';
    const meta = [taskIdLabel, countLabel].filter(Boolean).join(' · ') || null;

    return {
      ...task,
      meta,
    };
  });
}

function unwrapKfCreateResponse(resp) {
  const layer1 = resp?.data ?? resp ?? {};
  const layer2 = layer1?.data ?? layer1;
  return layer2 && typeof layer2 === 'object' ? layer2 : layer1;
}

function parseProcessCreateIds(resp) {
  const data = unwrapKfCreateResponse(resp);
  const instanceId = String(data?._id || '').trim();
  const activityRaw = data?._activity_instance_id ?? data?.activityInstanceId;
  const activityInstanceId = Array.isArray(activityRaw)
    ? String(activityRaw[0] || '').trim()
    : String(activityRaw || '').trim();

  return { instanceId, activityInstanceId, raw: data };
}

function resolveProcess(kfInstance, processModelId) {
  const kf = kfInstance || globalKf;
  return (
    kf?.app?.getProcess?.(processModelId) ||
    kf?.getProcess?.(processModelId) ||
    kf?.process?.[processModelId] ||
    null
  );
}

async function postProcessDraft(kfInstance, processModelId, body, entityLabel) {
  const kf = resolveKf(kfInstance);
  const path = `/process/2/${kf.account._id}/${processModelId}`;

  const raw = await kfMutateJson(kf, path, {
    method: 'POST',
    body,
    preferSessionAuth: true,
  });

  const { instanceId, activityInstanceId, raw: parsedRaw } = parseProcessCreateIds(raw);

  if (parsedRaw?.status === 'error' || parsedRaw?.error_code) {
    throw new Error(parsedRaw.en_message || parsedRaw.message || 'Kissflow request failed');
  }

  if (!instanceId || !activityInstanceId) {
    throw new Error(`${entityLabel} create API did not return instance and activity ids`);
  }

  return { instanceId, activityInstanceId, raw: parsedRaw };
}

async function openProcessDraft(kfInstance, processModelId, processLabel, instanceId, activityInstanceId) {
  const kf = resolveKf(kfInstance);
  const process = resolveProcess(kf, processModelId);

  if (!process?.openForm) {
    throw new Error(`Cannot open ${processLabel} draft — openForm not available in SDK.`);
  }

  await process.openForm({
    _id: instanceId,
    _activity_instance_id: activityInstanceId,
  });
}

/**
 * Send a subtask to the Kissflow integration. Does not create a process draft as the access-key user.
 */
export async function createSubtaskInstance(kfInstance, taskIdHidden) {
  const taskId = String(taskIdHidden || '').trim();
  if (!taskId) {
    throw new Error('Missing task id for subtask creation');
  }
  const webhook = await submitPmCreateWebhook(kfInstance, 'subtask', {
    fields: { Task_ID_Hidden: taskId },
    required: true,
  });
  return { instanceId: '', activityInstanceId: '', raw: webhook, webhookOnly: true };
}

/**
 * Send a task to the Kissflow integration. Does not create a process draft as the access-key user.
 */
export async function createTaskInstance(kfInstance, projectIdHidden) {
  const projectId = String(projectIdHidden || '').trim();
  if (!projectId) {
    throw new Error('Missing project id for task creation');
  }
  const webhook = await submitPmCreateWebhook(kfInstance, 'task', {
    fields: { Project_ID_Hidden: projectId },
    required: true,
  });
  return { instanceId: '', activityInstanceId: '', raw: webhook, webhookOnly: true };
}

export function resolveSubtaskProcess(kfInstance) {
  return resolveProcess(kfInstance, SUBTASK_PROCESS_ID);
}

export function resolveTaskProcess(kfInstance) {
  return resolveProcess(kfInstance, TASK_PROCESS_ID);
}

export async function openSubtaskDraft(kfInstance, instanceId, activityInstanceId) {
  return openProcessDraft(
    kfInstance,
    SUBTASK_PROCESS_ID,
    'Sub_Task_Process_A00',
    instanceId,
    activityInstanceId,
  );
}

export async function openTaskDraft(kfInstance, instanceId, activityInstanceId) {
  return openProcessDraft(
    kfInstance,
    TASK_PROCESS_ID,
    'Project_Sub_Task_A01',
    instanceId,
    activityInstanceId,
  );
}
