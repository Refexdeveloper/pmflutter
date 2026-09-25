/**
 * My Team projects — Kissflow case-report
 * /case-report/2/{account}/Project_Management_A01/My_Team_A05
 *
 * Scoped to the logged-in manager via L1/L2 email (preference params + client filter).
 * Preference params are best-effort; client L1/L2 filter is authoritative for the bare path.
 */

import { kfGetJson, resolveKissflowAccountId, isKissflowRateLimited, isAuthError } from './kfRuntime.js';
import {
  fmtDate,
  parseKfDate,
  toInitials,
  computeProjectDelayDays,
  computeProjectRag,
  ragToHealthLabel,
  isClosedProjectStatus,
} from './kfProjectDashboard.js';

const DEFAULT_ACCOUNT_ID = 'AcCMptlq60zH';
export const MY_TEAM_CASE_ID = 'Project_Management_A01';
export const MY_TEAM_REPORT_ID = 'My_Team_A05';

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
  if (typeof val === 'string') {
    const s = val.trim();
    return normalizeEmail(s);
  }
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
export function normalizeCaseReportResponse(raw) {
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

export function mapMyTeamProjectRow(row, columns) {
  if (!row || typeof row !== 'object') return null;

  const { fieldToColumnId, columnIdToField } = buildFieldMaps(columns);
  const read = (fieldId) => readRowField(row, fieldId, fieldToColumnId, columnIdToField);

  const ownerRef = extractPerson(read('Project_Owner') || read('Business_Owner'));
  const progressRaw = Number(read('Project_Objectives') ?? read('Completion') ?? 0);
  const status = toText(read('Status_1')) || '—';
  const progress = isClosedProjectStatus(status)
    ? 100
    : Number.isFinite(progressRaw)
      ? Math.max(0, Math.min(100, Math.round(progressRaw)))
      : 0;

  const start = fmtDate(parseKfDate(read('Start_Date'))) || '—';
  const plannedEnd = fmtDate(parseKfDate(read('End_Date'))) || '';
  const actualEnd = fmtDate(parseKfDate(read('Actual_End_Date_1'))) || '';
  const end = actualEnd || plannedEnd || '—';
  // Case report has no revision timeline; treat differing planned vs actual end as one revision.
  const hasRevision = Boolean(actualEnd && plannedEnd && actualEnd !== plannedEnd);
  const revisedCount = hasRevision ? 1 : 0;

  const delayDays = computeProjectDelayDays(status, end);
  const rag = computeProjectRag({
    status,
    delayDays,
    progress,
    startDate: start,
    endDate: end,
  });
  const health = ragToHealthLabel(rag, status);
  const delayLabel = delayDays > 0 ? `+${delayDays}d` : 'On time';

  const tasksRaw = Number(read('aggregation_1') ?? 0);
  const tasks = Number.isFinite(tasksRaw) && tasksRaw > 0 ? Math.round(tasksRaw) : 0;
  const completed = tasks > 0 ? Math.round((progress / 100) * tasks) : progress >= 100 ? 1 : 0;
  const pending = Math.max(0, tasks - completed);

  const projectIdVariants = collectProjectIdVariants(
    row._id,
    row._item_id,
    read('Project_ID_2'),
    read('Project_ID'),
    read('Project_ID_Details'),
  );
  const projectId = projectIdVariants[0] || '';
  const name = toText(read('Project_Name')) || '—';

  return {
    id: projectId || String(row._id || '').trim(),
    projectId,
    projectIds: projectIdVariants,
    name,
    owner: ownerRef.name || '—',
    ownerId: ownerRef.id,
    ownerEmail: ownerRef.email,
    ownerAvatar: toInitials(ownerRef.name),
    progress,
    tasks,
    completed,
    pending,
    delay: delayLabel,
    delayDays,
    end,
    start,
    originalEndDate: plannedEnd || null,
    revisedEndDate: hasRevision ? actualEnd : null,
    revisedCount,
    hasRevision,
    health,
    status,
    rag,
    priority: toText(read('Priority_1')) || '—',
    category: toText(read('Project_Category')) || '',
    lineOfBusiness: toText(read('Project_Category')) || '',
    companyName: toText(read('Company_Name')) || '',
    functionType: toText(read('Function_Type')) || '',
    l1ManagerEmail: readEmailField(read('L1_Manager_Email')),
    l2ManagerEmail: readEmailField(read('L2_Manager_Email')),
    createdAt: fmtDate(parseKfDate(read('_created_at') || row?._created_at)),
    raw: row,
  };
}

/** Keep rows where logged-in email matches L1 or L2 manager email. */
export function filterProjectsByManagerEmail(projects, loggedInEmail) {
  const me = normalizeEmail(loggedInEmail);
  if (!me) return [];
  return (Array.isArray(projects) ? projects : []).filter((p) => {
    const l1 = normalizeEmail(p?.l1ManagerEmail);
    const l2 = normalizeEmail(p?.l2ManagerEmail);
    return (l1 && l1 === me) || (l2 && l2 === me);
  });
}

export function mapMyTeamProjectsResponse(response, options = {}) {
  const normalized = normalizeCaseReportResponse(response);
  const columns = normalized.Columns;
  const data = normalized.Data;
  const loggedInEmail = normalizeEmail(options?.loggedInEmail || options?.managerEmail);
  const trustApiScope = Boolean(options?.trustApiScope);

  let projects = data
    .map((row) => mapMyTeamProjectRow(row, columns))
    .filter((p) => p && (p.id || (p.name && p.name !== '—')));

  if (!loggedInEmail) {
    return {
      columns,
      projects: trustApiScope ? projects : [],
      reportName: normalized.Name || 'My Team',
    };
  }

  const hasManagerFields = projects.some(
    (p) => normalizeEmail(p?.l1ManagerEmail) || normalizeEmail(p?.l2ManagerEmail),
  );

  if (hasManagerFields) {
    // L1/L2 match is authoritative. Preference params often return unscoped rows;
    // never keep the full API payload when this user matches nobody.
    projects = filterProjectsByManagerEmail(projects, loggedInEmail);
  } else if (!trustApiScope) {
    projects = [];
  }

  return {
    columns,
    projects,
    reportName: normalized.Name || 'My Team',
  };
}

/**
 * Build report path. When managerEmail is set, always include L1/L2 preference params
 * (Lead_KF style: $final_l1_manager_email / $final_l2_manager_email).
 */
export function buildMyTeamProjectsReportPath(kfInstance, options = {}) {
  const accountId =
    resolveKissflowAccountId(kfInstance, DEFAULT_ACCOUNT_ID) || DEFAULT_ACCOUNT_ID;
  const managerEmail = String(options?.managerEmail || options?.loggedInEmail || '').trim();
  const variant = options?.variant || 'final'; // 'final' | 'field' | 'bare'
  const paginate = Boolean(options?.paginate);

  const base = `/case-report/2/${accountId}/${MY_TEAM_CASE_ID}/${encodeURIComponent(MY_TEAM_REPORT_ID)}`;

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

  let mgr;
  if (variant === 'field') {
    mgr = `$l1_manager_email=${enc}&$l2_manager_email=${enc}`;
  } else {
    mgr = `$final_l1_manager_email=${enc}&$final_l2_manager_email=${enc}`;
  }

  return `${base}?${params.toString()}&${mgr}`;
}

/**
 * Fetch My Team projects scoped to the logged-in manager email.
 * Preference paths trust Kissflow session scoping; bare path requires client L1/L2 filter.
 */
export async function fetchMyTeamProjects(kfInstance, options = {}) {
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
    console.warn('My Team projects: no logged-in email — returning empty');
    return mapMyTeamProjectsResponse({ Columns: [], Data: [] }, {});
  }

  const attempts = [
    { path: buildMyTeamProjectsReportPath(kfInstance, { managerEmail: loggedInEmail, variant: 'final', paginate: true }), trustApiScope: true },
    { path: buildMyTeamProjectsReportPath(kfInstance, { managerEmail: loggedInEmail, variant: 'final' }), trustApiScope: true },
    { path: buildMyTeamProjectsReportPath(kfInstance, { managerEmail: loggedInEmail, variant: 'field', paginate: true }), trustApiScope: true },
    { path: buildMyTeamProjectsReportPath(kfInstance, { managerEmail: loggedInEmail, variant: 'field' }), trustApiScope: true },
    { path: buildMyTeamProjectsReportPath(kfInstance, { variant: 'bare', paginate: true }), trustApiScope: false },
  ];

  const seen = new Set();
  let lastError = null;
  let lastEmpty = null;

  for (const attempt of attempts) {
    if (!attempt.path || seen.has(attempt.path)) continue;
    seen.add(attempt.path);
    try {
      const resp = await kfGetJson(kfInstance, attempt.path);
      const mapped = mapMyTeamProjectsResponse(resp, {
        loggedInEmail,
        trustApiScope: attempt.trustApiScope,
      });
      console.info('My Team projects report', {
        path: attempt.path,
        mapped: mapped.projects.length,
        trustApiScope: attempt.trustApiScope,
      });
      if (mapped.projects.length > 0) return mapped;
      lastEmpty = mapped;
    } catch (e) {
      lastError = e;
      console.warn('My Team projects report fetch failed:', attempt.path, e?.message || e);
      if (isKissflowRateLimited(e) || isAuthError(e)) break;
    }
  }

  if (lastEmpty) return lastEmpty;
  if (lastError) throw lastError;
  return mapMyTeamProjectsResponse({ Columns: [], Data: [] }, { loggedInEmail });
}
