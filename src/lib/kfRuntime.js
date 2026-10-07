import {
  KF_API_ORIGIN,
  KF_DEV_ACCOUNT_ID,
  KF_LIVE_ACCOUNT_ID,
  buildKissflowAccessKeyHeaders,
  getTenantAccessKeys,
} from './kfAccessKeys.js';

const DEV_KISSFLOW_ORIGIN = 'https://development-refexgroup.kissflow.com';
const LIVE_KISSFLOW_ORIGIN = 'https://refexgroup.kissflow.com';

/** Per-request page_size for Kissflow list endpoints. Walk pages until a short page. */
export const KF_ADMIN_PAGE_SIZE = 500;
export const KF_ADMIN_MAX_PAGES = 200;

let readsPausedUntil = 0;

export function pauseKissflowReads(ms = 20000) {
  const until = Date.now() + Math.max(1000, Number(ms) || 20000);
  if (until > readsPausedUntil) readsPausedUntil = until;
}

export function resumeKissflowReads() {
  readsPausedUntil = 0;
}

export function isKissflowReadPaused() {
  return Date.now() < readsPausedUntil;
}

export function isKissflowRateLimited(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const message = String(error?.message || error || '').toLowerCase();
  return status === 429 || message.includes('429') || message.includes('too many request') || message.includes('rate limit');
}

const MAX_CONCURRENT_KF_READS = 2;
let activeKfReads = 0;
const kfReadWaiters = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireKfReadSlot() {
  if (activeKfReads < MAX_CONCURRENT_KF_READS) {
    activeKfReads += 1;
    return;
  }
  await new Promise((resolve) => kfReadWaiters.push(resolve));
  activeKfReads += 1;
}

function releaseKfReadSlot() {
  activeKfReads = Math.max(0, activeKfReads - 1);
  const next = kfReadWaiters.shift();
  if (next) next();
}

export function decorateKissflowHttpError(res, data) {
  const message = parseKfApiError(data, res.status) || `HTTP ${res.status}`;
  const err = new Error(message);
  err.status = res.status;
  if (res.status === 429) {
    const retryAfter = Number(res.headers?.get?.('Retry-After'));
    err.retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 4000;
  }
  return err;
}

/** Cap concurrent Kissflow GETs and retry HTTP 429 with backoff. */
export async function kissflowReadWithRetry(fn, { retries = 4 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await acquireKfReadSlot();
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable = isKissflowRateLimited(error) && attempt < retries;
      if (!retryable) throw error;
    } finally {
      releaseKfReadSlot();
    }
    const wait = Math.min(20000, Number(lastError?.retryAfterMs) || 2000 * (attempt + 1));
    await sleep(wait);
  }
  throw lastError;
}

const SESSION_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

const GET_CACHE_TTL_MS = 45_000;
const getInflight = new Map();
const getCache = new Map();

function normalizeGetCachePath(path) {
  return rewriteKissflowPathToLiveAccount(String(path || '').trim());
}

function shouldCacheGetPath(path) {
  return /\/(process|case|user|process-report|case-report)\//.test(path);
}

export function invalidateKissflowGetCache(prefix = '') {
  const needle = String(prefix || '').trim();
  if (!needle) {
    getCache.clear();
    return;
  }
  for (const key of [...getCache.keys()]) {
    if (key.includes(needle)) getCache.delete(key);
  }
}

/** Standalone host (Vite or Cloud Run), not a page embedded on Kissflow. */
function isLocalVitePreview() {
  if (typeof window === 'undefined') return false;
  const host = String(window.location.hostname || '').toLowerCase();
  if (!host || host.includes('kissflow.com') || host.includes('kissflow.store')) return false;
  return true;
}

export { isLocalVitePreview };

/** Development keys 401 on localhost. GET lists through `/kf-live` + live account. */
export function shouldUseLocalLiveReads() {
  return isLocalVitePreview();
}

export function rewriteKissflowPathToLiveAccount(path) {
  return String(path || '').replaceAll(KF_DEV_ACCOUNT_ID, KF_LIVE_ACCOUNT_ID);
}

export function localLiveReadUrl(path) {
  const rewritten = rewriteKissflowPathToLiveAccount(path);
  const withSlash = rewritten.startsWith('/') ? rewritten : `/${rewritten}`;
  if (withSlash.startsWith('/kf-live/')) return withSlash;
  return `/kf-live${withSlash}`;
}

export function localLiveReadHeaders() {
  return { Accept: 'application/json' };
}

