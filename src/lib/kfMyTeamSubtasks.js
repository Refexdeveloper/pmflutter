/**
 * My Team subtasks — Kissflow process-report
 * /process-report/2/{account}/Sub_Task_Process_A00/MyTeam_A00
 *
 * Same manager-scoping pattern as My Team tasks (My_Team_A04).
 */

import { kfGetJson, resolveKissflowAccountId, isKissflowRateLimited, isAuthError } from './kfRuntime.js';
import { fmtDate, parseKfDate, toInitials } from './kfProjectDashboard.js';
import { mapSubtaskRag } from './kfSubtaskTracker.js';
import {
  normalizeProcessReportResponse,
  filterTasksByManagerEmail,
  filterTasksByAllowedProjects,
} from './kfMyTeamTasks.js';

const DEFAULT_ACCOUNT_ID = 'AcCMptlq60zH';
export const MY_TEAM_SUBTASK_PROCESS_ID = 'Sub_Task_Process_A00';
export const MY_TEAM_SUBTASK_REPORT_ID = 'MyTeam_A00';

function toText(val) {
  if (val == null) return '';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val).trim();
  }
  if (Array.isArray(val)) {
    return val
      .map((x) => (typeof x === 'object' ? x?.Name ?? x?.name ?? x?.Value ?? x?.value ?? '' : x))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof val === 'object') {
    return String(val.Name ?? val.name ?? val.Value ?? val.value ?? val.Email ?? val.email ?? '').trim();
  }
  return String(val).trim();
}

function extractPerson(val) {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    const name = toText(val);
    return { name, id: '', email: '' };
  }
  return {
    name: String(val.Name || val.name || '').trim(),
    id: String(val._id || val.Id || val.id || '').trim(),
    email: String(val.Email || val.email || '').trim(),
  };
}

function buildFieldMaps(columns) {
  const fieldToColumnId = {};
  const columnIdToField = {};
  for (const col of columns || []) {
    if (col?.FieldId && col?.Id) {
      fieldToColumnId[col.FieldId] = col.Id;
      columnIdToField[col.Id] = col.FieldId;
    }
  }
  return { fieldToColumnId, columnIdToField };
}

