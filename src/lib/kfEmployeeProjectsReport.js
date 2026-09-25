/**
 * Employee / User Hub project dashboard — Kissflow externalreport_A00
 *
 * GET /process-report/2/AcCMptp3yqcn/Project_Management_A01/externalreport_A00
 *   ?$externlemail={login email}&_application_id=Project_Management_Tracker_A00
 *
 * Project_Management_A01 is a case, so process-report may 403; fall back to
 * /case-report/2/…/externalreport_A00 (same report id).
 *
 * Show rows where login email equals `externlemail` (Kissflow field id).
 * Do not invent a Kissflow owner object from that email.
 */

import { KF_PM_CASE_ID, KF_PM_TRACKER_APP_ID } from './kfPmApp.js'
import { mapItemsToProjectRows } from './kfProjectDashboard.js'
import { cacheKey, getCachedOrLoad } from './kfListCache.js'
import { loginEmailOf } from './kfEmployeeTasksReport.js'
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

function emailsMatch(left, right) {
  const a = normalizeEmail(left)
  const b = normalizeEmail(right)
  return Boolean(a && b && a === b)
}

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
  const email = String(options.email || '').trim()
  const page = Math.max(1, Number(options.page) || 1)
  const pageSize = Math.max(1, Number(options.pageSize) || EMP_PROJECT_PAGE_SIZE)
  const parts = []
  if (email) parts.push(`$externlemail=${encodeURIComponent(email)}`)
  parts.push(`_application_id=${encodeURIComponent(EMP_PROJECT_APP_ID)}`)
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
export async function fetchEmployeeDashboardProjects(kfInstance, options = {}) {
  const email = loginEmailOf(kfInstance, options.email)
  if (!email || !email.includes('@')) {
    return { email: '', rows: [], subtasks: [], listItems: [], fieldIds: null, accountId: EMP_PROJECT_ACCOUNT_ID }
  }

  return getCachedOrLoad(cacheKey('emp-projects-report', email, options.bust ? 'bust' : ''), async () => {
    const page = await fetchProjectReportPages(kfInstance, {
      email,
      pageSize: EMP_PROJECT_PAGE_SIZE,
    })
    const hydrated = (page.rows || []).map((row) => hydrateReportRow(row, page.columns))
    const matched = hydrated.filter((row) => emailsMatch(reportExternalEmail(row), email))
    const rows = mapProjectReportRows(matched)
    return {
      email,
      rows,
      subtasks: rows.flatMap((row) => row.subtasks || []),
      listItems: matched,
      fieldIds: null,
      accountId: EMP_PROJECT_ACCOUNT_ID,
    }
  })
}
