/**
 * Employee hub subtasks — Kissflow process report
 *
 * GET /process-report/2/AcCMptp3yqcn/Sub_Task_Process_A00/pm_subtask_A00
 * Assigned to me is filtered in the app: Assignee_1 is the login Kissflow user,
 * or Assignee_Email / externalemail equals the login email.
 * $requester_email = login email → Subtasks Created by Me
 *
 * Assignee is `externalemail` when Assignee_1 / Assigned_To is missing.
 */

import { KF_PM_TRACKER_APP_ID } from './kfPmApp.js'
import { mapAdminSubtaskRow, fetchSubtaskProcessData } from './kfSubtaskTracker.js'
import { cacheKey, getCachedOrLoad, invalidateListCache } from './kfListCache.js'
import { reportAssigneeEmail, resolveDashboardAssignee, rowMatchesCurrentAssignee } from './kfUserField.js'
import { loginEmailOf } from './kfEmployeeTasksReport.js'
import { rowRequesterEmail } from './pmRequesterScope.js'
import {
  buildReportFieldMaps,
  fetchReportPages as fetchEmployeeReportPages,
  normalizeReportEmail,
  normalizeReportPayload,
  readReportRowField,
  reportFieldText,
  reportPayloadFailed,
} from './kfEmployeeReportCore.js'

export const EMP_SUBTASK_ACCOUNT_ID = 'AcCMptp3yqcn'
export const EMP_SUBTASK_PROCESS_ID = 'Sub_Task_Process_A00'
export const EMP_SUBTASK_REPORT_ID = 'pm_subtask_A00'
export const EMP_SUBTASK_APP_ID = KF_PM_TRACKER_APP_ID
export const EMP_SUBTASK_PAGE_SIZE = 500

const normalizeEmail = normalizeReportEmail
const toText = reportFieldText
const buildFieldMaps = buildReportFieldMaps
const readRowField = readReportRowField

/**
 * /process-report/2/AcCMptp3yqcn/Sub_Task_Process_A00/pm_subtask_A00
 *   ?$assignee_email=…&$requester_email=…&_application_id=Project_Management_Tracker_A00
 */
export function buildEmployeeSubtasksReportPath(kfInstance, options = {}) {
  const email = String(options.email || '').trim()
  const page = Math.max(1, Number(options.page) || 1)
  const pageSize = Math.max(1, Number(options.pageSize) || EMP_SUBTASK_PAGE_SIZE)
  const count = Boolean(options.count)
  const scope = options.scope || 'both'

  const suffix = count ? '/count' : ''
  const parts = []
  if (email && (scope === 'created' || scope === 'both')) {
    parts.push(`$requester_email=${encodeURIComponent(email)}`)
  }
  parts.push(`_application_id=${encodeURIComponent(EMP_SUBTASK_APP_ID)}`)
  parts.push(`page_number=${page}`)
  parts.push(`page_size=${pageSize}`)

  return `/process-report/2/${EMP_SUBTASK_ACCOUNT_ID}/${EMP_SUBTASK_PROCESS_ID}/${EMP_SUBTASK_REPORT_ID}${suffix}?${parts.join('&')}`
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

  if (!out.Assignee_1 && out.Assignee) out.Assignee_1 = out.Assignee
  if (!out.Assigned_To && out.AssignedTo) out.Assigned_To = out.AssignedTo
  if (!out._id) out._id = toText(out.Instance_ID) || row._id || row._item_id
  if (!out._activity_instance_id) {
    out._activity_instance_id = out.Activity_Instance_ID || row._activity_instance_id
  }

  const assigneeEmail = reportAssigneeEmail(out)
  const requesterEmail =
    normalizeEmail(out.Requester_Email) ||
    normalizeEmail(out.requester_email) ||
    normalizeEmail(out['Requester Email']) ||
    normalizeEmail(out.Created_by_flat_field_email) ||
    normalizeEmail(out._created_by)

  // Report assignee is externalemail. Do not invent a Kissflow user object.
  out.externalemail = assigneeEmail || out.externalemail || ''
  out.assignee_email = assigneeEmail
  out.requester_email = requesterEmail
  out.Assignee_Email = assigneeEmail
  out['Requester Email'] = requesterEmail
  out.Requester_Email = requesterEmail
  return out
}

