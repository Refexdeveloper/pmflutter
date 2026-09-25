/**
 * Data loaders for My Items Pro — uses the same Kissflow APIs as ProjectDashboardPage /
 * TasksDashboard / SubTasksDashboard / CRDashboard.
 */

import { fetchProjectListSummary, personMatches } from './kfProjectDashboard.js'
import { fetchTaskTrackerData, fetchEmployeeTaskTrackerData, isTaskCompleted } from './kfTaskTracker.js'
import { fetchSubtaskProcessData, isSubtaskCompleted } from './kfSubtaskTracker.js'
import { fetchChangeRequestDashboardData } from './kfChangeRequestDashboard.js'

function fmtProgress(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  if (v <= 1 && v > 0) return `${Math.round(v * 100)}%`
  return `${Math.round(v)}%`
}

function fmtDateDisplay(iso) {
  if (!iso || iso === '—') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return d.toLocaleDateString('en-US')
}

function normalizeStatusLabel(raw, entityKey) {
  const s = String(raw || '').trim()
  if (!s || s === '—') return entityKey === 'projects' ? 'Active' : 'Open'
  const lower = s.toLowerCase()
  if (lower.includes('complete') || lower.includes('closed') || lower.includes('done')) return 'Completed'
  if (lower.includes('hold')) return 'On Hold'
  if (lower.includes('plan') || lower.includes('draft') || lower.includes('new')) {
    return entityKey === 'projects' ? 'Planning' : 'Open'
  }
  if (lower.includes('overdue') || lower.includes('delay')) return 'Overdue'
  if (lower.includes('progress') || lower.includes('active') || lower.includes('review')) {
    return entityKey === 'projects' ? 'Active' : 'In Progress'
  }
  if (lower.includes('pending') || lower.includes('open')) return entityKey === 'projects' ? 'Active' : 'Open'
  return s
}

function baseRow({
  id,
  name,
  vendor,
  status,
  progress,
  priority,
  secondary,
  startDate,
  endDate,
  createdDate,
  description,
  activityId,
  activityInstanceId,
  createdBy,
  raw,
  delayDays = 0,
  entityKey,
}) {
  const statusNorm = normalizeStatusLabel(status, entityKey)
  const endIso = endDate && endDate !== '—' ? String(endDate).slice(0, 10) : '—'
  const unassigned = !vendor || vendor === '—' || /unassigned/i.test(vendor)
  const highPri = /high|critical|p1/i.test(String(priority || ''))
  return {
    id: String(id),
    name: name || '—',
    vendor: vendor || '—',
    rawItem: raw,
    raw,
    valueDisplay: typeof progress === 'string' ? progress : fmtProgress(progress),
    endDate: endIso,
    startDateDisplay: fmtDateDisplay(startDate),
    endDateDisplay: fmtDateDisplay(endDate),
    contractType: secondary || '—',
    contractRequestDisplay: String(id),
    contractCategory: priority || '—',
    contractDescription: description || '',
    currency: '',
    paymentType: '—',
    contractDocumentsSummary: '—',
    ratingOverall: null,
    ratingTat: null,
    ratingService: null,
    ratingResponse: null,
    ratingPm: null,
    nda: unassigned ? 'No' : 'Yes',
    msa: delayDays > 0 ? 'No' : 'Yes',
    sow: highPri ? 'No' : 'Yes',
    fullName: vendor || '—',
    phoneNumber: '',
    emailId: '',
    address: '',
    message: description || '',
    website: secondary || '—',
    createdDate: createdDate || '',
    modifiedAt: '',
    completedAt: '',
    status: statusNorm,
    progress: Number(progress) || 0,
    createdBy: createdBy || vendor || '',
    currentStep: '',
    activityId: activityId || '',
    activityInstanceId: activityInstanceId || '',
    slaDeadline: endIso !== '—' ? endIso : '',
    contractTitle: name || '—',
    valueNum: Number(progress) || 0,
    endDateObj: endIso !== '—' ? new Date(endIso) : null,
    createdDateObj: createdDate ? new Date(createdDate) : null,
    businessStatus: statusNorm,
    vendorCategory: secondary || '—',
    delayDays,
    priority: priority || '—',
    _entityKey: entityKey,
  }
}

export function mapProjectDashboardRowToMyItem(row) {
  const overdue = (row.delayDays || 0) > 0 && row.status !== 'Completed'
  return baseRow({
    id: row.id,
    name: row.name,
    vendor: row.owner,
    status: overdue ? 'Overdue' : row.status,
    progress: row.progress,
    priority: row.priority,
    secondary: row.department || row.lineOfBusiness || row.entity,
    startDate: row.startDate,
    endDate: row.originalEndDate || row.revisedEndDate,
    createdDate: row.startDate,
    description: row.risk && row.risk !== 'N/A' ? `Risk: ${row.risk}` : '',
    activityId: '',
    activityInstanceId: '',
    createdBy: row.owner,
    raw: row,
    delayDays: row.delayDays || 0,
    entityKey: 'projects',
  })
}

