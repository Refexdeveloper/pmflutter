/**
 * One Kissflow integration webhook for Project / Task / Sub-Task create.
 * Same URL; JSON `source` is project | task | subtask, and only that bucket is filled.
 */

import { compactFields, isKissflowUserId, sanitizeWebhookUserFields } from './kfUserField.js'
import { sanitizeCreateFields } from './pmCreatePayload.js'
import { isLocalVitePreview } from './kfRuntime.js'

const CREATE_WEBHOOK_PATH = '/api/pm/create-webhook'

export const PM_CREATE_SOURCES = {
  project: 'project',
  task: 'task',
  subtask: 'subtask',
}

const ENTITY_SOURCE = {
  projects: PM_CREATE_SOURCES.project,
  tasks: PM_CREATE_SOURCES.task,
  subtasks: PM_CREATE_SOURCES.subtask,
}

function personSnapshot(user) {
  if (!user || typeof user !== 'object') return null
  const Name = String(user.Name || user.DisplayName || '').trim()
  const Email = String(user.Email || user.email || '').trim()
  const rawId = String(user._id || user.Id || '').trim()
  const _id = isKissflowUserId(rawId) ? rawId : ''
  if (!_id && !Email && !Name) return null
  return {
    ...(_id ? { _id } : {}),
    ...(Name ? { Name } : {}),
    ...(Email ? { Email } : {}),
  }
}

/** Map My Items entity key (projects/tasks/subtasks) → webhook source. */
export function sourceFromEntity(entity) {
  const key = String(entity?.key || entity || '').trim()
  return ENTITY_SOURCE[key] || ''
}

/**
 * Webhook body for createtask_A00.
 * One JSON model: source + project / task / subtask. Only the matching bucket is filled.
 */
export function buildPmCreateWebhookJson(source, { fields = {}, created = {}, user = null } = {}) {
  const src = String(source || '').trim().toLowerCase()
  if (!PM_CREATE_SOURCES[src]) {
    throw new Error(`Unknown create webhook source: ${source}`)
  }

  const data = sanitizeWebhookUserFields(
    compactFields(sanitizeCreateFields(src, fields) || {}) || {},
  )
  const submittedBy = personSnapshot(user)
  const instanceId = String(created?.instanceId || created?._id || '').trim()
  const activityInstanceId = String(created?.activityInstanceId || '').trim()

  const bucket = {
    ...data,
    ...(instanceId ? { _id: instanceId, InstanceID: instanceId } : {}),
    ...(activityInstanceId ? { ActivityInstanceID: activityInstanceId } : {}),
    ...(submittedBy?._id ? { Submitted_By: submittedBy } : {}),
    Submitted_At: new Date().toISOString(),
  }

  return {
    source: src,
    ...bucket,
    project: src === 'project' ? bucket : null,
    task: src === 'task' ? bucket : null,
    subtask: src === 'subtask' ? bucket : null,
  }
}

function persistLastCreateWebhook(record) {
  if (typeof window === 'undefined' || !record) return
  try {
    window.__pmLastCreateWebhook = record
    const raw = JSON.stringify(record)
    sessionStorage.setItem('pm:last-create-webhook', raw)
    localStorage.setItem('pm:last-create-webhook', raw)
    if (import.meta.env.DEV) {
      fetch('/__pm-last-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: raw,
      }).catch(() => {})
    }
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  try {
    const raw =
      sessionStorage.getItem('pm:last-create-webhook') ||
      localStorage.getItem('pm:last-create-webhook')
    if (raw) persistLastCreateWebhook(JSON.parse(raw))
  } catch {
    /* ignore */
  }
}

const webhookInFlight = new Map()

function webhookDedupeKey(payload) {
  const bucket = payload?.task || payload?.subtask || payload?.project || payload || {}
  return [
    payload?.source,
    bucket.Sub_Task_Name || bucket.Sub_task_Name || bucket.Name || '',
    bucket.Start_Date || '',
    bucket.End_Date || '',
    bucket.Assignee_Email || bucket.Assignee_Email_Extracted || '',
  ].join('|')
}

/**
 * POST the form snapshot to the shared webhook. Never posts the same create twice.
 */
export async function submitPmCreateWebhook(kfInstance, source, { fields, created, user, required = false } = {}) {
  const src = PM_CREATE_SOURCES[String(source || '').trim().toLowerCase()]
    ? String(source).trim().toLowerCase()
    : sourceFromEntity(source)
  if (!PM_CREATE_SOURCES[src]) {
    if (required) throw new Error('Unknown create webhook source')
    return null
  }

  const payload = buildPmCreateWebhookJson(src, {
    fields,
    created,
    user: user || kfInstance?.user || null,
  })

  const dedupeKey = webhookDedupeKey(payload)
  const pending = webhookInFlight.get(dedupeKey)
  if (pending) return pending

  persistLastCreateWebhook({ href: CREATE_WEBHOOK_PATH, payload, at: new Date().toISOString() })
  console.info('[pm-create-webhook] POST', CREATE_WEBHOOK_PATH, payload)
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  const body = JSON.stringify(payload)

  async function postOnce() {
    const res = await fetch(CREATE_WEBHOOK_PATH, {
      method: 'POST',
      credentials: 'omit',
      headers,
      body,
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 429) {
      const err = new Error('HTTP 429')
      err.status = 429
      throw err
    }
    if (!res.ok) {
      const message = data?.en_message || data?.message || `HTTP ${res.status}`
      if (required) throw new Error(message)
      console.warn('Create webhook HTTP', res.status, message)
      return null
    }
    return data
  }

  let run
  run = (async () => {
    try {
      return await postOnce()
    } catch (error) {
      console.warn('Create webhook failed:', error?.message || error)
      if (Number(error?.status) === 429 && isLocalVitePreview()) {
        return { ...payload, _rateLimited: true }
      }
      if (required) throw error
      return null
    } finally {
      setTimeout(() => {
        if (webhookInFlight.get(dedupeKey) === run) webhookInFlight.delete(dedupeKey)
      }, 2500)
    }
  })()
  webhookInFlight.set(dedupeKey, run)
  return run
}

/** Fire after a successful Kissflow create. Never rejects. */
export async function notifyPmCreateWebhook(kfInstance, entityOrSource, { fields, created } = {}) {
  const source = PM_CREATE_SOURCES[String(entityOrSource || '').trim()]
    ? String(entityOrSource).trim()
    : sourceFromEntity(entityOrSource)
  if (!source) return null
  try {
    return await submitPmCreateWebhook(kfInstance, source, { fields, created })
  } catch (error) {
    console.warn('Create webhook notify failed:', error?.message || error)
    return null
  }
}