function readRowField(row, fieldId, fieldToColumnId, columnIdToField) {
  const colId = fieldToColumnId[fieldId];
  if (colId && row[colId] != null) return row[colId];
  if (row[fieldId] != null) return row[fieldId];
  for (const [cid, fid] of Object.entries(columnIdToField)) {
    if (fid === fieldId && row[cid] != null) return row[cid];
  }
  return null;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function readEmailField(val) {
  if (val == null || val === '') return '';
  if (typeof val === 'string') return normalizeEmail(val);
  if (typeof val === 'object' && !Array.isArray(val)) {
    const candidates = [val.Email, val.email, val.Value, val.value, val.Name, val.name];
    for (const c of candidates) {
      const s = String(c || '').trim();
      if (s.includes('@')) return normalizeEmail(s);
    }
  }
  return normalizeEmail(toText(val));
}

function collectProjectIdVariants(...values) {
  const out = [];
  const seen = new Set();
  const push = (v) => {
    const s = String(v || '').trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  for (const value of values) {
    if (value == null || value === '') continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      push(value._item_id);
      push(value._id);
      push(value.Project_ID);
      push(value.Project_Id);
      push(value.projectId);
      push(value.Id);
      push(value.id);
    } else {
      push(value);
    }
  }
  return out;
}

function resolveParentTask(read) {
  const taskRef = read('Task_ID') || read('Parent_Task') || read('Parent_Task_ID');
  let parentTaskName = '';
  let parentTaskId = '';
  if (taskRef && typeof taskRef === 'object' && !Array.isArray(taskRef)) {
    // Parent task display = Task_ID.Sub_Task_Name (e.g. "alpha"), then Name.
    parentTaskName = String(
      taskRef.Sub_Task_Name || taskRef.Sub_task_Name || taskRef.Task_Name || taskRef.Name || taskRef.name || '',
    ).trim();
    parentTaskId = String(
      taskRef.Subtaxk_id || taskRef.Task_ID_Formulated || taskRef._id || taskRef.Id || '',
    ).trim();
  }
  if (!parentTaskName) {
    parentTaskName =
      toText(read('Parent_Task_Name')) ||
      toText(read('Task_Name')) ||
      toText(read('Sub_Task_Name_1')) ||
      '';
  }
  if (!parentTaskId) {
    parentTaskId =
      toText(read('Parent_Task_ID')) ||
      toText(read('Task_ID_Formulated')) ||
      toText(read('Project_Task_ID')) ||
      '';
  }
  return {
    parentTaskName: parentTaskName || '—',
    parentTaskId: parentTaskId || '—',
  };
}

/** Map a MyTeam_A00 report row into hub-compatible subtask shape. */
export function mapMyTeamSubtaskRow(row, columns) {
  if (!row || typeof row !== 'object') return null;

  const { fieldToColumnId, columnIdToField } = buildFieldMaps(columns);
  const read = (fieldId) => readRowField(row, fieldId, fieldToColumnId, columnIdToField);

  const externalEmail =
    toText(read('externalemail')) ||
    toText(read('Assignee_Email_Extracted')) ||
    toText(read('assignee_email'));
  const assigneeFromFields = extractPerson(read('Assignee_1'));
  const assigneeAssigned = extractPerson(read('Assigned_To'));
  const assigneeCurrent = extractPerson(read('_current_assigned_to'));
  const assigneeUser =
    (assigneeFromFields.name && assigneeFromFields) ||
    (assigneeAssigned.name && assigneeAssigned) ||
    (assigneeCurrent.name && assigneeCurrent) ||
    null;
  const assignee = {
    name: assigneeUser?.name || externalEmail || '',
    id: assigneeUser?.id || '',
    email: assigneeUser?.email || externalEmail || '',
  };

  const projectRef = read('Project_ID');
  const projectIds = collectProjectIdVariants(
    projectRef,
    read('Project_ID_1'),
    read('Project_ID_Hidden'),
    read('Project_ID__Reference'),
  );
  const projectId = projectIds[0] || toText(projectRef) || '';

  const named =
    toText(read('Sub_task_Name')) ||
    toText(read('Sub_Task_Name')) ||
    toText(read('Subtask_Name')) ||
    toText(read('Name')) ||
    '';
  const summary = toText(read('SubTask_Summary')) || named;
  const subtaskName = named || summary || 'Untitled subtask';

  const status =
    toText(read('TStatus')) ||
    toText(read('_status')) ||
    toText(read('Task_Status')) ||
    toText(read('Status')) ||
    toText(read('Subtask_Status')) ||
    '—';

  const priority =
    toText(read('Sub_task_Priority')) ||
    toText(read('Sub_Task_Priority')) ||
    toText(read('Task_Priority')) ||
    toText(read('Priority')) ||
    '—';

  const parent = resolveParentTask(read);
  const createdRaw = read('_created_at') || row?._created_at;
  const created = parseKfDate(createdRaw);
  const now = new Date();
  const agingDays = created
    ? Math.max(0, Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)))
    : Number(read('Aging_Days') ?? 0) || 0;

  const instanceId =
    toText(read('Instance_ID')) ||
    String(row._id || '').trim();
  const activityId = toText(read('Activity_Instance_ID')) || toText(row._activity_instance_id);
  const businessId =
    toText(read('Subtaxk_id')) ||
    toText(read('Subtask_ID')) ||
    instanceId;

  const delayRaw = Number(read('Delay_Days') ?? 0);
  const delayDays = Number.isFinite(delayRaw) && delayRaw > 0 ? delayRaw : 0;

  const mapped = {
    id: businessId || instanceId || `SUB-${Math.random().toString(36).slice(2, 8)}`,
    subtaskName,
    summary: summary || '—',
    parentTaskName: parent.parentTaskName,
    parentTaskId: parent.parentTaskId,
    parentTaskBusinessId: parent.parentTaskId !== '—' ? parent.parentTaskId : '',
    projectId: projectId || '—',
    projectIds,
    projectName:
      toText(read('Project_Name')) ||
      toText(read('Application_Name')) ||
      (projectRef && typeof projectRef === 'object'
        ? String(projectRef.Project_Name || projectRef.Name || '').trim()
        : '') ||
      '—',
    projectTaskId: toText(read('Project_Task_ID')) || '—',
    boardId: toText(read('Board_ID')) || '—',
    processId: toText(read('Process_ID')) || MY_TEAM_SUBTASK_PROCESS_ID,
    assignedTo: assignee?.name || '—',
    assignee: assignee?.name || '—',
    assigneeId: assignee?.id || '',
    assigneeEmail: assignee?.email || '',
    assignedToEmail: assignee?.email || '',
    externalemail: externalEmail || assignee?.email || '',
    assigneeAvatar: toInitials(assignee?.name || ''),
    createdBy: (() => {
      const createdByVal = read('_created_by');
      if (createdByVal && typeof createdByVal === 'object') {
        return String(createdByVal.Name || createdByVal.name || '').trim() || '—';
      }
      return toText(createdByVal) || '—';
    })(),
    createdDate: fmtDate(created) || '—',
    startDate: fmtDate(parseKfDate(read('Start_Date'))) || '—',
    endDate:
      fmtDate(parseKfDate(read('Actual_End_Date_1'))) ||
      fmtDate(parseKfDate(read('End_Date'))) ||
      '—',
    priority,
    companyName: toText(read('Company_Name')) || toText(read('Entity')) || '—',
    lineOfBusiness: toText(read('Project_Category')) || toText(read('Functions')) || '—',
    agingDays: Number.isFinite(agingDays) ? agingDays : 0,
    delayDays,
    status,
    workflowStatus: toText(read('_status')) || '—',
    InstanceID: instanceId,
    ActivityID: activityId,
    _id: instanceId || row._id,
    _activity_instance_id: activityId || row._activity_instance_id,
    createdByEmail: toText(read('Created_by_flat_field_email')),
    l1ManagerEmail: readEmailField(read('L1_Manager_Email') || read('Final_L1_Manager_Email')),
    l2ManagerEmail: readEmailField(read('L2_Manager_Email') || read('Final_L2_Manager_Email')),
    raw: { ...row, externalemail: externalEmail || row.externalemail },
  };

  return { ...mapped, rag: mapSubtaskRag(mapped) };
}

