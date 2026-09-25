/**
 * My Team tasks — Kissflow process-report
 * /process-report/2/{account}/Project_Sub_Task_A01/My_Team_A04
 *
 * Scoped to the logged-in manager via L1/L2 email and/or manager-scoped project ids.
 */

import { kfGetJson, resolveKissflowAccountId, isKissflowRateLimited, isAuthError } from './kfRuntime.js';
import { fmtDate, parseKfDate, toInitials } from './kfProjectDashboard.js';

const DEFAULT_ACCOUNT_ID = 'AcCMptlq60zH';
export const MY_TEAM_TASK_PROCESS_ID = 'Project_Sub_Task_A01';
export const MY_TEAM_TASK_REPORT_ID = 'My_Team_A04';

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

/** Unwrap kf.api / nested payloads to { Columns, Data, Name }. */
export function normalizeProcessReportResponse(raw) {
  if (!raw || typeof raw !== 'object') return { Columns: [], Data: [], Name: 'My Team' };

  const candidates = [raw, raw.data, raw.Data, raw.result, raw.payload, raw.response];
  for (const c of candidates) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) continue;
    if (Array.isArray(c.Columns) || Array.isArray(c.Data)) {
      return {
        Columns: Array.isArray(c.Columns) ? c.Columns : [],
        Data: Array.isArray(c.Data) ? c.Data : [],
        Name: c.Name ?? c.Id ?? 'My Team',
        Id: c.Id,
      };
    }
  }

  if (Array.isArray(raw) && raw.length && typeof raw[0] === 'object') {
    return { Columns: [], Data: raw, Name: 'My Team' };
  }

  return { Columns: [], Data: [], Name: 'My Team' };
}

function resolveProjectFromRef(projectRef, fallbacks = {}) {
  const variants = collectProjectIdVariants(
    projectRef,
    fallbacks.projectId,
    fallbacks.displayId,
    fallbacks.hiddenId,
  );
  let projectName = '';
  if (projectRef && typeof projectRef === 'object' && !Array.isArray(projectRef)) {
    projectName = String(
      projectRef.Project_Name || projectRef.Name || projectRef.name || '',
    ).trim();
  }
  if (!projectName) projectName = String(fallbacks.projectName || '').trim();

  return {
    projectId: variants[0] || '',
    projectIds: variants,
    projectName,
    displayId: variants.find((id) => id.includes('-FY') || id.length > 12) || variants[0] || '',
  };
}

