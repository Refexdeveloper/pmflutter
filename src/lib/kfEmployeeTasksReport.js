/**
 * Employee dashboard tasks — Kissflow Employee_Tasks_A01
 * https://development-refexgroup.kissflow.com/appbuilder/Project_Management_Tracker_A00/page/Employee_Tasks_A01
 *
 * GET /process-report/2/{account}/Project_Sub_Task_A01/pm_external_report_A00
 *   $assignee_email  = login email → Tasks Assigned to me
 *   $requester_email = login email → Tasks Created by Me
 */

import { fetchAllAdminProcessItems, kfGetJson } from './kfRuntime.js'
import { KF_PM_TRACKER_APP_ID } from './kfPmApp.js'
import { mapEmployeeTaskRow } from './kfTaskTracker.js'
import { cacheKey, getCachedOrLoad, invalidateListCache } from './kfListCache.js'
import { reportAssigneeEmail } from './kfUserField.js'
import {
  buildReportFieldMaps,
  fetchReportPages as fetchEmployeeReportPages,
  normalizeReportEmail,
  normalizeReportPayload,
  readReportRowField,
  reportFieldText,
  reportPayloadFailed,
} from './kfEmployeeReportCore.js'

export { reportPayloadFailed } from './kfEmployeeReportCore.js'

export const EMP_TASK_ACCOUNT_ID = 'AcCMptp3yqcn'
export const EMP_TASK_PROCESS_ID = 'Project_Sub_Task_A01'
export const EMP_TASK_REPORT_ID = 'pm_external_report_A00'
export const EMP_TASK_APP_ID = KF_PM_TRACKER_APP_ID
export const EMP_TASK_PAGE_SIZE = 500

const normalizeEmail = normalizeReportEmail
const toText = reportFieldText
const buildFieldMaps = buildReportFieldMaps
const readRowField = readReportRowField

function parseReportCount(payload) {
  if (typeof payload === 'number') return Number(payload) || 0
  if (payload == null || typeof payload !== 'object') return 0
  if (payload.Count != null) return Number(payload.Count) || 0
  if (payload.count != null) return Number(payload.count) || 0
  if (payload.Total != null) return Number(payload.Total) || 0
  if (payload.total != null) return Number(payload.total) || 0
  const agg = payload.Aggregation
  if (agg && typeof agg === 'object') {
    const first = Object.values(agg)[0]
    if (first != null && first.Count != null) return Number(first.Count) || 0
  }
  return Number(payload.Data ?? payload.data ?? 0) || 0
}

export function loginEmailOf(kfInstance, fallback = '') {
  const fromFallback = String(fallback || '').trim().toLowerCase()
  if (fromFallback.includes('@')) return fromFallback
  return String(kfInstance?.user?.Email || kfInstance?.user?.email || '')
    .trim()
    .toLowerCase()
}

/**
 * Same query shape as Employee_Tasks_A01:
 * /process-report/2/AcCMptp3yqcn/Project_Sub_Task_A01/pm_external_report_A00[/count]
 *   ?$assignee_email=…&$requester_email=…&_application_id=Project_Management_Tracker_A00
 */
export function buildEmployeeTasksReportPath(kfInstance, options = {}) {
  const accountId = EMP_TASK_ACCOUNT_ID
  const email = String(options.email || '').trim()
  const page = Math.max(1, Number(options.page) || 1)
  const pageSize = Math.max(1, Number(options.pageSize) || EMP_TASK_PAGE_SIZE)
  const count = Boolean(options.count)
  const scope = options.scope || 'both'

  const suffix = count ? '/count' : ''
  const parts = []
  if (email && (scope === 'assigned' || scope === 'both')) {
    parts.push(`$assignee_email=${encodeURIComponent(email)}`)
  }
  if (email && (scope === 'created' || scope === 'both')) {
    parts.push(`$requester_email=${encodeURIComponent(email)}`)
  }
  parts.push(`_application_id=${encodeURIComponent(EMP_TASK_APP_ID)}`)
  parts.push(`page_number=${page}`)
  parts.push(`page_size=${pageSize}`)

  return `/process-report/2/${accountId}/${EMP_TASK_PROCESS_ID}/${EMP_TASK_REPORT_ID}${suffix}?${parts.join('&')}`
}