function dedupeSubtasksById(subtasks) {
  const seen = new Set();
  const out = [];
  for (const row of Array.isArray(subtasks) ? subtasks : []) {
    const key = String(row?.InstanceID || row?.id || '').trim() || JSON.stringify(row?.subtaskName);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(row);
  }
  return out;
}

export function mapMyTeamSubtasksResponse(response, options = {}) {
  const normalized = normalizeProcessReportResponse(response);
  const columns = normalized.Columns;
  const data = normalized.Data;
  const loggedInEmail = normalizeEmail(options?.loggedInEmail || options?.managerEmail);
  const allowedProjectIds = options?.allowedProjectIds;
  const trustApiScope = Boolean(options?.trustApiScope);

  let subtasks = data
    .map((row) => mapMyTeamSubtaskRow(row, columns))
    .filter((t) => t && (t.id || (t.subtaskName && t.subtaskName !== 'Untitled subtask')));

  if (!loggedInEmail) {
    return {
      columns,
      subtasks: trustApiScope ? subtasks : [],
      reportName: normalized.Name || 'My Team',
    };
  }

  const hasManagerFields = subtasks.some(
    (t) => normalizeEmail(t?.l1ManagerEmail) || normalizeEmail(t?.l2ManagerEmail),
  );

  // Reuse task filters — they key off l1/l2 + projectIds/projectId.
  const byEmail = hasManagerFields ? filterTasksByManagerEmail(subtasks, loggedInEmail) : [];
  const byProject = allowedProjectIds ? filterTasksByAllowedProjects(subtasks, allowedProjectIds) : [];

  if (hasManagerFields || allowedProjectIds) {
    // Same as tasks: L1/L2 and/or manager-scoped projects only — never keep unscoped API rows.
    subtasks = dedupeSubtasksById([...byEmail, ...byProject]);
  } else if (!trustApiScope) {
    subtasks = [];
  }

  return {
    columns,
    subtasks,
    reportName: normalized.Name || 'My Team',
  };
}