export function mapMyTeamTaskRow(row, columns) {
  if (!row || typeof row !== 'object') return null;

  const { fieldToColumnId, columnIdToField } = buildFieldMaps(columns);
  const read = (fieldId) => readRowField(row, fieldId, fieldToColumnId, columnIdToField);

  const assigneeRef = extractPerson(read('Assigned_To'));
  const projectRef = read('Project_ID');
  const projectDetails = read('Project_Details');
  const project = resolveProjectFromRef(projectRef, {
    projectId: toText(read('Project_ID_1')),
    hiddenId: toText(read('Project_ID_Hidden')) || toText(read('Project_ID__Reference')),
    projectName:
      (projectDetails && typeof projectDetails === 'object'
        ? String(projectDetails.Project_Name || projectDetails.Name || '').trim()
        : '') || toText(read('Application_Name')),
    displayId: toText(read('Project_ID_Details')),
  });
  if (!project.projectName && projectDetails && typeof projectDetails === 'object') {
    project.projectName = String(projectDetails.Project_Name || projectDetails.Name || '').trim();
  }

  const delayRaw = Number(read('Delay_Days') ?? 0);
  const delayDays = Number.isFinite(delayRaw) && delayRaw > 0 ? delayRaw : 0;
  const agingDays = Number(read('Aging_Days') ?? 0);

  const taskBusinessId =
    toText(read('Task_ID_Formulated')) ||
    toText(read('Subtaxk_id')) ||
    String(row._id || '').trim();

  const instanceId = toText(read('Instance_ID')) || String(row._id || '').trim();
  const activityId = toText(read('Activity_Instance_ID'));

  const name = toText(read('Sub_Task_Name')) || '—';
  const status = toText(read('Task_Status')) || '—';
  const priority = toText(read('Task_Priority')) || 'Medium';
  const start = fmtDate(parseKfDate(read('Start_Date'))) || '—';
  const plannedEnd = fmtDate(parseKfDate(read('End_Date'))) || '';
  const actualEnd = fmtDate(parseKfDate(read('Actual_End_Date_1'))) || '';
  const end = actualEnd || plannedEnd || '—';
  // Case report has no revision timeline; differing planned vs actual end ≈ 1 revision.
  const hasRevision = Boolean(actualEnd && plannedEnd && actualEnd !== plannedEnd);
  const revisedCount = hasRevision ? 1 : 0;

  return {
    id: taskBusinessId,
    InstanceID: instanceId,
    ActivityID: activityId,
    projectId: project.projectId || project.displayId,
    projectIds: project.projectIds,
    project: project.projectName || project.displayId || '—',
    name,
    assignee: assigneeRef.name || '—',
    assigneeId: assigneeRef.id,
    assigneeEmail: assigneeRef.email,
    initials: toInitials(assigneeRef.name),
    start,
    end,
    originalEndDate: plannedEnd || null,
    revisedEndDate: hasRevision ? actualEnd : null,
    revisedCount,
    hasRevision,
    agingDays: Number.isFinite(agingDays) ? agingDays : 0,
    delayDays,
    delay: delayDays > 0 ? `+${delayDays}d` : 'On time',
    priority,
    status,
    companyName: toText(read('Company_Name')) || toText(read('Entity')) || '',
    lineOfBusiness: toText(read('Project_Category')) || toText(read('Functions')) || '',
    functionType: toText(read('Function_Type')) || '',
    createdByEmail: toText(read('Created_by_flat_field_email')),
    l1ManagerEmail: readEmailField(read('L1_Manager_Email') || read('Final_L1_Manager_Email')),
    l2ManagerEmail: readEmailField(read('L2_Manager_Email') || read('Final_L2_Manager_Email')),
    createdAt: fmtDate(parseKfDate(read('_created_at') || row?._created_at)),
    raw: {
      ...row,
      Assigned_To: read('Assigned_To'),
      _id: instanceId || row._id,
      _activity_instance_id: activityId || undefined,
      Task_Priority: priority,
    },
  };
}

/** Keep rows where logged-in email matches L1 or L2 when those fields exist on the row. */
export function filterTasksByManagerEmail(tasks, loggedInEmail) {
  const me = normalizeEmail(loggedInEmail);
  if (!me) return [];
  const list = Array.isArray(tasks) ? tasks : [];
  return list.filter((t) => {
    const l1 = normalizeEmail(t?.l1ManagerEmail);
    const l2 = normalizeEmail(t?.l2ManagerEmail);
    return (l1 && l1 === me) || (l2 && l2 === me);
  });
}

/** Keep tasks linked to manager-scoped project ids (when task rows lack L1/L2). */
export function filterTasksByAllowedProjects(tasks, allowedProjectIds) {
  const allowed = allowedProjectIds instanceof Set
    ? allowedProjectIds
    : new Set(Array.isArray(allowedProjectIds) ? allowedProjectIds : []);
  if (allowed.size === 0) return [];
  return (Array.isArray(tasks) ? tasks : []).filter((t) => {
    const ids = [
      ...(Array.isArray(t?.projectIds) ? t.projectIds : []),
      t?.projectId,
      t?.raw?.Project_ID_Hidden,
      t?.raw?._project_id,
    ]
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    return ids.some((id) => allowed.has(id));
  });
}

function dedupeTasksById(tasks) {
  const seen = new Set();
  const out = [];
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const key = String(task?.id || task?.InstanceID || '').trim() || JSON.stringify(task?.name);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(task);
  }
  return out;
}

