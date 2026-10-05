/**
 * Employee / User Hub project dashboard — Kissflow externalreport_A00
 *
 * GET /process-report/2/AcCMptp3yqcn/Project_Management_A01/externalreport_A00
 *   ?$externlemail={login email}&_application_id=Project_Management_Tracker_A00
 *
 * Project_Management_A01 is a case, so process-report may 403; fall back to
 * /case-report/2/…/externalreport_A00 (same report id).
 *
 * Show a project when AssignedTo is the login Kissflow user, or externlemail
 * equals the login email. Do not invent a Kissflow owner from that email.
 */

import { KF_PM_CASE_ID, KF_PM_TRACKER_APP_ID } from './kfPmApp.js'
import { fetchProjectListSummary, mapItemsToProjectRows } from './kfProjectDashboard.js'
import { cacheKey, getCachedOrLoad } from './kfListCache.js'
import { loginEmailOf } from './kfEmployeeTasksReport.js'
import { resolveDashboardAssignee, rowMatchesCurrentAssignee } from './kfUserField.js'
import { isLocalVitePreview } from './kfRuntime.js'
import {
  buildReportFieldMaps,
  fetchReportPages as fetchEmployeeReportPages,
  normalizeReportEmail,
  readReportRowField,
  reportFieldText,
} from './kfEmployeeReportCore.js'

export const EMP_PROJECT_ACCOUNT_ID = 'AcCMptp3yqcn'
export const EMP_PROJECT_CASE_ID = KF_PM_CASE_ID
export const EMP_PROJECT_REPORT_ID = 'externalreport_A00'
export const EMP_PROJECT_APP_ID = KF_PM_TRACKER_APP_ID
export const EMP_PROJECT_PAGE_SIZE = 500

const normalizeEmail = normalizeReportEmail
const toText = reportFieldText
const buildFieldMaps = buildReportFieldMaps
const readRowField = readReportRowField

function reportExternalEmail(row) {
  return (
    normalizeEmail(row?.externlemail) ||
    normalizeEmail(row?.externalemail) ||
    normalizeEmail(row?.Externlemail) ||
    normalizeEmail(row?.ExternalEmail)
  )
}

/**
 * Same report the user pointed at:
 * /process-report/2/AcCMptp3yqcn/Project_Management_A01/externalreport_A00
 *   ?$externlemail=…&_application_id=Project_Management_Tracker_A00
 */
export function buildEmployeeProjectsReportPath(_kfInstance, options = {}) {
  const kind = options.kind === 'case-report' ? 'case-report' : 'process-report'
  const page = Math.max(1, Number(options.page) || 1)
  const pageSize = Math.max(1, Number(options.pageSize) || EMP_PROJECT_PAGE_SIZE)
  const parts = [
    `_application_id=${encodeURIComponent(EMP_PROJECT_APP_ID)}`,
  ]
  parts.push(`page_number=${page}`)
  parts.push(`page_size=${pageSize}`)
  return `/${kind}/2/${EMP_PROJECT_ACCOUNT_ID}/${EMP_PROJECT_CASE_ID}/${EMP_PROJECT_REPORT_ID}?${parts.join('&')}`
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

  const itemId = toText(out._item_id) || toText(read('_item_id')) || toText(row._id) || toText(out.Project_ID)
  if (itemId) {
    out._item_id = itemId
    if (!out._id) out._id = itemId
  }
  if (!out.Name && out.Project_Name) out.Name = out.Project_Name
  if (!out._status_name && out.Status_1) out._status_name = toText(out.Status_1)
  if (!out.AssignedTo && out.Assigned_To) out.AssignedTo = out.Assigned_To
  if (!out.externlemail && out.externalemail) out.externlemail = out.externalemail
  if (!out.externalemail && out.externlemail) out.externalemail = out.externlemail
  return out
}

function mapProjectReportRows(items) {
  const detailById = {}
  for (const item of items) {
    const id = item?._item_id || item?._id
    if (id) detailById[id] = item
  }
  return mapItemsToProjectRows(items, detailById, {}, null).map((row, index) => {
    const raw = items[index] || {}
    return {
      ...row,
      externalEmail: reportExternalEmail(raw),
      raw,
    }
  })
}

async function fetchProjectReportPages(kfInstance, options) {
  const kinds = isLocalVitePreview()
    ? ['case-report', 'process-report']
    : ['process-report', 'case-report']
  let lastError
  for (const kind of kinds) {
    try {
      return await fetchEmployeeReportPages(kfInstance, {
        pageSize: options.pageSize || EMP_PROJECT_PAGE_SIZE,
        buildPath: (page) => buildEmployeeProjectsReportPath(kfInstance, { ...options, page, kind }),
      })
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('Project external report failed')
}

/**
 * Load externalreport_A00 and keep rows where login email === externlemail.
 */
function rowsForLoginAssignee(items, email, userId) {
  return (Array.isArray(items) ? items : []).filter((row) => rowMatchesCurrentAssignee(row, email, userId))
}

export async function fetchEmployeeDashboardProjects(kfInstance, options = {}) {
  const email = loginEmailOf(kfInstance, options.email)
  if (!email || !email.includes('@')) {
    return { email: '', rows: [], subtasks: [], listItems: [], fieldIds: null, accountId: EMP_PROJECT_ACCOUNT_ID }
  }
  const assignee = await resolveDashboardAssignee(kfInstance, email, options.userId)

  return getCachedOrLoad(cacheKey('emp-projects-report-v2', assignee.email, assignee.userId, options.bust ? 'bust' : ''), async () => {
    let matched = []
    try {
      const page = await fetchProjectReportPages(kfInstance, {
        pageSize: EMP_PROJECT_PAGE_SIZE,
      })
      const hydrated = (page.rows || []).map((row) => hydrateReportRow(row, page.columns))
      matched = rowsForLoginAssignee(hydrated, assignee.email, assignee.userId)
    } catch (error) {
      console.warn('Employee project report failed:', error?.message || error)
      const summary = await fetchProjectListSummary(kfInstance)
      matched = rowsForLoginAssignee(summary?.listItems, assignee.email, assignee.userId)
    }
    const rows = mapProjectReportRows(matched)
    return {
      email: assignee.email,
      rows,
      subtasks: rows.flatMap((row) => row.subtasks || []),
      listItems: matched,
      fieldIds: null,
      accountId: EMP_PROJECT_ACCOUNT_ID,
    }
  })
}
