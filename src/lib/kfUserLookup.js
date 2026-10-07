import {
  KF_LIVE_ACCESS_KEY_ID,
  KF_LIVE_ACCESS_KEY_SECRET,
  KF_LIVE_ACCOUNT_ID,
  KF_LIVE_API_ORIGIN,
  buildKissflowAccessKeyHeaders,
  getTenantAccessKeys,
} from './kfAccessKeys.js';
import {
  kfGetJson,
  resolveKissflowAccountId,
  isLocalVitePreview,
} from './kfRuntime.js';

const lookupMemo = new Map();

function lookupKey(kind, value) {
  return `${kind}:v5:${String(value || '').trim().toLowerCase()}`;
}

/** Same-origin `/kf-live` in Vite; live host when embedded in Kissflow. */
function liveKissflowOrigin() {
  if (isLocalVitePreview()) return '/kf-live';
  return String(KF_LIVE_API_ORIGIN || '').replace(/\/$/, '');
}

function directoryUnverifiedError(message) {
  const err = new Error(message || 'Kissflow user directory could not be verified');
  err.code = 'KF_USER_UNVERIFIED';
  return err;
}

function readMemo(key) {
  if (!lookupMemo.has(key)) return undefined;
  return lookupMemo.get(key);
}

function writeMemo(key, value) {
  lookupMemo.set(key, value);
  return value;
}

function asUserList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Users)) return payload.Users;
  return [];
}

function normalizeKfUser(row) {
  if (!row || typeof row !== 'object') return null;
  const email = String(row.Email || row.email || '').trim();
  const name = String(row.Name || `${row.FirstName || ''} ${row.LastName || ''}` || '').trim();
  const id = String(row._id || row.Id || row.id || '').trim();
  if (!id && !email) return null;
  return {
    ...row,
    _id: id || row._id,
    Name: name || email,
    FirstName: row.FirstName || (name && name.split(' ')[0]) || 'User',
    Email: email,
    email,
    _external: false,
  };
}

function emailOf(row) {
  return String(row?.Email || row?.email || '').trim().toLowerCase();
}

function isDirectoryUserId(value) {
  const id = String(value || '').trim()
  return /^Us[A-Za-z0-9_]+$/.test(id)
}

/** Valid Kissflow User for Assigned_To: Us… id, Kind User, Active. */
export function isValidKissflowAssignee(row) {
  const user = normalizeKfUser(row)
  if (!user || !isDirectoryUserId(user._id) || !user.Email) return null
  const kind = String(user.Kind || user._flow_type || 'User').trim()
  if (kind && kind.toLowerCase() !== 'user') return null
  const status = String(user.Status || 'Active').trim().toLowerCase()
  if (status && status !== 'active') return null
  return user
}