export function mapTaskTrackerRowToMyItem(row) {
  const completed = isTaskCompleted(row.status)
  const overdue = !completed && ((row.delayDays || 0) > 0 || /overdue/i.test(String(row.status || '')))
  const progress = completed ? 100 : overdue ? 35 : 55
  return baseRow({
    id: row.InstanceID || row._id || row.id,
    name: row.taskName,
    vendor: row.assignedTo,
    status: overdue ? 'Overdue' : row.status,
    progress,
    priority: row.raw?.Task_Priority || row.priority || '—',
    secondary: row.projectName,
    startDate: row.startDate,
    endDate: row.endDate,
    createdDate: row.startDate,
    description: '',
    activityId: row.ActivityID || '',
    activityInstanceId: Array.isArray(row._activity_instance_id)
      ? row._activity_instance_id[0]
      : row._activity_instance_id || row.ActivityID || '',
    createdBy: row.assignedTo,
    raw: row.raw || row,
    delayDays: row.delayDays || 0,
    entityKey: 'tasks',
  })
}

export function mapSubtaskTrackerRowToMyItem(row) {
  const completed = isSubtaskCompleted(row.status)
  return baseRow({
    id: row.InstanceID || row._id || row.id,
    name: row.subtaskName,
    vendor: row.assignedTo,
    status: row.status,
    progress: completed ? 100 : (row.agingDays || 0) > 21 ? 35 : 55,
    priority: '—',
    secondary: row.parentTaskName,
    startDate: row.createdDate,
    endDate: '—',
    createdDate: row.createdDate,
    description: row.summary && row.summary !== '—' ? row.summary : '',
    activityId: row.ActivityID || '',
    activityInstanceId: Array.isArray(row._activity_instance_id)
      ? row._activity_instance_id[0]
      : row._activity_instance_id || row.ActivityID || '',
    createdBy: row.createdBy || row.assignedTo,
    raw: row.raw || row,
    delayDays: !completed && (row.agingDays || 0) > 21 ? row.agingDays : 0,
    entityKey: 'subtasks',
  })
}

export function mapChangeRequestRowToMyItem(row) {
  return baseRow({
    id: row.id,
    name: row.name,
    vendor: row.owner,
    status: row.status,
    progress: row.priority,
    priority: row.priority,
    secondary: row.projectName || row.lineOfBusiness,
    startDate: row.startDate,
    endDate: row.originalEndDate || row.revisedEndDate,
    createdDate: row.startDate,
    description: row.description && row.description !== '—' ? row.description : '',
    activityId: '',
    activityInstanceId: '',
    createdBy: row.owner,
    raw: row.raw || row,
    delayDays: row.delayDays || 0,
    entityKey: 'changeRequests',
  })
}

/**
 * Fetch all rows for a My Items Pro entity using Project Tracker dashboard APIs.
 * @returns {{ items: object[], tasks: object[], statusCounts: Record<string, number> }}
 */
export async function fetchPmMyItemsEntityData(kfInstance, entity) {
  const key = entity?.key
  if (!kfInstance?.api) {
    throw new Error('Kissflow SDK not ready — open this page inside Kissflow.')
  }

  if (key === 'projects') {
    const { rows } = await fetchProjectListSummary(kfInstance)
    const items = rows.map(mapProjectDashboardRowToMyItem)
    return { items, tasks: items.filter((r) => r.status === 'Active' || r.status === 'Planning'), statusCounts: countByStatus(items) }
  }

  if (key === 'tasks') {
    let rows = []
    try {
      rows = await fetchEmployeeTaskTrackerData(kfInstance)
    } catch {
      rows = []
    }
    if (!rows.length) {
      try {
        rows = await fetchTaskTrackerData(kfInstance)
      } catch {
        rows = []
      }
    }
    const items = rows.map(mapTaskTrackerRowToMyItem)
    const tasks = items.filter((r) => !isTaskCompleted(r.status))
    return { items, tasks, statusCounts: countByStatus(items) }
  }

  if (key === 'subtasks') {
    const rows = await fetchSubtaskProcessData(kfInstance)
    const items = rows.map(mapSubtaskTrackerRowToMyItem)
    const tasks = items.filter((r) => !isSubtaskCompleted(r.status))
    return { items, tasks, statusCounts: countByStatus(items) }
  }

  if (key === 'changeRequests') {
    const { rows } = await fetchChangeRequestDashboardData(kfInstance)
    const items = rows.map(mapChangeRequestRowToMyItem)
    const tasks = items.filter((r) => !String(r.status).toLowerCase().includes('complete'))
    return { items, tasks, statusCounts: countByStatus(items) }
  }

  return { items: [], tasks: [], statusCounts: {} }
}

function countByStatus(items) {
  const counts = {}
  for (const row of items) {
    const s = row.status || 'Open'
    counts[s] = (counts[s] || 0) + 1
  }
  return counts
}

/** Filter My Tasks to rows owned/assigned to the signed-in user when possible. */
export function filterMyTasksForUser(rows, user) {
  if (!user || !Array.isArray(rows)) return Array.isArray(rows) ? rows : []
  const matched = rows.filter((r) => {
    if (personMatches(user, r.vendor)) return true
    if (personMatches(user, r.createdBy)) return true
    return false
  })
  return matched.length > 0 ? matched : rows
}
