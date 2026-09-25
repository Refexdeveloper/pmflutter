/** In-memory + in-flight cache for dashboard list loaders. */

const DEFAULT_TTL_MS = 90_000
const store = new Map()
const inflight = new Map()

export function cacheKey(...parts) {
  return parts
    .map((part) => String(part ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join('|')
}

export async function getCachedOrLoad(key, loader, ttlMs = DEFAULT_TTL_MS) {
  const id = String(key || '').trim()
  if (!id) return loader()

  const hit = store.get(id)
  if (hit && hit.expires > Date.now()) return hit.value

  const pending = inflight.get(id)
  if (pending) return pending

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      store.set(id, { expires: Date.now() + Math.max(1000, Number(ttlMs) || DEFAULT_TTL_MS), value })
      inflight.delete(id)
      return value
    })
    .catch((error) => {
      inflight.delete(id)
      throw error
    })

  inflight.set(id, promise)
  return promise
}

export function peekListCache(key) {
  const hit = store.get(String(key || '').trim())
  if (!hit || hit.expires <= Date.now()) return undefined
  return hit.value
}

export function invalidateListCache(prefix = '') {
  const needle = String(prefix || '').trim().toLowerCase()
  if (!needle) {
    store.clear()
    inflight.clear()
    return
  }
  for (const key of [...store.keys()]) {
    if (key.includes(needle)) store.delete(key)
  }
  for (const key of [...inflight.keys()]) {
    if (key.includes(needle)) inflight.delete(key)
  }
}
