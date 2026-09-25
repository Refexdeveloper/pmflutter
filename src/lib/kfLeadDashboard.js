/** Kissflow Vindview Sales Management — fetch, map & analytics helpers. */

import { kfGetJson, resolveKissflowOrigin } from './kfRuntime.js';
import { personMatches } from './kfProjectDashboard.js';
import {
  buildLeadAdminApiPaths,
  buildLeadProcessApiPaths,
  LEAD_PROCESS_ID,
  STATUS_SEGMENTS,
} from './kfLeadPaths.js';

export const BASE_URL = resolveKissflowOrigin();

export const LEAD_POPUP_ID = 'Popup_w-VaMxwzHv';

export const WORKFLOW_STEPS = [
  'Document Sharing',
  'Initial Meeting',
  'Requirement Assessment',
  'Customer DD / Visits',
  'Commercial Discussion',
  'Term Sheet Finalization',
  'Closed Won / Closed Lost',
  'Sales Head Approval',
];

export const PIPELINE_STAGES = WORKFLOW_STEPS;

const STAGE_ALIASES = {
  'document sharing': 'Document Sharing',
  'intro docs shared': 'Document Sharing',
  'initial meeting': 'Initial Meeting',
  'initial meeting done': 'Initial Meeting',
  'requirement assessment': 'Requirement Assessment',
  'requirement assessed': 'Requirement Assessment',
  'customer dd / visits': 'Customer DD / Visits',
  'customer dd': 'Customer DD / Visits',
  'commercial discussion': 'Commercial Discussion',
  'term sheet finalization': 'Term Sheet Finalization',
  'term sheet signed': 'Term Sheet Finalization',
  'closed won / closed lost': 'Closed Won / Closed Lost',
  'closed won': 'Closed Won / Closed Lost',
  'closed lost': 'Closed Won / Closed Lost',
  'sales head approval': 'Sales Head Approval',
  won: 'Closed Won / Closed Lost',
  lost: 'Closed Won / Closed Lost',
};

function stringifyKf(val) {
  if (val == null) return '';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    if (val.Name != null) return String(val.Name);
    if (val._name != null) return String(val._name);
    if (val.label != null) return String(val.label);
    if (val.value != null) return stringifyKf(val.value);
  }
  return '';
}

