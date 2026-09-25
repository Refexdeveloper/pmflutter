/**
 * Recently created items shown on dashboards before Kissflow list APIs catch up.
 */

import { useEffect, useState } from 'react'
import { mapAdminTaskRow } from './kfTaskTracker.js'
import { mapAdminSubtaskRow } from './kfSubtaskTracker.js'
import { kissflowUserFromPerson } from './kfUserField.js'

const STORAGE_KEY = 'pm:local-created-v1'
export const PM_LOCAL_CREATED = 'pm-local-created'

function normalizeKind(kind) {
  const key = String(kind || '').trim().toLowerCase()
  if (key === 'projects' || key === 'project') return 'project'
  if (key === 'tasks' || key === 'task') return 'task'
  if (key === 'subtasks' || key === 'subtask') return 'subtask'
  return key
}

function readAll() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}')
    return {
      project: Array.isArray(raw.project) ? raw.project : [],
      task: Array.isArray(raw.task) ? raw.task : [],
      subtask: Array.isArray(raw.subtask) ? raw.subtask : [],
    }
  } catch {
    return { project: [], task: [], subtask: [] }
  }
}

function writeAll(next) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PM_LOCAL_CREATED, { detail: next }))
  }
}

function rowKey(row) {
  return String(
    row?.id ||
      row?._id ||
      row?.InstanceID ||
      row?.taskName ||
      row?.subtaskName ||
      row?.name ||
      '',
  ).trim()
}

export function rememberLocalCreated(kind, row) {
  if (!row || typeof window === 'undefined') return
  const key = normalizeKind(kind)
  if (!key) return
  const all = readAll()
  const list = Array.isArray(all[key]) ? all[key] : []
  const id = rowKey(row)
  all[key] = [row, ...list.filter((item) => rowKey(item) !== id)].slice(0, 50)
  writeAll(all)
}

export function getLocalCreated(kind) {
  const key = normalizeKind(kind)
  return readAll()[key] || []
}

export function mergeLocalCreated(kind, remote = []) {
  const local = getLocalCreated(kind)
  if (!local.length) return Array.isArray(remote) ? remote : []
  const seen = new Set(local.map(rowKey).filter(Boolean))
  const rest = (Array.isArray(remote) ? remote : []).filter((row) => {
    const id = rowKey(row)
    return !id || !seen.has(id)
  })
  return [...local, ...rest]
}

function personFromCreateFields(fields = {}) {
  return (
    kissflowUserFromPerson(fields.Assigned_To) ||
    kissflowUserFromPerson(fields.Assignee_1) ||
    kissflowUserFromPerson(fields.Business_Owner) ||
    kissflowUserFromPerson(fields._created_by) ||
    null
  )
}

export function rememberCreatedFromWebhook(kind, { fields = {}, created = {} } = {}) {
  const source = normalizeKind(kind)
  const id = String(created?.instanceId || created?._id || `local-${Date.now()}`).trim()
  const stamp = new Date().toISOString()
  const person = personFromCreateFields(fields)
  if (source === 'task') {
    rememberLocalCreated(
      'task',
      mapAdminTaskRow({
        ...fields,
        _id: id,
        _created_at: stamp,
        ...(person ? { _created_by: person } : {}),
      }),
    )
    return
  }
  if (source === 'subtask') {
    rememberLocalCreated(
      'subtask',
      mapAdminSubtaskRow({
        ...fields,
        _id: id,
        _created_at: stamp,
        ...(person ? { _created_by: person } : {}),
      }),
    )
    return
  }
  if (source === 'project') {
    rememberLocalCreated('project', {
      id,
      displayId: id,
      name: fields.Project_Name || fields.Name || 'Untitled project',
      owner: person?.Name || '',
      ownerId: person?._id || '',
      ownerEmail: person?.Email || '',
      businessOwner: person?.Name || '',
      status: fields.Project_Status || 'Planning',
      startDate: fields.Start_Date || '',
      endDate: fields.End_Date || '',
      priority: fields.Priority_1 || '',
      rag: 'Amber',
      progress: 0,
      companyName: fields.Company_Name || '',
      lineOfBusiness: fields.Functions || fields.Project_Category || '',
      delayDays: 0,
      raw: { ...fields, _id: id },
    })
  }
}

export function useLocalCreated(kind) {
  const [rows, setRows] = useState(() => getLocalCreated(kind))
  useEffect(() => {
    const refresh = () => setRows(getLocalCreated(kind))
    refresh()
    window.addEventListener(PM_LOCAL_CREATED, refresh)
    return () => window.removeEventListener(PM_LOCAL_CREATED, refresh)
  }, [kind])
  return rows
}