export function buildMyTeamSubtasksReportPath(kfInstance, options = {}) {
  const accountId =
    resolveKissflowAccountId(kfInstance, DEFAULT_ACCOUNT_ID) || DEFAULT_ACCOUNT_ID;
  const managerEmail = String(options?.managerEmail || options?.loggedInEmail || '').trim();
  const variant = options?.variant || 'final'; // 'final' | 'field' | 'bare'
  const paginate = Boolean(options?.paginate);

  const base = `/process-report/2/${accountId}/${MY_TEAM_SUBTASK_PROCESS_ID}/${encodeURIComponent(MY_TEAM_SUBTASK_REPORT_ID)}`;

  if (variant === 'bare' || !managerEmail) {
    if (!paginate) return `${base}?`;
    const params = new URLSearchParams();
    params.set('apply_preference', 'true');
    params.set('page_number', '1');
    params.set('page_size', '1000');
    return `${base}?${params.toString()}`;
  }

  const enc = encodeURIComponent(managerEmail);
  const params = new URLSearchParams();
  params.set('apply_preference', '1');
  if (paginate) {
    params.set('page_number', '1');
    params.set('page_size', '1000');
  }

  const mgr =
    variant === 'field'
      ? `$l1_manager_email=${enc}&$l2_manager_email=${enc}`
      : `$final_l1_manager_email=${enc}&$final_l2_manager_email=${enc}`;

  return `${base}?${params.toString()}&${mgr}`;
}

/**
 * Fetch My Team subtasks scoped to the logged-in manager.
 * Pass allowedProjectIds from manager-scoped projects so rows without L1/L2 still appear.
 */
export async function fetchMyTeamSubtasks(kfInstance, options = {}) {
  if (!kfInstance?.api) {
    throw new Error('Kissflow SDK not ready — open this page inside Kissflow.');
  }

  const loggedInEmail = String(
    options?.loggedInEmail ||
      options?.managerEmail ||
      kfInstance?.user?.Email ||
      kfInstance?.user?.email ||
      '',
  ).trim();

  if (!loggedInEmail) {
    console.warn('My Team subtasks: no logged-in email — returning empty');
    return mapMyTeamSubtasksResponse({ Columns: [], Data: [] }, {});
  }

  const allowedProjectIds = options?.allowedProjectIds
    ? options.allowedProjectIds instanceof Set
      ? options.allowedProjectIds
      : new Set(options.allowedProjectIds)
    : null;

  const attempts = [
    { path: buildMyTeamSubtasksReportPath(kfInstance, { managerEmail: loggedInEmail, variant: 'final', paginate: true }), trustApiScope: true },
    { path: buildMyTeamSubtasksReportPath(kfInstance, { managerEmail: loggedInEmail, variant: 'final' }), trustApiScope: true },
    { path: buildMyTeamSubtasksReportPath(kfInstance, { managerEmail: loggedInEmail, variant: 'field', paginate: true }), trustApiScope: true },
    { path: buildMyTeamSubtasksReportPath(kfInstance, { managerEmail: loggedInEmail, variant: 'field' }), trustApiScope: true },
    { path: buildMyTeamSubtasksReportPath(kfInstance, { variant: 'bare', paginate: true }), trustApiScope: false },
  ];

  const seen = new Set();
  let lastError = null;
  let lastEmpty = null;

  for (const attempt of attempts) {
    if (!attempt.path || seen.has(attempt.path)) continue;
    seen.add(attempt.path);
    try {
      const resp = await kfGetJson(kfInstance, attempt.path);
      const mapped = mapMyTeamSubtasksResponse(resp, {
        loggedInEmail,
        allowedProjectIds,
        trustApiScope: attempt.trustApiScope,
      });
      console.info('My Team subtasks report', {
        path: attempt.path,
        mapped: mapped.subtasks.length,
        allowedProjects: allowedProjectIds ? allowedProjectIds.size : null,
        trustApiScope: attempt.trustApiScope,
      });
      if (mapped.subtasks.length > 0) return mapped;
      lastEmpty = mapped;
    } catch (e) {
      lastError = e;
      console.warn('My Team subtasks report fetch failed:', attempt.path, e?.message || e);
      if (isKissflowRateLimited(e) || isAuthError(e)) break;
    }
  }

  if (lastEmpty) return lastEmpty;
  if (lastError) throw lastError;
  return mapMyTeamSubtasksResponse({ Columns: [], Data: [] }, { loggedInEmail, allowedProjectIds });
}