function mapHydratedRow(row, idx) {
  const mapped = mapAdminSubtaskRow(row, idx)
  if (!mapped) return null
  const email = reportAssigneeEmail(row) || mapped.assignedToEmail || ''
  mapped.assignedToEmail = email
  mapped.externalemail = email
  mapped.assignedTo =
    mapped.assignedTo && mapped.assignedTo !== '—' && mapped.assignedTo !== 'Unassigned'
      ? mapped.assignedTo
      : email || mapped.assignedTo
  mapped.requesterEmail = row.requester_email || mapped.requesterEmail || ''
  mapped.kfAccountId = EMP_SUBTASK_ACCOUNT_ID
  mapped.raw = {
    ...(mapped.raw || row),
    externalemail: row.externalemail || email,
    assignee_email: email,
    requester_email: row.requester_email,
    kfAccountId: EMP_SUBTASK_ACCOUNT_ID,
  }
  return mapped
}

function fetchReportPages(kfInstance, { email, scope }) {
  return fetchEmployeeReportPages(kfInstance, {
    pageSize: EMP_SUBTASK_PAGE_SIZE,
    buildPath: (page) =>
      buildEmployeeSubtasksReportPath(kfInstance, {
        email,
        scope,
        page,
        pageSize: EMP_SUBTASK_PAGE_SIZE,
      }),
  })
}

function mapReportScopeRows(page) {
  return (Array.isArray(page?.rows) ? page.rows : [])
    .map((row, idx) => mapHydratedRow(hydrateReportRow(row, page.columns), idx))
    .filter(Boolean)
}

export function mapEmployeeSubtaskReportRows(payload) {
  const normalized = normalizeReportPayload(payload)
  return mapReportScopeRows({ columns: normalized.Columns, rows: normalized.Data })
}

/**
 * assigned → $assignee_email={login email}
 * created  → $requester_email={login email}
 */
export async function fetchEmployeeSubtasksByScope(kfInstance, options = {}) {
  const email = loginEmailOf(kfInstance, options.email)
  const scope = options.scope === 'created' ? 'created' : 'assigned'
  if (!email || !email.includes('@')) {
    return { email: '', scope, rows: [] }
  }
  const key = cacheKey('emp-subtasks-report-v5', scope, email)
  if (options.bust) invalidateListCache(key)

  return getCachedOrLoad(key, async () => {
    const assigneePromise = resolveDashboardAssignee(kfInstance, email, options.userId)
    const fromAdmin = async (assignee) => {
      const fallback = await fetchSubtaskProcessData(kfInstance, { email, bust: options.bust })
      const mine = email.toLowerCase()
      const rows = (Array.isArray(fallback) ? fallback : []).filter((row) => {
        if (scope === 'created') return rowRequesterEmail(row) === mine
        return rowMatchesCurrentAssignee(row, assignee.email, assignee.userId)
      })
      return { email, scope, rows }
    }
    try {
      const [assignee, page] = await Promise.all([
        assigneePromise,
        fetchReportPages(kfInstance, { email, scope }),
      ])
      const mapped = mapReportScopeRows(page)
      const rows = scope === 'created'
        ? mapped.filter((row) => rowRequesterEmail(row) === assignee.email)
        : mapped.filter((row) => rowMatchesCurrentAssignee(row, assignee.email, assignee.userId))
      return { email: assignee.email, scope, rows }
    } catch (error) {
      console.warn(`Employee ${scope} subtasks report failed:`, error?.message || error)
      return fromAdmin(await assigneePromise)
    }
  })
}

export async function fetchEmployeeDashboardSubtasks(kfInstance, options = {}) {
  const email = loginEmailOf(kfInstance, options.email)
  if (!email || !email.includes('@')) {
    return { assigned: [], created: [], all: [], email: '' }
  }
  const [assignedSettled, createdSettled] = await Promise.allSettled([
    fetchEmployeeSubtasksByScope(kfInstance, { email, scope: 'assigned', bust: options.bust }),
    fetchEmployeeSubtasksByScope(kfInstance, { email, scope: 'created', bust: options.bust }),
  ])
  const assigned = assignedSettled.status === 'fulfilled' ? assignedSettled.value.rows : []
  const created = createdSettled.status === 'fulfilled' ? createdSettled.value.rows : []
  const byId = new Map()
  for (const row of [...assigned, ...created]) {
    const key = String(row.InstanceID || row.id || '').trim()
    if (!key || byId.has(key)) continue
    byId.set(key, row)
  }
  return { email, assigned, created, all: [...byId.values()] }
}
