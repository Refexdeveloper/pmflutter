/**
 * Kissflow application Lists for Project Management Tracker.
 * https://development-refexgroup.kissflow.com/appbuilder/Project_Management_Tracker_A00/list/
 *
 * GET /flow/2/{account}/list
 * GET /flow/2/{account}/list/{listId}/items?_application_id=Project_Management_Tracker_A00
 */

import {
  KF_ACCESS_KEY_ID,
  KF_ACCESS_KEY_SECRET,
  KF_DEV_ACCOUNT_ID,
  KF_LIVE_ACCESS_KEY_ID,
  KF_LIVE_ACCESS_KEY_SECRET,
  KF_LIVE_ACCOUNT_ID,
  buildKissflowAccessKeyHeaders,
  getTenantAccessKeys,
} from './kfAccessKeys.js'
import { KF_PM_TRACKER_APP_ID } from './kfPmApp.js'
import { isLocalVitePreview, kfGetJson } from './kfRuntime.js'

/** Field id on the task form → list id in Project_Management_Tracker_A00. */
export const TASK_FIELD_APP_LISTS = {
  Task_type: 'List_Task_Type_A00',
  Functions: 'List_Function_Type_A00',
}

const APP_Q = `_application_id=${encodeURIComponent(KF_PM_TRACKER_APP_ID)}`

function parseListItems(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.Data)
      ? payload.Data
      : Array.isArray(payload?.data)
        ? payload.data
        : []
  const out = []
  const seen = new Set()
  for (const item of rows) {
    const text =
      typeof item === 'string' || typeof item === 'number'
        ? String(item).trim()
        : String(item?.Name || item?.name || item?.Value || item?.value || '').trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  return out
}

async function getJson(kfInstance, path) {
  if (isLocalVitePreview()) {
    const tenant = getTenantAccessKeys(kfInstance)
    const proxy = tenant.tenant === 'live' ? '/kf-live' : '/kf-dev'
    const keyId = tenant.tenant === 'live' ? KF_LIVE_ACCESS_KEY_ID : KF_ACCESS_KEY_ID
    const keySecret = tenant.tenant === 'live' ? KF_LIVE_ACCESS_KEY_SECRET : KF_ACCESS_KEY_SECRET
    const res = await fetch(`${proxy}${path}`, {
      method: 'GET',
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        ...buildKissflowAccessKeyHeaders(keyId, keySecret),
      },
    })
    const data = await res.json().catch(() => [])
    if (!res.ok) {
      throw new Error(data?.en_message || data?.message || `HTTP ${res.status}`)
    }
    return data
  }
  return kfGetJson(kfInstance, path, { allowWhenPaused: true, retries: 1 })
}

export function appListItemsPath(accountId, listId, page = 1, pageSize = 500) {
  const account = encodeURIComponent(String(accountId || '').trim())
  const id = encodeURIComponent(String(listId || '').trim())
  return `/flow/2/${account}/list/${id}/items?${APP_Q}&page_number=${page}&page_size=${pageSize}`
}

export async function fetchAppListItems(kfInstance, listId, accountId = KF_DEV_ACCOUNT_ID) {
  const id = String(listId || '').trim()
  if (!id) return []
  const preferred = String(accountId || '').trim() || KF_DEV_ACCOUNT_ID
  const accounts = [...new Set([preferred, KF_DEV_ACCOUNT_ID, KF_LIVE_ACCOUNT_ID].filter(Boolean))]
  for (const account of accounts) {
    try {
      const rows = parseListItems(await getJson(kfInstance, appListItemsPath(account, id)))
      if (rows.length) return rows
    } catch {
      /* try next account */
    }
  }
  return []
}

/** Task_type / Functions options from the app Lists page. */
export async function fetchTaskFieldAppLists(kfInstance) {
  const tenant = getTenantAccessKeys(kfInstance)
  const accountId = tenant.defaultAccountId || KF_DEV_ACCOUNT_ID
  const out = {}
  await Promise.all(
    Object.entries(TASK_FIELD_APP_LISTS).map(async ([fieldId, listId]) => {
      out[fieldId] = await fetchAppListItems(kfInstance, listId, accountId)
    }),
  )
  return out
}
