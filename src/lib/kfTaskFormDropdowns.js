/**
 * Task form dropdowns — same Kissflow field APIs as
 * Kissflow_Create_Task.postman_collection.json
 * GET /process/2/{account}/{process}/{flow}/{instance}/{field}/dropdown
 */

import { useEffect, useState } from 'react'
import {
  KF_LIVE_ACCESS_KEY_ID,
  KF_LIVE_ACCESS_KEY_SECRET,
  KF_LIVE_ACCOUNT_ID,
  KF_LIVE_API_ORIGIN,
  buildKissflowAccessKeyHeaders,
  getTenantAccessKeys,
} from './kfAccessKeys.js'
import { KF_PM_TRACKER_APP_ID } from './kfPmApp.js'
import { isLocalVitePreview, kfGetJson, resolveKissflowAccountId } from './kfRuntime.js'
import { fetchTaskFieldAppLists } from './kfAppLists.js'
import fallbacks from './kfTaskFormDropdownFallbacks.json'
import { TASKS_ENTITY } from './pmMyItemsEntities.js'

export const TASK_FORM_DROPDOWN_FIELDS = [
  'Task_Priority',
  'Task_type',
  'Entity',
  'Functions',
  'Task_Status',
]

/** Live tracker draft used by the Create Task Postman collection. */
const COLLECTION_SEED = {
  accountId: 'AcCMptlq60zH',
  processId: 'Project_Sub_Task_A01',
  applicationId: KF_PM_TRACKER_APP_ID,
  flowId: 'PkEEMVsFWCzm',
  instanceId: 'PkEEMVsJAqXH',
}

const CACHE_TTL_MS = 10 * 60 * 1000
let cache = { at: 0, options: null }

export function taskDropdownFallback(fieldId) {
  const rows = fallbacks?.[fieldId]
  return Array.isArray(rows) ? rows.slice() : []
}

export function mergeDropdownValue(options, current) {
  const list = Array.isArray(options) ? options.slice() : []
  const value = String(current || '').trim()
  if (value && !list.includes(value)) list.push(value)
  return list
}

function parseDropdownValues(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.values)
        ? payload.values
        : []
  const out = []
  const seen = new Set()
  for (const item of rows) {
    const text =
      typeof item === 'string' || typeof item === 'number'
        ? String(item).trim()
        : String(item?.Name || item?.name || item?.Value || item?.value || item?.label || '').trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  return out
}

function dropdownPath({ accountId, processId, flowId, instanceId, fieldId, applicationId, page }) {
  const qs = new URLSearchParams({
    _application_id: applicationId,
    q: '',
    page_number: String(page),
    page_size: '250',
  })
  return (
    `/process/2/${accountId}/${processId}/${encodeURIComponent(flowId)}/` +
    `${encodeURIComponent(instanceId)}/${fieldId}/dropdown?${qs}`
  )
}

async function fetchFieldPages(loadPage, ctx, fieldId) {
  const values = []
  for (let page = 1; page <= 20; page += 1) {
    const payload = await loadPage(dropdownPath({ ...ctx, fieldId, page }))
    const rows = parseDropdownValues(payload)
    values.push(...rows)
    if (rows.length < 250) break
  }
  return values
}

async function fetchLiveCollectionDropdowns() {
  const origin = String(KF_LIVE_API_ORIGIN || '').replace(/\/$/, '')
  const headers = buildKissflowAccessKeyHeaders(KF_LIVE_ACCESS_KEY_ID, KF_LIVE_ACCESS_KEY_SECRET)
  const ctx = {
    accountId: KF_LIVE_ACCOUNT_ID || COLLECTION_SEED.accountId,
    processId: COLLECTION_SEED.processId,
    flowId: COLLECTION_SEED.flowId,
    instanceId: COLLECTION_SEED.instanceId,
    applicationId: COLLECTION_SEED.applicationId,
  }
  const next = {}
  for (const fieldId of TASK_FORM_DROPDOWN_FIELDS) {
    next[fieldId] = await fetchFieldPages(async (path) => {
      const res = await fetch(`${origin}${path}`, {
        method: 'GET',
        credentials: 'omit',
        headers,
        signal: AbortSignal.timeout(25000),
      })
      const data = await res.json().catch(() => [])
      if (!res.ok) {
        const err = new Error(data?.en_message || data?.message || `HTTP ${res.status}`)
        err.status = res.status
        throw err
      }
      return data
    }, ctx, fieldId)
  }
  return next
}

