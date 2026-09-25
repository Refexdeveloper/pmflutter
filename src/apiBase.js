const DEFAULT_TENANT_BASE_PROD = 'https://refexgroup.kissflow.com'
const DEFAULT_TENANT_BASE_DEV = 'https://development-refexgroup.kissflow.com'

function isAssetCdnHost(hostname) {
  const h = String(hostname || '').toLowerCase()
  return (
    h.includes('kissflow.store') ||
    h.startsWith('resource.') ||
    h.includes('.as.kissflow.store')
  )
}

function tenantBaseFromUrlString(urlStr) {
  const raw = String(urlStr || '').trim()
  if (!raw) return ''
  try {
    const origin = new URL(raw).origin
    if (origin && !isAssetCdnHost(new URL(origin).hostname)) return origin
  } catch {
    // ignore
  }
  return ''
}

/**
 * Kissflow tenant API origin for fetch() — never the resource.*.kissflow.store CDN (S3 → NoSuchKey 404).
 * Use for process-report and other REST calls with access keys.
 */
export function getKissflowTenantBase() {
  const envBase = import.meta.env?.VITE_KF_BASE_URL
  if (envBase && !String(envBase).includes('kissflow.store')) {
    return String(envBase).replace(/\/$/, '')
  }

  if (typeof document !== 'undefined') {
    const fromRef = tenantBaseFromUrlString(document.referrer)
    if (fromRef) return fromRef
  }

  if (typeof window !== 'undefined') {
    const host = window.location?.hostname || ''
    if (!isAssetCdnHost(host)) {
      const origin = window.location?.origin ? String(window.location.origin) : ''
      if (origin) return origin.replace(/\/$/, '')
    }
  }

  return DEFAULT_TENANT_BASE_PROD
}

/** True when browser fetch() to the tenant API would be same-origin (avoids CORS from resource CDN). */
export function canFetchKissflowTenantDirectly() {
  if (typeof window === 'undefined') return true
  try {
    const tenantOrigin = new URL(getKissflowTenantBase()).origin
    return tenantOrigin === window.location.origin
  } catch {
    return false
  }
}

/**
 * Base URL for Kissflow API requests.
 * - kf.api() uses relative paths on the tenant origin via the SDK.
 * - For fetch() fallback, prefer getKissflowTenantBase() for process-report.
 */
export function getApiBase() {
  if (typeof window !== 'undefined') {
    const host = window.location?.hostname ? String(window.location.hostname) : ''
    if (isAssetCdnHost(host)) {
      return getKissflowTenantBase()
    }
    const origin = window.location?.origin ? String(window.location.origin) : ''
    if (origin) return origin.replace(/\/$/, '')
  }

  return import.meta.env?.VITE_KF_BASE_URL || DEFAULT_TENANT_BASE_DEV
}

/** Use at module load for constants; in browser this will be the page origin. */
export const API_BASE = getApiBase()