/** Live tenant user search — development /user/2 often 401s with these keys. */
export async function lookupKissflowUserByEmailOnLive(email) {
  const needle = String(email || '').trim().toLowerCase();
  if (!needle) return null;
  const origin = liveKissflowOrigin();
  const accountId = String(KF_LIVE_ACCOUNT_ID || '').trim();
  const keyId = String(KF_LIVE_ACCESS_KEY_ID || '').trim();
  const keySecret = String(KF_LIVE_ACCESS_KEY_SECRET || '').trim();
  if (!origin || !accountId || (!isLocalVitePreview() && (!keyId || !keySecret))) {
    throw directoryUnverifiedError('Live Kissflow user directory is not configured');
  }
  const res = await fetch(
    `${origin}/user/2/${accountId}/?page_number=1&page_size=50&user_type=User&active_user=true&q=${encodeURIComponent(needle)}`,
    {
      method: 'GET',
      credentials: 'omit',
      headers: buildKissflowAccessKeyHeaders(keyId, keySecret),
      signal: AbortSignal.timeout(25000),
    },
  );
  const data = await res.json().catch(() => []);
  if (!res.ok) {
    const err = new Error(data?.en_message || data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const hit = asUserList(data).find((u) => emailOf(u) === needle);
  return isValidKissflowAssignee(hit);
}

function lookupOpts(options = {}) {
  return {
    allowWhenPaused: Boolean(options.allowWhenPaused),
    retries: Number.isFinite(Number(options.retries)) ? Number(options.retries) : 0,
  };
}

const ALL_USERS_TTL_MS = 5 * 60 * 1000
let allUsersCache = { key: '', at: 0, users: null }

function allUsersPath(accountId) {
  return `/user/2/${encodeURIComponent(accountId)}/?page_number=1&page_size=100000&user_type=User&active_user=true`
}

function usersFromPayload(payload) {
  return asUserList(payload)
    .map(normalizeKfUser)
    .filter((user) => user && isDirectoryUserId(user._id))
}

async function fetchAllUsersFromLive() {
  const origin = liveKissflowOrigin()
  const accountId = String(KF_LIVE_ACCOUNT_ID || '').trim()
  const keyId = String(KF_LIVE_ACCESS_KEY_ID || '').trim()
  const keySecret = String(KF_LIVE_ACCESS_KEY_SECRET || '').trim()
  if (!origin || !accountId || (!isLocalVitePreview() && (!keyId || !keySecret))) return []
  const res = await fetch(`${origin}${allUsersPath(accountId)}`, {
    method: 'GET',
    credentials: 'omit',
    headers: buildKissflowAccessKeyHeaders(keyId, keySecret),
    signal: AbortSignal.timeout(25000),
  })
  const data = await res.json().catch(() => [])
  if (!res.ok) return []
  return usersFromPayload(data)
}

/** GET /user/2/{account}/ all active users. Cached briefly to avoid 429. */
export async function fetchKissflowAllUsers(kfInstance, options = {}) {
  const accountId = resolveKissflowAccountId(kfInstance)
  const cacheKey = String(accountId || 'live')
  if (
    allUsersCache.users
    && allUsersCache.key === cacheKey
    && Date.now() - allUsersCache.at < ALL_USERS_TTL_MS
  ) {
    return allUsersCache.users
  }

  let users = []
  if (accountId) {
    try {
      const payload = await kfGetJson(kfInstance, allUsersPath(accountId), lookupOpts(options))
      users = usersFromPayload(payload)
    } catch (err) {
      console.warn('Kissflow all-users API failed:', err?.message || err)
    }
  }

  if (!users.length) {
    try {
      users = await fetchAllUsersFromLive()
    } catch (err) {
      console.warn('Kissflow live all-users API failed:', err?.message || err)
    }
  }

  allUsersCache = { key: cacheKey, at: Date.now(), users }
  return users
}

/** Match a picker person against the Kissflow directory. */
export function matchKissflowDirectoryUser(users, person) {
  const list = Array.isArray(users) ? users : []
  if (!list.length || !person) return null
  const asObject = typeof person === 'object' ? person : null
  const email = String(
    (typeof person === 'string' && person.includes('@') ? person : '')
      || asObject?.Email
      || asObject?.email
      || '',
  )
    .trim()
    .toLowerCase()
  const id = String(asObject?._id || asObject?.Id || asObject?.id || asObject?.kissflowUserId || '')
    .trim()

  let hit = null
  if (isDirectoryUserId(id)) {
    hit = list.find((row) => String(row._id || '').trim() === id) || null
  }
  if (!hit && email) {
    hit = list.find((row) => emailOf(row) === email) || null
  }
  return hit ? normalizeKfUser(hit) : null
}

/**
 * Look up a Kissflow directory user by email.
 * Returns the user, null when a successful search found no match, or throws
 * KF_USER_UNVERIFIED when the directory could not be checked (401/429/CORS).
 * Never caches errors as "not in Kissflow".
 */
export async function lookupKissflowUserByEmail(kfInstance, email, options = {}) {
  const needle = String(email || '').trim().toLowerCase();
  if (!needle) return null;

  const memoKey = lookupKey('email', needle);
  const cached = readMemo(memoKey);
  if (cached !== undefined) return cached;

  const tenant = kfInstance ? getTenantAccessKeys(kfInstance).tenant : 'dev';
  const matchIn = (rows) => {
    const list = asUserList(rows);
    return isValidKissflowAssignee(list.find((u) => emailOf(u) === needle) || null);
  };

  let liveChecked = false;
  let liveError = null;

  const tryLive = async () => {
    liveChecked = true;
    return lookupKissflowUserByEmailOnLive(needle);
  };

  // Development /user/2 401s with current keys. Search the live directory first.
  if (tenant === 'dev') {
    try {
      const live = await tryLive();
      if (live) return writeMemo(memoKey, live);
    } catch (err) {
      liveError = err;
      console.warn('Kissflow live user search failed:', err?.message || err);
    }
  }

  const accountId = kfInstance ? resolveKissflowAccountId(kfInstance) : '';
  if (accountId && kfInstance) {
    try {
      const searched = await kfGetJson(
        kfInstance,
        `/user/2/${accountId}/?page_number=1&page_size=50&user_type=User&active_user=true&q=${encodeURIComponent(needle)}`,
        lookupOpts(options),
      );
      const hit = matchIn(searched);
      if (hit) return writeMemo(memoKey, hit);
    } catch (err) {
      console.warn('Kissflow user search failed:', err?.message || err);
    }
  }

  if (!liveChecked) {
    try {
      const live = await tryLive();
      if (live) return writeMemo(memoKey, live);
      return writeMemo(memoKey, null);
    } catch (err) {
      liveError = err;
      console.warn('Kissflow live user search failed:', err?.message || err);
    }
  } else if (!liveError) {
    return writeMemo(memoKey, null);
  }

  throw directoryUnverifiedError(liveError?.message);
}

export async function lookupKissflowUserByName(kfInstance, name, options = {}) {
  const needle = String(name || '').trim().toLowerCase();
  if (!needle || !kfInstance) return null;

  const memoKey = lookupKey('name', needle);
  const cached = readMemo(memoKey);
  if (cached !== undefined) return cached;

  const accountId = resolveKissflowAccountId(kfInstance);
  if (!accountId) return null;

  const matchIn = (rows) => {
    const list = asUserList(rows);
    const exact = list.find((u) => String(u.Name || '').trim().toLowerCase() === needle);
    if (exact) return exact;
    const starts = list.filter((u) => String(u.Name || '').trim().toLowerCase().startsWith(needle));
    return starts.length === 1 ? starts[0] : null;
  };

  try {
    const searched = await kfGetJson(
      kfInstance,
      `/user/2/${accountId}/?page_number=1&page_size=50&user_type=User&active_user=true&q=${encodeURIComponent(needle)}`,
      lookupOpts(options),
    );
    const hit = matchIn(searched);
    if (hit) return writeMemo(memoKey, normalizeKfUser(hit));
    return writeMemo(memoKey, null);
  } catch (err) {
    console.warn('Kissflow user name search failed:', err?.message || err);
    throw directoryUnverifiedError(err?.message);
  }
}

export async function lookupKissflowUserById(kfInstance, userId, options = {}) {
  const id = String(userId || '').trim();
  if (!id || id.startsWith('iam:') || id.includes('-') || !kfInstance) return null;
  const memoKey = lookupKey('id', id);
  const cached = readMemo(memoKey);
  if (cached !== undefined) return cached;
  const accountId = resolveKissflowAccountId(kfInstance);
  if (!accountId) return null;
  try {
    const profile = await kfGetJson(
      kfInstance,
      `/user/2/${accountId}/${encodeURIComponent(id)}`,
      lookupOpts(options),
    );
    return writeMemo(memoKey, normalizeKfUser(profile));
  } catch (err) {
    console.warn('Kissflow user id lookup failed:', err?.message || err);
    throw directoryUnverifiedError(err?.message);
  }
}