async function fetchItemDropdowns(kf, instanceId, activityId) {
  const accountId = resolveKissflowAccountId(kf, TASKS_ENTITY.accountFallback)
  const processId = TASKS_ENTITY.processId
  const applicationId = KF_PM_TRACKER_APP_ID
  const pairs = [
    { flowId: activityId, instanceId },
    { flowId: instanceId, instanceId: activityId },
  ]
  const next = {}
  for (const pair of pairs) {
    try {
      for (const fieldId of TASK_FORM_DROPDOWN_FIELDS) {
        next[fieldId] = await fetchFieldPages(
          (path) => kfGetJson(kf, path, { allowWhenPaused: true, retries: 1 }),
          { accountId, processId, applicationId, ...pair },
          fieldId,
        )
      }
      if (TASK_FORM_DROPDOWN_FIELDS.every((id) => next[id]?.length)) return next
    } catch {
      /* try swapped ids / next source */
    }
  }
  return null
}

function mergeFetched(partial) {
  const out = {}
  for (const fieldId of TASK_FORM_DROPDOWN_FIELDS) {
    out[fieldId] = partial?.[fieldId]?.length ? partial[fieldId] : taskDropdownFallback(fieldId)
  }
  return out
}

export async function loadTaskFormDropdowns(kf, { instanceId = '', activityId = '' } = {}) {
  if (cache.options && Date.now() - cache.at < CACHE_TTL_MS) return cache.options

  const itemId = String(instanceId || '').trim()
  const actId = String(activityId || '').trim()
  const tenant = getTenantAccessKeys(kf)
  const fromAppLists = await fetchTaskFieldAppLists(kf).catch(() => ({}))

  if (itemId && actId && tenant.tenant === 'live' && !isLocalVitePreview()) {
    const fromItem = await fetchItemDropdowns(kf, itemId, actId).catch(() => null)
    if (fromItem) {
      cache = { at: Date.now(), options: applyAppLists(mergeFetched(fromItem), fromAppLists) }
      return cache.options
    }
  }

  try {
    const fromLive = await fetchLiveCollectionDropdowns()
    cache = { at: Date.now(), options: applyAppLists(mergeFetched(fromLive), fromAppLists) }
    return cache.options
  } catch (error) {
    console.warn('Kissflow task dropdowns unavailable:', error?.message || error)
    cache = { at: Date.now(), options: applyAppLists(mergeFetched(null), fromAppLists) }
    return cache.options
  }
}

function applyAppLists(base, appLists) {
  const out = { ...(base || {}) }
  if (appLists?.Task_type?.length) out.Task_type = appLists.Task_type
  if (appLists?.Functions?.length) {
    const seen = new Set(out.Functions || [])
    const extra = appLists.Functions.filter((row) => !seen.has(row))
    out.Functions = [...extra, ...(out.Functions || [])]
  }
  return out
}

export function useTaskFormDropdowns(kf, ids = {}) {
  const [options, setOptions] = useState(() => mergeFetched(null))

  useEffect(() => {
    let cancelled = false
    loadTaskFormDropdowns(kf, ids)
      .then((next) => {
        if (!cancelled && next) setOptions(next)
      })
      .catch(() => {
        if (!cancelled) setOptions(mergeFetched(null))
      })
    return () => {
      cancelled = true
    }
  }, [kf, ids.instanceId, ids.activityId])

  return options
}