async function fetchLocalLiveJson(path) {
  const res = await fetch(localLiveReadUrl(path), {
    method: 'GET',
    credentials: 'omit',
    headers: localLiveReadHeaders(),
    signal: AbortSignal.timeout(25000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw decorateKissflowHttpError(res, data);
  const err = parseKfApiError(data, res.status);
  if (err) {
    const error = new Error(err);
    error.status = res.status;
    throw error;
  }
  return data;
}

/** Development tenant GET — keeps AcCMptp3yqcn. Locally uses `/kf-dev` (not `/kf-live`). */
export async function fetchKissflowDevJson(path, options = {}) {
  const raw = String(path || '').trim();
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const retries = Number.isFinite(Number(options.retries)) ? Number(options.retries) : 1;
  return kissflowReadWithRetry(async () => {
    const url = isLocalVitePreview() ? `/kf-dev${withSlash}` : `${DEV_KISSFLOW_ORIGIN}${withSlash}`;
    const headers = { Accept: 'application/json' };
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      headers,
      signal: AbortSignal.timeout(25000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw decorateKissflowHttpError(res, data);
    const err = parseKfApiError(data, res.status);
    if (err) {
      const error = new Error(err);
      error.status = res.status;
      throw error;
    }
    return data;
  }, { retries });
}

function isAuthError(errorOrMessage) {
  const message = String(errorOrMessage?.message || errorOrMessage || '').toLowerCase();
  return (
    message.includes('authorized') ||
    message.includes('authorisation') ||
    message.includes('forbidden') ||
    message.includes('401') ||
    message.includes('403')
  );
}

export { isAuthError };

/** Origin for direct fetch/API calls. Uses tenant when SDK is available. */
export function resolveKissflowApiOrigin(kfInstance) {
  // Local Vite: same-origin paths so the dev proxy can reach Kissflow (avoids CORS).
  if (isLocalVitePreview()) return '';

  if (kfInstance) {
    const tenant = getTenantAccessKeys(kfInstance);
    if (tenant.apiOrigin) return tenant.apiOrigin;
  }
  return KF_API_ORIGIN || DEV_KISSFLOW_ORIGIN;
}

export function resolveKissflowOrigin(kfInstance) {
  if (kfInstance) {
    const tenant = getTenantAccessKeys(kfInstance);
    if (tenant.apiOrigin) return tenant.apiOrigin;
  }

  const origin = typeof window !== 'undefined' && window?.location?.origin ? String(window.location.origin) : '';
  if (origin && origin.includes('kissflow.com')) return origin;

  const isDev =
    (typeof import.meta !== 'undefined' && import.meta?.env?.DEV) ||
    (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development');

  return isDev ? DEV_KISSFLOW_ORIGIN : LIVE_KISSFLOW_ORIGIN;
}

export function resolveKissflowAccountId(kfInstance, fallbackAccountId = '') {
  const sdkAccountId = String(kfInstance?.account?._id || '').trim();
  if (sdkAccountId) return sdkAccountId;

  const tenantFallback = getTenantAccessKeys(kfInstance).defaultAccountId || fallbackAccountId;

  const candidates = [];
  const safePush = (v) => {
    if (v) candidates.push(String(v));
  };

  safePush(typeof window !== 'undefined' ? window?.location?.href : '');
  safePush(typeof window !== 'undefined' ? window?.location?.pathname : '');
  safePush(typeof document !== 'undefined' ? document?.referrer : '');

  try {
    safePush(typeof window !== 'undefined' ? window?.top?.location?.href : '');
    safePush(typeof window !== 'undefined' ? window?.top?.location?.pathname : '');
    safePush(typeof window !== 'undefined' ? window?.parent?.location?.href : '');
    safePush(typeof window !== 'undefined' ? window?.parent?.location?.pathname : '');
  } catch {
    // Cross-origin/sandboxed frames: ignore.
  }

  const re = /\/(?:flow|case|metadata|process)\/2\/([^/]+)/i;
  for (const raw of candidates) {
    const match = raw.match(re);
    if (match?.[1]) return match[1];
  }

  return tenantFallback || fallbackAccountId;
}

export async function kfGetJson(kfInstance, path, optionsOrUrl) {
  const opts = typeof optionsOrUrl === 'object' && optionsOrUrl ? optionsOrUrl : {};
  const allowWhenPaused = Boolean(opts.allowWhenPaused);
  if (!allowWhenPaused && isKissflowReadPaused()) {
    const err = new Error('Kissflow reads paused');
    err.code = 'KF_READ_PAUSED';
    throw err;
  }

  const cachePath = normalizeGetCachePath(path);
  const useCache = opts.cache !== false && shouldCacheGetPath(cachePath);
  if (useCache) {
    const hit = getCache.get(cachePath);
    if (hit && hit.expires > Date.now()) return hit.value;
    const pending = getInflight.get(cachePath);
    if (pending) return pending;
  }

  const retries = Number.isFinite(Number(opts.retries)) ? Number(opts.retries) : 4;
  const request = kissflowReadWithRetry(async () => {
    if (shouldUseLocalLiveReads()) {
      return fetchLocalLiveJson(path);
    }

    if (kfInstance?.api) {
      try {
        const resp = await kfInstance.api(path, { method: 'GET', headers: { Accept: 'application/json' } });
        const data = resp?.data ?? resp ?? null;
        const apiError = parseKfApiError(data, Number(data?.http_status_code || data?.statusCode || 0));
        if (apiError) {
          const err = new Error(apiError);
          if (isKissflowRateLimited(err) || /429/.test(apiError)) err.status = 429;
          throw err;
        }
        return data;
      } catch (error) {
        if (!error?.status && /429/.test(String(error?.message || ''))) {
          error.status = 429;
        }
        throw error;
      }
    }

    const tenantKeys = getTenantAccessKeys(kfInstance);
    const keyId = String(tenantKeys.accessKeyId || '').trim();
    const keySecret = String(tenantKeys.accessKeySecret || '').trim();
    if (!isLocalVitePreview() && (!keyId || !keySecret)) {
      throw new Error('Kissflow SDK not ready — open this page inside Kissflow.');
    }

    const origin = resolveKissflowApiOrigin(kfInstance);
    const headers = buildKissflowAccessKeyHeaders(keyId, keySecret, kfInstance);
    const res = await fetch(`${origin}${path}`, {
      method: 'GET',
      credentials: 'omit',
      headers,
      signal: AbortSignal.timeout(25000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw decorateKissflowHttpError(res, data);
    const err = parseKfApiError(data, res.status);
    if (err) throw new Error(err);
    return data;
  }, { retries });

  if (!useCache) return request;

  const tracked = request
    .then((value) => {
      getCache.set(cachePath, { expires: Date.now() + GET_CACHE_TTL_MS, value });
      getInflight.delete(cachePath);
      return value;
    })
    .catch((error) => {
      getInflight.delete(cachePath);
      throw error;
    });
  getInflight.set(cachePath, tracked);
  return tracked;
}

export function extractKissflowListRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.Data)) return payload.Data;
  if (Array.isArray(payload.data?.Data)) return payload.data.Data;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

function kissflowRowIdentity(row, fallback) {
  return String(row?._id || row?._item_id || row?.Id || row?.id || fallback).trim();
}

/**
 * Walk Kissflow list pages until a short page (or maxPages).
 * `buildPath(pageNumber, pageSize)` must return the API path for that page.
 */
export async function fetchAllPagedRows(kfInstance, buildPath, options = {}) {
  const pageSize = Math.max(1, Number(options.pageSize) || KF_ADMIN_PAGE_SIZE);
  const maxPages = Math.max(1, Number(options.maxPages) || KF_ADMIN_MAX_PAGES);
  const extract = typeof options.extract === 'function' ? options.extract : extractKissflowListRows;
  const merged = [];
  const seen = new Set();

  for (let page = 1; page <= maxPages; page += 1) {
    const path = buildPath(page, pageSize);
    let payload
    try {
      payload = await kfGetJson(kfInstance, path, {
        allowWhenPaused: Boolean(options.allowWhenPaused),
      })
    } catch (error) {
      if (isAuthError(error) || isKissflowRateLimited(error)) {
        if (page === 1 && !merged.length) throw error
        break
      }
      throw error
    }
    const batch = extract(payload);
    if (!batch.length) break;
    const before = merged.length;
    batch.forEach((row, idx) => {
      const key = kissflowRowIdentity(row, `${page}-${idx}`);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(row);
    });
    const added = merged.length - before;
    if (added > 0 && typeof options.onBatch === 'function') {
      options.onBatch(merged);
    }
    // Same payload on every page (Kissflow ignoring page_number) — stop instead of looping 200 times.
    if (added === 0) break;
    if (batch.length < pageSize) break;
  }

  return merged;
}

/** Admin process item list — paginates so callers are not capped at one page. */
export async function fetchAllAdminProcessItems(kfInstance, processId, options = {}) {
  const accountId = resolveKissflowAccountId(kfInstance, options.accountId || '');
  const pref = options.applyPreference;
  const prefQuery =
    pref === undefined ? '' : `&apply_preference=${pref ? '1' : '0'}`;

  return fetchAllPagedRows(
    kfInstance,
    (page, pageSize) =>
      `/process/2/${accountId}/admin/${processId}/item?page_number=${page}&page_size=${pageSize}${prefQuery}`,
    options,
  );
}

/** Run async work over items with a concurrency cap (avoids flooding Kissflow with N parallel calls). */
export async function runWithConcurrency(items, concurrency, worker) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return [];

  const limit = Math.max(1, Math.min(concurrency, list.length));
  const results = new Array(list.length);
  let nextIndex = 0;

  async function runWorker() {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= list.length) break;
      results[index] = await worker(list[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, runWorker));
  return results;
}

function parseKfApiError(data, status) {
  if (data?.status === 'error' || data?.error_code) {
    return data.en_message || data.message || 'Kissflow request failed';
  }
  if (status && status >= 400) {
    return data?.en_message || data?.message || `HTTP ${status}`;
  }
  return '';
}

export async function kfMutateJson(
  kfInstance,
  path,
  {
    method = 'POST',
    body,
    accessKeyId,
    accessKeySecret,
    useAccessKeys,
    allowSdkFallback = true,
    preferSessionAuth = false,
  } = {},
) {
  const tenantKeys = getTenantAccessKeys(kfInstance);
  const keyId = String(accessKeyId || tenantKeys.accessKeyId || '').trim();
  const keySecret = String(accessKeySecret || tenantKeys.accessKeySecret || '').trim();
  const hasAccessKeys = Boolean((keyId && keySecret) || isLocalVitePreview());
  const fetchBody = body !== undefined ? JSON.stringify(body) : undefined;
  const origin = resolveKissflowApiOrigin(kfInstance);

  async function mutateWithKfApi(headers) {
    if (!kfInstance?.api) {
      throw new Error('Kissflow SDK not available — open this page inside Kissflow.');
    }
    const resp = await kfInstance.api(path, {
      method,
      headers,
      body: fetchBody,
    });
    const data = resp?.data ?? resp ?? null;
    const err = parseKfApiError(data);
    if (err) throw new Error(err);
    return data;
  }

  async function mutateWithAccessKeysFetch() {
    const headers = buildKissflowAccessKeyHeaders(keyId, keySecret, kfInstance);
    const withSlash = String(path || '').startsWith('/') ? path : `/${path}`;
    const url = isLocalVitePreview()
      ? (withSlash.startsWith('/kf-dev') || withSlash.startsWith('/kf-live')
          ? withSlash
          : `${tenantKeys.tenant === 'live' ? '/kf-live' : '/kf-dev'}${withSlash}`)
      : `${origin}${withSlash}`;
    const res = await fetch(url, {
      method,
      credentials: 'omit',
      headers,
      body: fetchBody,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = parseKfApiError(data, res.status);
      throw new Error(err || `HTTP ${res.status}`);
    }
    const err = parseKfApiError(data, res.status);
    if (err) throw new Error(err);
    return data;
  }

  async function mutateWithTenantAccessKeys() {
    if (!hasAccessKeys) {
      throw new Error(
        `Missing Kissflow access keys for ${tenantKeys.tenant} tenant. Set them on the server, then restart.`,
      );
    }

    const accessHeaders = buildKissflowAccessKeyHeaders(keyId, keySecret, kfInstance);

    if (kfInstance?.api) {
      try {
        return await mutateWithKfApi(accessHeaders);
      } catch (error) {
        if (!allowSdkFallback) throw error;
        const message = String(error?.message || error);
        if (!message.toLowerCase().includes('failed to fetch')) throw error;
      }
    }

    try {
      return await mutateWithAccessKeysFetch();
    } catch (error) {
      if (kfInstance?.api && allowSdkFallback) {
        return mutateWithKfApi(accessHeaders);
      }
      throw error;
    }
  }

  // Embedded component: logged-in session first (IT dashboard pattern).
  if (preferSessionAuth && kfInstance?.api) {
    try {
      return await mutateWithKfApi(SESSION_HEADERS);
    } catch (sessionError) {
      if (!isAuthError(sessionError) || !hasAccessKeys) throw sessionError;
      return mutateWithTenantAccessKeys();
    }
  }

  if (useAccessKeys === false) {
    if (kfInstance?.api) {
      return mutateWithKfApi(SESSION_HEADERS);
    }
    throw new Error('Kissflow SDK not available — open this page inside Kissflow.');
  }

  if (useAccessKeys === true || (useAccessKeys == null && hasAccessKeys)) {
    return mutateWithTenantAccessKeys();
  }

  if (kfInstance?.api) {
    return mutateWithKfApi(SESSION_HEADERS);
  }

  throw new Error('Kissflow SDK not available — open this page inside Kissflow.');
}