function hydrateReportRow(row, columns) {
  const { fieldToColumnId, columnIdToField } = buildFieldMaps(columns)
  const read = (fieldId) => readRowField(row, fieldId, fieldToColumnId, columnIdToField)
  const out = { ...row }

  for (const col of columns || []) {
    const fieldId = col?.FieldId
    if (!fieldId) continue
    const value = read(fieldId)
    if (value != null && out[fieldId] == null) out[fieldId] = value
  }

  if (!out.Assigned_To && out.AssignedTo) out.Assigned_To = out.AssignedTo
  const instanceFromReport =
    toText(out.Instance_ID) || toText(read('Instance_ID')) || toText(out.InstanceID)
  const activityFromReport =
    toText(out.Activity_Instance_ID) ||
    toText(read('Activity_Instance_ID')) ||
    toText(out.ActivityInstanceID) ||
    toText(out.ActivityID)
  if (instanceFromReport) out.Instance_ID = instanceFromReport
  if (activityFromReport) out.Activity_Instance_ID = activityFromReport
  if (!out._id) out._id = instanceFromReport || row._id || row._item_id
  if (!out._activity_instance_id) {
    out._activity_instance_id = activityFromReport || row._activity_instance_id
  }

  const assigneeEmail = reportAssigneeEmail(out)
  const requesterEmail =
    normalizeEmail(out.Requester_Email) ||
    normalizeEmail(out.requester_email) ||
    normalizeEmail(out['Requester Email']) ||
    normalizeEmail(out.Created_by_flat_field_email) ||
    normalizeEmail(out._created_by)

  // Report assignee is externalemail. Do not invent a Kissflow Assigned_To user.

  if (!toText(out.Project_ID_Details) && (out.Project || out.Project_Name)) {
    out.Project_ID_Details = toText(out.Project) || toText(out.Project_Name)
  }

  out.externalemail = assigneeEmail || out.externalemail || ''
  out.assignee_email = assigneeEmail
  out.requester_email = requesterEmail
  out.Assignee_Email = assigneeEmail
  out['Requester Email'] = requesterEmail
  out.Requester_Email = requesterEmail
  return out
}

function mapHydratedRow(row, idx) {
  const mapped = mapEmployeeTaskRow(row, idx)
  if (!mapped) return null
  const email = reportAssigneeEmail(row) || mapped.assignedToEmail || ''
  mapped.assignedToEmail = email
  mapped.assignedTo = mapped.assignedTo && mapped.assignedTo !== 'Unassigned'
    ? mapped.assignedTo
    : (email || mapped.assignedTo)
  mapped.requesterEmail = row.requester_email || mapped.requesterEmail || ''
  const activityRaw = row._activity_instance_id ?? mapped.ActivityID
  const activityId = Array.isArray(activityRaw) ? activityRaw[0] : activityRaw
  mapped.InstanceID = String(mapped.InstanceID || row._id || '').trim()
  mapped.ActivityID = String(activityId || '').trim()
  mapped._id = mapped._id || row._id
  mapped._activity_instance_id = mapped._activity_instance_id || activityId
  mapped.kfAccountId = EMP_TASK_ACCOUNT_ID
  mapped.raw = {
    ...(mapped.raw || row),
    externalemail: row.externalemail || email,
    assignee_email: email,
    requester_email: row.requester_email,
    kfAccountId: EMP_TASK_ACCOUNT_ID,
  }
  return mapped
}

function emailsMatch(left, right) {
  const a = normalizeEmail(left)
  const b = normalizeEmail(right)
  return Boolean(a && b && a === b)
}

function filterByLoginEmail(rows, email, pickEmail, { keepAllIfMissing = true } = {}) {
  const list = Array.isArray(rows) ? rows : []
  const me = normalizeEmail(email)
  if (!me) return []
  const withEmail = list.filter((row) => normalizeEmail(pickEmail(row)))
  if (withEmail.length === 0) return keepAllIfMissing ? list : []
  return list.filter((row) => emailsMatch(pickEmail(row), me))
}

function fetchReportPages(kfInstance, { email, scope }) {
  return fetchEmployeeReportPages(kfInstance, {
    pageSize: EMP_TASK_PAGE_SIZE,
    buildPath: (page) =>
      buildEmployeeTasksReportPath(kfInstance, {
        email,
        scope,
        page,
        pageSize: EMP_TASK_PAGE_SIZE,
      }),
  })
}

function mapReportScopeRows(page) {
  return (Array.isArray(page?.rows) ? page.rows : [])
    .map((row, idx) => mapHydratedRow(hydrateReportRow(row, page.columns), idx))
    .filter(Boolean)
}

/** Flatten Column-Id report payload and map rows (assignee = externalemail). */
export function mapEmployeeReportRows(payload) {
  const normalized = normalizeReportPayload(payload)
  return mapReportScopeRows({ columns: normalized.Columns, rows: normalized.Data })
}