function getVal(item, keys, def = '') {
  const sources = [item, item?.Data, item?.data].filter(Boolean);
  for (const src of sources) {
    for (const k of keys) {
      const v = src?.[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    const lowerKeys = keys.map((k) => String(k).toLowerCase());
    for (const [k, v] of Object.entries(src || {})) {
      if (v !== undefined && v !== null && v !== '' && lowerKeys.includes(String(k).toLowerCase())) return v;
    }
  }
  return def;
}

function parseDate(val) {
  if (!val) return null;
  const d = new Date(String(val).replace(/\s+[A-Za-z_/]+$/, ''));
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : parseDate(d);
  return dt ? dt.toISOString().slice(0, 10) : null;
}

function toNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStage(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'Document Sharing';
  if (STAGE_ALIASES[s]) return STAGE_ALIASES[s];
  for (const stage of WORKFLOW_STEPS) {
    if (s.includes(stage.toLowerCase())) return stage;
  }
  if (s.includes('won') || s.includes('lost')) return 'Closed Won / Closed Lost';
  if (s.includes('approval')) return 'Sales Head Approval';
  return String(raw).trim() || 'Document Sharing';
}

function pickActivityInstanceId(item) {
  const raw = item?._activity_instance_id ?? item?.activityInstanceId ?? '';
  return Array.isArray(raw) ? String(raw[0] || '').trim() : String(raw || '').trim();
}

function normalizePriority(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('high')) return 'High';
  if (s.includes('medium') || s.includes('med')) return 'Medium';
  if (s.includes('low')) return 'Low';
  return raw ? String(raw).trim() : 'Medium';
}

function normalizeStatus(item, segment) {
  const raw =
    item?._status ??
    item?.Status ??
    item?._workflow_status ??
    stringifyKf(item?._current_step);
  if (raw) {
    const t = String(raw).trim();
    if (/in\s*progress/i.test(t)) return 'In progress';
    return t;
  }
  const map = {
    draft: 'Draft',
    inprogress: 'In progress',
    completed: 'Completed',
    withdrawn: 'Withdrawn',
    rejected: 'Rejected',
  };
  return map[segment] || 'Draft';
}

function extractOwner(item) {
  const ref = item?.Lead_Owner || item?.Assigned_To || item?._current_assigned_to || item?._created_by;
  const name = stringifyKf(ref) || stringifyKf(item?._created_by) || 'Unassigned';
  return {
    name,
    id: String(ref?._id || ref?.Id || item?._created_by?._id || '').trim(),
    email: String(ref?.Email || ref?.email || item?._created_by?.Email || '').trim(),
  };
}

function extractCustomerFromName(name) {
  const n = String(name || '').trim();
  if (!n) return '—';
  const fromMatch = n.match(/\bfrom\s+(.+)$/i);
  if (fromMatch) return fromMatch[1].trim();
  const parts = n.split(' - ');
  if (parts.length >= 2) return parts[parts.length - 1].trim();
  return n;
}

export function mapKfItemToLeadRow(item, segment) {
  if (!item || typeof item !== 'object') return null;

  const id = String(getVal(item, ['_id', 'Lead_ID', 'id'], '')).trim();
  if (!id) return null;

  const owner = extractOwner(item);
  const currentStepRaw = stringifyKf(getVal(item, ['_current_step', 'Current_step', 'current_step'], ''));
  const stage = normalizeStage(
    getVal(item, ['Current_Stage', 'current_stage', 'Stage', 'Workflow_Stage'], '') || currentStepRaw,
  );
  const status = normalizeStatus(item, segment);
  const indicativeValue = toNum(getVal(item, ['Indicative_Deal_Value', 'Indicative_deal_value', 'Deal_Value'], 0));
  const expectedValue = toNum(getVal(item, ['Expected_Deal_Value', 'Expected_deal_value'], indicativeValue));
  const winProb = toNum(getVal(item, ['Win_Probability', 'win_probability', 'Probability'], 0));
  const followUp = parseDate(getVal(item, ['Follow_up_Date', 'Next_Follow_Up', 'Follow_Up_Date'], ''));
  const meetingDate = parseDate(getVal(item, [
    'Meeting_Date', 'Meeting_date', 'Next_Meeting_Date', 'Initial_Meeting_Date',
    'Meeting_Date_1', 'Upcoming_Meeting_Date',
  ], ''));
  const effectiveMeetingDate = meetingDate || followUp;
  const closure = parseDate(getVal(item, ['Expected_Closure_Date', 'Closure_Date', 'End_Date'], ''));
  const modified = parseDate(getVal(item, ['_modified_at', 'Modified_at', '_created_at'], ''));
  const created = parseDate(getVal(item, ['_created_at', 'Created_at'], ''));

  const customerRaw = getVal(item, ['Customer_Name', 'Customer_name'], '');
  const customerName = customerRaw ? String(customerRaw).trim() : extractCustomerFromName(item.Name);

  const isWon = stage === 'Closed Won / Closed Lost' && /won|complete/i.test(status + stage + currentStepRaw);
  const isLost = /rejected|withdrawn|lost/i.test(status) || (stage === 'Closed Won / Closed Lost' && /lost/i.test(currentStepRaw));
  const isOpen = !isWon && !isLost;

  const now = new Date();
  const daysOverdue =
    followUp && followUp < now && isOpen
      ? Math.ceil((now.getTime() - followUp.getTime()) / (86400000))
      : 0;

  return {
    id,
    displayId: getVal(item, ['Lead_ID', 'Lead_Code'], id.slice(-8).toUpperCase()),
    name: getVal(item, ['Name'], ''),
    customerName: customerName || '—',
    contactPerson: getVal(item, ['Contact_Persion', 'Contact_Person', 'Contact_person'], ''),
    leadOwner: owner.name,
    leadOwnerId: owner.id,
    leadOwnerEmail: owner.email,
    leadSource: stringifyKf(getVal(item, ['Lead_Source', 'lead_source'], '')) || '—',
    region: stringifyKf(getVal(item, ['Region', 'region'], '')) || '—',
    product: stringifyKf(getVal(item, ['Product', 'product'], '')) || '—',
    priority: normalizePriority(getVal(item, ['Lead_Priority', 'Priority', 'priority'], 'Medium')),
    stage,
    currentStep: currentStepRaw || stage,
    status,
    phone: stringifyKf(getVal(item, ['Phone_Number', 'Phone'], '')),
    email: stringifyKf(getVal(item, ['Email_1', 'Email', 'Email_Id'], '')),
    expectedDealValue: expectedValue,
    indicativeDealValue: indicativeValue,
    winProbability: winProb > 1 ? Math.min(100, winProb) : Math.min(100, Math.round(winProb * 100)),
    expectedClosureDate: fmtDate(closure),
    followUpDate: fmtDate(followUp),
    meetingDate: fmtDate(effectiveMeetingDate),
    meetingDateRaw: effectiveMeetingDate,
    lastUpdated: fmtDate(modified) || fmtDate(created),
    createdDate: fmtDate(created),
    commercialStatus: stringifyKf(getVal(item, ['Commercial_Status', 'commercial_status'], '')) || '—',
    progress: toNum(item?._progress, 0),
    activityId: String(item?._activity_id || '').trim(),
    activityInstanceId: pickActivityInstanceId(item),
    isWon,
    isLost,
    isOpen,
    daysOverdue,
    forecastValue: indicativeValue * (winProb > 1 ? winProb / 100 : winProb),
    raw: item,
  };
}

async function fetchJson(kfInstance, path) {
  return kfGetJson(kfInstance, path, `${BASE_URL}${path}`);
}

function extractListFromResponse(response) {
  if (Array.isArray(response?.Data)) return response.Data;
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

async function enrichWithDetails(kfInstance, rows) {
  if (!rows.length || !kfInstance) return rows;
  const admin = buildLeadAdminApiPaths(kfInstance);

  const detailResults = await Promise.allSettled(
    rows.map((l) => {
      const actId = l.activityInstanceId;
      const path = actId
        ? admin.getLeadDetailWithActivityPath(l.id, actId)
        : admin.getLeadDetailPath(l.id);
      return fetchJson(kfInstance, path);
    }),
  );

  return detailResults.map((res, i) => {
    if (res.status === 'fulfilled' && res.value) {
      const seg = STATUS_SEGMENTS[rows[i].status];
      return mapKfItemToLeadRow(res.value, seg) || rows[i];
    }
    return rows[i];
  }).filter(Boolean);
}

export function isUpcomingMeeting(lead) {
  const d = lead?.meetingDateRaw || parseDate(lead?.meetingDate) || parseDate(lead?.followUpDate);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const meeting = new Date(d);
  meeting.setHours(0, 0, 0, 0);
  return meeting >= today;
}

export function countUpcomingMeetings(leads) {
  return (leads || []).filter(isUpcomingMeeting).length;
}

export async function fetchLeadsForTab(kfInstance, tabKey) {
  if (tabKey === 'All') return fetchAllLeads(kfInstance);
  return fetchLeadsForStatusTab(kfInstance, tabKey);
}

export async function fetchLeadsForStatusTab(kfInstance, statusLabel) {
  const segment = STATUS_SEGMENTS[statusLabel];
  if (!segment) return [];
  const paths = buildLeadProcessApiPaths(kfInstance);
  const response = await fetchJson(kfInstance, paths.myItemsPath(segment, 1, 100000));
  const list = extractListFromResponse(response);
  const rows = list.map((item) => mapKfItemToLeadRow(item, segment)).filter(Boolean);
  return enrichWithDetails(kfInstance, rows);
}

export async function fetchLeadFullDetail(kfInstance, row) {
  if (!row?.id || !kfInstance) return row;
  const admin = buildLeadAdminApiPaths(kfInstance);
  const actId = row.activityInstanceId;
  const path = actId
    ? admin.getLeadDetailWithActivityPath(row.id, actId)
    : admin.getLeadDetailPath(row.id);
  try {
    const response = await fetchJson(kfInstance, path);
    const seg = STATUS_SEGMENTS[row.status];
    return mapKfItemToLeadRow(response, seg) || row;
  } catch {
    return row;
  }
}

export function getWorkflowStepIndex(stageName) {
  const idx = WORKFLOW_STEPS.findIndex((s) => s === stageName);
  return idx >= 0 ? idx : 0;
}

export async function submitLeadItem(kfInstance, row, comment = '') {
  const process = kfInstance?.getProcess?.(LEAD_PROCESS_ID);
  if (!process?.submitItem) throw new Error('Approve not available');
  const activityInstanceId = pickActivityInstanceId(row?.raw) || row.activityInstanceId;
  return process.submitItem({
    instanceId: row.id,
    activityInstanceId,
    comment,
  });
}

export async function rejectLeadItem(kfInstance, row, comment = 'Rejected from dashboard') {
  const process = kfInstance?.getProcess?.(LEAD_PROCESS_ID);
  if (!process?.rejectItem) throw new Error('Reject not available');
  const activityInstanceId = pickActivityInstanceId(row?.raw) || row.activityInstanceId;
  return process.rejectItem({
    instanceId: row.id,
    activityInstanceId,
    comment,
  });
}

async function fetchMyItemsLeads(kfInstance) {
  const paths = buildLeadProcessApiPaths(kfInstance);
  const segmentEntries = Object.entries(STATUS_SEGMENTS);
  const results = await Promise.allSettled(
    segmentEntries.map(([, seg]) => fetchJson(kfInstance, paths.myItemsPath(seg, 1, 100000))),
  );

  const merged = [];
  const seen = new Set();
  results.forEach((res, idx) => {
    if (res.status !== 'fulfilled') return;
    const [, segment] = segmentEntries[idx];
    const list = extractListFromResponse(res.value);
    list.forEach((item) => {
      const id = item?._id || item?._item_id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      const row = mapKfItemToLeadRow(item, segment);
      if (row) merged.push(row);
    });
  });
  return merged;
}

async function fetchAdminLeads(kfInstance) {
  const admin = buildLeadAdminApiPaths(kfInstance);
  const response = await fetchJson(kfInstance, admin.getLeadItemsPath(1, 100000));
  const list = extractListFromResponse(response);
  return list.map((row) => mapKfItemToLeadRow(row)).filter(Boolean);
}

export async function fetchAllLeads(kfInstance) {
  const attempts = [];

  try {
    const adminRows = await fetchAdminLeads(kfInstance);
    if (adminRows.length) attempts.push(adminRows);
  } catch (e) {
    console.warn('Lead admin list failed:', e?.message || e);
  }

  try {
    const myRows = await fetchMyItemsLeads(kfInstance);
    if (myRows.length) attempts.push(myRows);
  } catch (e) {
    console.warn('Lead myitems list failed:', e?.message || e);
  }

  const seen = new Set();
  const merged = [];
  for (const batch of attempts) {
    for (const row of batch) {
      if (!row?.id || seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
  }

  return enrichWithDetails(kfInstance, merged);
}

export async function fetchLeadStatusCounts(kfInstance) {
  const paths = buildLeadProcessApiPaths(kfInstance);
  const response = await fetchJson(kfInstance, paths.statusCountPath);
  if (!response || typeof response !== 'object') return null;
  return {
    Draft: response.Draft ?? 0,
    'In progress': response.InProgress ?? response['In progress'] ?? 0,
    Completed: response.Completed ?? 0,
    Withdrawn: response.Withdrawn ?? 0,
    Rejected: response.Rejected ?? 0,
  };
}

export async function fetchLeadDetail(kfInstance, itemId) {
  const admin = buildLeadAdminApiPaths(kfInstance);
  const response = await fetchJson(kfInstance, admin.getLeadDetailPath(itemId));
  return mapKfItemToLeadRow(response);
}

export function resolveAccessLevel(roleName) {
  const r = String(roleName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (r.includes('head') || r.includes('admin') || r.includes('cto') || r.includes('director')) return 'head';
  if (r.includes('manager')) return 'manager';
  return 'rep';
}

export function filterLeadsByAccess(leads, kfUser, roleName) {
  const level = resolveAccessLevel(roleName);
  if (level === 'head' || level === 'manager') return leads;
  if (!kfUser) return leads;

  return leads.filter((l) => {
    if (personMatches(kfUser, { name: l.leadOwner, id: l.leadOwnerId, email: l.leadOwnerEmail })) return true;
    const creator = l.raw?._created_by;
    if (creator && personMatches(kfUser, creator)) return true;
    if (l.leadOwner === 'Unassigned' && creator && personMatches(kfUser, creator)) return true;
    return false;
  });
}

export function applyLeadFilters(leads, filters) {
  return leads.filter((l) => {
    if (filters.status && filters.status !== 'all' && filters.status !== 'All' && l.status !== filters.status) return false;
    if (filters.stage && filters.stage !== 'all' && l.stage !== filters.stage) return false;
    if (filters.owner && filters.owner !== 'all' && l.leadOwner !== filters.owner) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = `${l.customerName} ${l.contactPerson} ${l.leadOwner} ${l.leadSource} ${l.region} ${l.product} ${l.displayId} ${l.name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function getFilterOptions(leads) {
  const uniq = (key) => Array.from(new Set(leads.map((l) => l[key]).filter((v) => v && v !== '—' && v !== 'Unassigned'))).sort();
  return {
    owners: uniq('leadOwner'),
    statuses: Array.from(new Set(leads.map((l) => l.status))).filter(Boolean).sort(),
    stages: PIPELINE_STAGES,
  };
}

export function groupByField(leads, field) {
  const map = {};
  leads.forEach((l) => {
    const key = String(l[field] || 'Unknown').trim() || 'Unknown';
    if (!map[key]) map[key] = { name: key, count: 0, value: 0 };
    map[key].count += 1;
    map[key].value += l.indicativeDealValue;
  });
  return Object.values(map).sort((a, b) => b.count - a.count);
}

export async function fetchLeadDashboardData(kfInstance, kfUser, roleName) {
  let leads = [];
  let loadError = '';
  let statusCounts = null;

  try {
    statusCounts = await fetchLeadStatusCounts(kfInstance);
  } catch {
    // optional
  }

  try {
    const [draft, inprogress, completed] = await Promise.all([
      fetchLeadsForStatusTab(kfInstance, 'Draft').catch(() => []),
      fetchLeadsForStatusTab(kfInstance, 'In progress').catch(() => []),
      fetchLeadsForStatusTab(kfInstance, 'Completed').catch(() => []),
    ]);
    leads = [...draft, ...inprogress, ...completed];
    const level = resolveAccessLevel(roleName);
    if (level === 'rep' && leads.length > 0) {
      const filtered = filterLeadsByAccess(leads, kfUser, roleName);
      if (filtered.length > 0) leads = filtered;
    }
  } catch (e) {
    loadError = e?.message || String(e);
    console.warn('fetchLeadDashboardData failed:', loadError);
  }

  return { leads, statusCounts, loadError, connected: Boolean(kfInstance?.api || kfInstance?.user) };
}
