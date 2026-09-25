/**
 * Kissflow path builders for PM My Items Pro (Projects / Tasks / Subtasks / CR).
 * Mirrors Lead_KF kfContractPaths.js shape so the ContractsMyItemsPro shell can reuse the same call sites.
 */

import { resolveKissflowAccountId } from './kfRuntime.js'
import { KF_PM_TRACKER_APP_ID } from './kfPmApp.js'

function env(name, fallback = '') {
  try {
    const v = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]
    return v != null && String(v).trim() !== '' ? String(v).trim() : fallback
  } catch {
    return ''
  }
}

export function resolvePmApplicationId(kf, entity) {
  const fromEnv = env(`VITE_KF_${String(entity.key || '').toUpperCase()}_APP_ID`, '')
  if (fromEnv) return fromEnv
  if (kf && typeof kf === 'object') {
    try {
      const fromSdk = kf.app?._id || kf.context?.app?._id
      if (fromSdk) return String(fromSdk).trim()
    } catch {
      // ignore
    }
  }
  if (entity?.applicationIdFallback) return String(entity.applicationIdFallback).trim()
  return KF_PM_TRACKER_APP_ID
}

export function resolvePmPopupId(entity) {
  return env(entity.popupEnvKey, entity.popupId)
}

/**
 * Process-style paths (Tasks / Subtasks / CR) — same shape as buildContractProcessApiPaths.
 */
export function buildPmProcessApiPaths(kf, entity) {
  if (!entity || entity.kind !== 'process' || !entity.processId) return null
  const accountId = resolveKissflowAccountId(kf, entity.accountFallback)
  const applicationId = resolvePmApplicationId(kf, entity)
  const processId = entity.processId
  if (!accountId || !applicationId || !processId) return null

  const appQ = `_application_id=${encodeURIComponent(applicationId)}`

  return {
    kind: 'process',
    accountId,
    applicationId,
    processId,
    caseId: null,
    statusCountPath: `/process/2/${accountId}/${processId}/myitems/status/count?${appQ}`,
    itemBase: `/process/2/${accountId}/admin/${processId}`,
    myitemsBase: `/process/2/${accountId}/pwa/${processId}/myitems`,
    myitemsQuery: `apply_preference=1`,
    pendingCountPath: `/process/2/${accountId}/${processId}/pending/activity/count?${appQ}`,
    pendingBase: `/process/2/${accountId}/pwa/${processId}/pending`,
    pendingQuery: `apply_preference=1`,
    userPathPrefix: `/user/2/${accountId}/`,
    userPathSuffix: `?${appQ}`,
    openPageAppId: applicationId,
    getMyItemsPath(segment, pageNumber = 1, pageSize = 1000) {
      const pn = Math.max(1, Number(pageNumber) || 1)
      const ps = Math.min(1000, Math.max(1, Number(pageSize) || 1000))
      const seg = String(segment || 'draft')
      return `/process/2/${accountId}/${processId}/myitems/${seg}?apply_preference=true&page_number=${pn}&page_size=${ps}&skip_aggregation=true&${appQ}`
    },
    getAdminItemsPath(pageNumber = 1, pageSize = 1000) {
      const pn = Math.max(1, Number(pageNumber) || 1)
      const ps = Math.min(100000, Math.max(1, Number(pageSize) || 1000))
      return `/process/2/${accountId}/admin/${processId}/item?page_number=${pn}&page_size=${ps}&apply_preference=1`
    },
    /** Single admin item — Entity / Functions / Task_type / Table::Task_History (dev + prod). */
    getAdminItemDetailPath(instanceId) {
      const id = encodeURIComponent(String(instanceId || '').trim())
      return `/process/2/${accountId}/admin/${processId}/${id}?${appQ}`
    },
    getInstancePath(instanceId, activityInstanceId) {
      const id = encodeURIComponent(String(instanceId))
      if (activityInstanceId) {
        return `/process/2/${accountId}/${processId}/${id}/${encodeURIComponent(String(activityInstanceId))}?${appQ}`
      }
      return `/process/2/${accountId}/${processId}/${id}?${appQ}`
    },
    getProgressPath(instanceId) {
      return `/process/2/${accountId}/${processId}/${encodeURIComponent(String(instanceId))}/progress`
    },
    getPendingListPath(activityId, pageNumber = 1, pageSize = 10) {
      const pn = Math.max(1, Number(pageNumber) || 1)
      const ps = Math.min(1000, Math.max(1, Number(pageSize) || 10))
      return `/process/2/${accountId}/${processId}/pending/${encodeURIComponent(String(activityId))}?apply_preference=true&page_number=${pn}&page_size=${ps}&skip_aggregation=true&${appQ}`
    },
    getAdminDeletePath(recordId) {
      return `/process/2/${accountId}/admin/${processId}/${encodeURIComponent(String(recordId))}`
    },
  }
}

/**
 * Case-style paths (Projects) — adapted so the same shell can list “my items”.
 * Uses case view list for items/KPIs; myitems/pending are unavailable → shell falls back.
 */
export function buildPmCaseApiPaths(kf, entity) {
  if (!entity || entity.kind !== 'case' || !entity.caseId) return null
  const accountId = resolveKissflowAccountId(kf, entity.accountFallback)
  const applicationId = resolvePmApplicationId(kf, entity)
  const caseId = entity.caseId
  const viewId = entity.caseViewId || `${caseId}_all`
  if (!accountId || !caseId) return null

  const appQ = applicationId ? `_application_id=${encodeURIComponent(applicationId)}` : ''

  return {
    kind: 'case',
    accountId,
    applicationId: applicationId || caseId,
    processId: caseId,
    caseId,
    statusCountPath: null,
    itemBase: `/case/2/${accountId}/${caseId}`,
    pendingCountPath: null,
    userPathPrefix: `/user/2/${accountId}/`,
    userPathSuffix: appQ ? `?${appQ}` : '',
    openPageAppId: applicationId || caseId,
    getMyItemsPath(_segment, pageNumber = 1, pageSize = 1000) {
      const pn = Math.max(1, Number(pageNumber) || 1)
      const ps = Math.min(1000, Math.max(1, Number(pageSize) || 1000))
      return `/case/2/${accountId}/${caseId}/view/${viewId}/list/items?page_number=${pn}&page_size=${ps}`
    },
    getAdminItemsPath(pageNumber = 1, pageSize = 1000) {
      return this.getMyItemsPath('all', pageNumber, pageSize)
    },
    getInstancePath(instanceId) {
      return `/case/2/${accountId}/${caseId}/${encodeURIComponent(String(instanceId))}`
    },
    getProgressPath() {
      return null
    },
    getPendingListPath() {
      return null
    },
    getAdminDeletePath(recordId) {
      return `/case/2/${accountId}/${caseId}/${encodeURIComponent(String(recordId))}`
    },
  }
}

export function buildPmEntityApiPaths(kf, entity) {
  if (!entity) return null
  if (entity.kind === 'case') return buildPmCaseApiPaths(kf, entity)
  return buildPmProcessApiPaths(kf, entity)
}

/** Alias kept for shell call sites that previously used admin path helpers. */
export function buildPmAdminApiPaths(kf, entity) {
  const paths = buildPmEntityApiPaths(kf, entity)
  if (!paths) return null
  return {
    ...paths,
    getContractItemsPath: (pageNumber, pageSize) => paths.getAdminItemsPath(pageNumber, pageSize),
  }
}