/**
 * One Employee_Tasks_A01 report call:
 * assigned → $assignee_email={login email}
 * created  → $requester_email={login email}
 */
export async function fetchEmployeeTasksByScope(kfInstance, options = {}) {
  try {
    sessionStorage.removeItem('pm:emp-tasks-report-blocked')
  } catch {
    /* ignore */
  }
  const email = loginEmailOf(kfInstance, options.email)
  const scope = options.scope === 'created' ? 'created' : 'assigned'
  if (!email || !email.includes('@')) {
    return { email: '', scope, rows: [] }
  }

  const key = cacheKey('emp-tasks-report', scope, email)
  if (options.bust) invalidateListCache(key)

  return getCachedOrLoad(key, async () => {
    const fromAdmin = async () => {
      const fallback = await fetchEmployeeTasksFromAdminList(kfInstance, email)
      return {
        email,
        scope,
        rows: scope === 'created' ? fallback.created : fallback.assigned,
      }
    }
    try {
      const page = await fetchReportPages(kfInstance, { email, scope })
      return { email, scope, rows: mapReportScopeRows(page) }
    } catch (error) {
      console.warn(`Employee ${scope} report failed:`, error?.message || error)
      return fromAdmin()
    }
  })
}

async function fetchEmployeeTasksFromAdminList(kfInstance, email) {
  return getCachedOrLoad(cacheKey('emp-tasks-admin', email), () => loadEmployeeTasksFromAdminList(kfInstance, email))
}

async function loadEmployeeTasksFromAdminList(kfInstance, email) {
  const raw = await fetchAllAdminProcessItems(kfInstance, EMP_TASK_PROCESS_ID, {
    applyPreference: false,
    accountId: EMP_TASK_ACCOUNT_ID,
    allowWhenPaused: true,
    email,
  })
  const mapped = raw
    .map((row, idx) => mapHydratedRow(hydrateReportRow(row, []), idx))
    .filter(Boolean)
  const userId = String(kfInstance?.user?._id || '').trim()
  const assigned = mapped.filter((row) => {
    if (emailsMatch(row.assignedToEmail || row.raw?.externalemail || row.raw?.assignee_email, email)) return true
    const assigneeId = String(row.assignedToId || row.raw?.Assigned_To?._id || '').trim()
    return Boolean(userId && assigneeId && assigneeId === userId)
  })
  const created = filterByLoginEmail(
    mapped,
    email,
    (row) => row.requesterEmail || row.raw?.requester_email,
    { keepAllIfMissing: false },
  )
  const byId = new Map()
  for (const row of [...assigned, ...created]) {
    const key = String(row.InstanceID || row.id || '').trim()
    if (!key || byId.has(key)) continue
    byId.set(key, row)
  }
  return { email, assigned, created, all: [...byId.values()] }
}

export async function fetchEmployeeTasksReportCount(kfInstance, { email, scope = 'both' } = {}) {
  const path = buildEmployeeTasksReportPath(kfInstance, { email, scope, count: true, page: 1 })
  const payload = await kfGetJson(kfInstance, path, { allowWhenPaused: true, retries: 1 })
  return parseReportCount(payload)
}

/**
 * Load Employee_Tasks_A01 report, then split:
 * login email === assignee_email  → assigned to me
 * login email === requester_email → created by me
 */
export async function fetchEmployeeDashboardTasks(kfInstance, options = {}) {
  const email = loginEmailOf(kfInstance, options.email)
  if (!email || !email.includes('@')) {
    return { assigned: [], created: [], all: [], email: '' }
  }

  const [assignedSettled, createdSettled] = await Promise.allSettled([
    fetchEmployeeTasksByScope(kfInstance, { email, scope: 'assigned', bust: options.bust }),
    fetchEmployeeTasksByScope(kfInstance, { email, scope: 'created', bust: options.bust }),
  ])

  const assigned = assignedSettled.status === 'fulfilled' ? assignedSettled.value.rows : []
  const created = createdSettled.status === 'fulfilled' ? createdSettled.value.rows : []
  if (assignedSettled.status === 'rejected') {
    console.warn('Employee assigned tasks report failed:', assignedSettled.reason?.message || assignedSettled.reason)
  }
  if (createdSettled.status === 'rejected') {
    console.warn('Employee created tasks report failed:', createdSettled.reason?.message || createdSettled.reason)
  }

  const byId = new Map()
  for (const row of [...assigned, ...created]) {
    const key = String(row.InstanceID || row.id || '').trim()
    if (!key || byId.has(key)) continue
    byId.set(key, row)
  }

  return { email, assigned, created, all: [...byId.values()] }
}
