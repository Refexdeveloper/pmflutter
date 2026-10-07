/**
 * Project create form dropdowns from the live case form.
 * Functions is the Project_Category select:
 * GET /case/2/{account}/Project_Management_A01/{item}/Project_Category/dropdown
 */

import { useEffect, useState } from 'react'
import { KF_LIVE_ACCOUNT_ID } from './kfAccessKeys.js'
import { KF_PM_CASE_ID, KF_PM_TRACKER_APP_ID } from './kfPmApp.js'
import {
  isLocalVitePreview,
  kfGetJson,
  localLiveReadUrl,
  resolveKissflowAccountId,
} from './kfRuntime.js'

const FUNCTIONS_FIELD_ID = 'Project_Category'
/** Any existing case item works; the select options are not item-specific. */
const SEED_ITEM_ID = 'PRJ-0143'
const CACHE_TTL_MS = 10 * 60 * 1000

/** Last measured live Project_Category dropdown, used until the API returns. */
export const PROJECT_FUNCTION_FALLBACK = [
  'Administration',
  'Aviation',
  'Business Development',
  'Commercial',
  'Company Secretarial',
  'Corporate',
  'Corporate Affairs',
  'Corporate Communication',
  'Corporate Finance',
  'Corporate Function',
  'Design & Engineering',
  'ESG & HSE',
  'Finance & Accounts',
  'Fleet',
  'Human Resource',
  'Human Resources',
  'Information Security',
  'Information Technology',
  'Infrastructure',
  'Investment Management',
  'Legal',
  'Logistics',
  'MD & CEO Office',
  'Manufacturing Operations',
  'Marketing',
  'Merger & Acquisition',
  'Operations',
  'Operations & Maintenance',
  'Production',
  'Projects',
  'Purchase',
  'Quality',
  'Research & Development',
  'SCM',
  'Safety',
  'Sales',
  'Service',
  'Services',
  'Stores',
  'Strategic Initiatives',
  'Strategy MD Office',
  'Tendering',
  'Warehouse',
]

let cache = { at: 0, values: null }

function parseDropdownValues(payload) {
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

async function loadJson(kf, path) {
  if (isLocalVitePreview()) {
    const res = await fetch(localLiveReadUrl(path), {
      method: 'GET',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(25000),
    })
    const data = await res.json().catch(() => [])
    if (!res.ok) {
      const err = new Error(data?.en_message || data?.message || `HTTP ${res.status}`)
      err.status = res.status
      throw err
    }
    return data
  }
  return kfGetJson(kf, path, { allowWhenPaused: true, retries: 1 })
}

async function resolveItemId(kf, accountId) {
  try {
    const data = await loadJson(
      kf,
      `/case/2/${accountId}/${KF_PM_CASE_ID}/list?page_number=1&page_size=1`,
    )
    const item = data?.Data?.[0] || (Array.isArray(data) ? data[0] : null)
    const id = String(item?._id || '').trim()
    if (id) return id
  } catch {
    /* seed item still serves the same form dropdown */
  }
  return SEED_ITEM_ID
}

export async function loadProjectFunctions(kf) {
  if (cache.values?.length && Date.now() - cache.at < CACHE_TTL_MS) return cache.values

  const accountId = isLocalVitePreview()
    ? KF_LIVE_ACCOUNT_ID
    : resolveKissflowAccountId(kf, KF_LIVE_ACCOUNT_ID) || KF_LIVE_ACCOUNT_ID
  const itemId = await resolveItemId(kf, accountId)
  const values = []
  for (let page = 1; page <= 8; page += 1) {
    const qs = new URLSearchParams({
      _application_id: KF_PM_TRACKER_APP_ID,
      q: '',
      page_number: String(page),
      page_size: '100',
    })
    const path =
      `/case/2/${accountId}/${KF_PM_CASE_ID}/${encodeURIComponent(itemId)}/` +
      `${FUNCTIONS_FIELD_ID}/dropdown?${qs}`
    const rows = parseDropdownValues(await loadJson(kf, path))
    values.push(...rows)
    if (rows.length < 100) break
  }
  if (!values.length) return PROJECT_FUNCTION_FALLBACK.slice()
  cache = { at: Date.now(), values }
  return values
}

export function useProjectFunctions(kf) {
  const [options, setOptions] = useState(() => PROJECT_FUNCTION_FALLBACK.slice())

  useEffect(() => {
    let cancelled = false
    loadProjectFunctions(kf)
      .then((rows) => {
        if (!cancelled && rows?.length) setOptions(rows)
      })
      .catch(() => {
        if (!cancelled) setOptions(PROJECT_FUNCTION_FALLBACK.slice())
      })
    return () => {
      cancelled = true
    }
  }, [kf])

  return options
}