export function mapMyTeamTasksResponse(response, options = {}) {
  const normalized = normalizeProcessReportResponse(response);
  const columns = normalized.Columns;
  const data = normalized.Data;
  const loggedInEmail = normalizeEmail(options?.loggedInEmail || options?.managerEmail);
  const allowedProjectIds = options?.allowedProjectIds;
  const trustApiScope = Boolean(options?.trustApiScope);

  let tasks = data
    .map((row) => mapMyTeamTaskRow(row, columns))
    .filter((t) => t && (t.id || (t.name && t.name !== '—')));

  if (!loggedInEmail) {
    return {
      columns,
      tasks: trustApiScope ? tasks : [],
      reportName: normalized.Name || 'My Team',
    };
  }

  const hasManagerFields = tasks.some(
    (t) => normalizeEmail(t?.l1ManagerEmail) || normalizeEmail(t?.l2ManagerEmail),
  );

  const byEmail = hasManagerFields ? filterTasksByManagerEmail(tasks, loggedInEmail) : [];
  const byProject = allowedProjectIds ? filterTasksByAllowedProjects(tasks, allowedProjectIds) : [];

  if (hasManagerFields || allowedProjectIds) {
    // Union: L1/L2 email matches AND tasks on already-filtered manager projects.
    // Never keep the unscoped API payload when both filters yield nothing.
    tasks = dedupeTasksById([...byEmail, ...byProject]);
  } else if (!trustApiScope) {
    tasks = [];
  }

  return {
    columns,
    tasks,
    reportName: normalized.Name || 'My Team',
  };
}

export function buildMyTeamTasksReportPath(kfInstance, options = {}) {
  const accountId =
    resolveKissflowAccountId(kfInstance, DEFAULT_ACCOUNT_ID) || DEFAULT_ACCOUNT_ID;
  const managerEmail = String(options?.managerEmail || options?.loggedInEmail || '').trim();
  const variant = options?.variant || 'final'; // 'final' | 'field' | 'bare'
  const paginate = Boolean(options?.paginate);

  const base = `/process-report/2/${accountId}/${MY_TEAM_TASK_PROCESS_ID}/${encodeURIComponent(MY_TEAM_TASK_REPORT_ID)}`;

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
 * Fetch My Team tasks scoped to the logged-in manager.
 * Pass allowedProjectIds from manager-scoped projects so tasks without L1/L2 still appear.
 */
export async function fetchMyTeamTasks(kfInstance, options = {}) {
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
    console.warn('My Team tasks: no logged-in email — returning empty');
    return mapMyTeamTasksResponse({ Columns: [], Data: [] }, {});
  }

  const allowedProjectIds = options?.allowedProjectIds
    ? options.allowedProjectIds instanceof Set
      ? options.allowedProjectIds
      : new Set(options.allowedProjectIds)
    : null;

  const attempts = [
    { path: buildMyTeamTasksReportPath(kfInstance, { managerEmail: loggedInEmail, variant: 'final', paginate: true }), trustApiScope: true },
    { path: buildMyTeamTasksReportPath(kfInstance, { managerEmail: loggedInEmail, variant: 'final' }), trustApiScope: true },
    { path: buildMyTeamTasksReportPath(kfInstance, { managerEmail: loggedInEmail, variant: 'field', paginate: true }), trustApiScope: true },
    { path: buildMyTeamTasksReportPath(kfInstance, { managerEmail: loggedInEmail, variant: 'field' }), trustApiScope: true },
    { path: buildMyTeamTasksReportPath(kfInstance, { variant: 'bare', paginate: true }), trustApiScope: false },
  ];

  const seen = new Set();
  let lastError = null;
  let lastEmpty = null;

  for (const attempt of attempts) {
    if (!attempt.path || seen.has(attempt.path)) continue;
    seen.add(attempt.path);
    try {
      const resp = await kfGetJson(kfInstance, attempt.path);
      const mapped = mapMyTeamTasksResponse(resp, {
        loggedInEmail,
        allowedProjectIds,
        trustApiScope: attempt.trustApiScope,
      });
      console.info('My Team tasks report', {
        path: attempt.path,
        mapped: mapped.tasks.length,
        allowedProjects: allowedProjectIds ? allowedProjectIds.size : null,
        trustApiScope: attempt.trustApiScope,
      });
      if (mapped.tasks.length > 0) return mapped;
      lastEmpty = mapped;
    } catch (e) {
      lastError = e;
      console.warn('My Team tasks report fetch failed:', attempt.path, e?.message || e);
      if (isKissflowRateLimited(e) || isAuthError(e)) break;
    }
  }

  if (lastEmpty) return lastEmpty;
  if (lastError) throw lastError;
  return mapMyTeamTasksResponse({ Columns: [], Data: [] }, { loggedInEmail, allowedProjectIds });
}
