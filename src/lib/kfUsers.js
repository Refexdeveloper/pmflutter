import { kfGetJson, resolveKissflowAccountId, resolveKissflowOrigin } from './kfRuntime.js';

const DEFAULT_ACCOUNT_ID = 'AcCMptp3yqcn';

function getAccountId(kfInstance) {
  return resolveKissflowAccountId(kfInstance, DEFAULT_ACCOUNT_ID);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function fetchActiveUsers(kfInstance) {
  const accountId = getAccountId(kfInstance);
  const path = `/user/2/${accountId}/?page_number=1&page_size=100000&user_type=User&active_user=true`;
  const payload = await kfGetJson(kfInstance, path);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function fetchWithAccessKeys(path, accessKeyId, accessKeySecret) {
  const origin = resolveKissflowOrigin();
  const url = `${origin}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Access-Key-Id': String(accessKeyId || ''),
      'X-Access-Key-Secret': String(accessKeySecret || ''),
    },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchUserProfile(kfInstance, userId, opts) {
  const accountId = getAccountId(kfInstance);
  const path = `/user/2/${accountId}/${encodeURIComponent(String(userId))}`;
  if (opts?.accessKeyId && opts?.accessKeySecret) {
    return fetchWithAccessKeys(path, opts.accessKeyId, opts.accessKeySecret);
  }
  return kfGetJson(kfInstance, path);
}

async function mapWithLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      try {
        results[idx] = await mapper(items[idx], idx);
      } catch (e) {
        results[idx] = { __error: e };
      }
    }
  }

  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

function reportsToManager(profile, manager) {
  const l1Email = normalizeEmail(profile?.L1_Manager_Email);
  const managerId = String(manager?.id || '').trim();

  const l2Id = String(profile?.L2_Manager?._id || '').trim();
  const managerRefId = String(profile?.Manager?._id || '').trim();

  if (manager?.email && l1Email && l1Email === normalizeEmail(manager.email)) return true;
  if (managerId && (l2Id === managerId || managerRefId === managerId)) return true;

  // Some accounts may expose manager emails in different keys.
  const l2Email = normalizeEmail(profile?.L2_Manager_Email || profile?.L2_Manager?.Email);
  const managerEmail = normalizeEmail(manager?.email);
  if (managerEmail && l2Email && l2Email === managerEmail) return true;

  return false;
}

/**
 * Returns users who report to the given manager (current user).
 * Uses the active user list, then checks each user profile for L1/L2/Manager fields.
 */
export async function fetchMyDirectReports(kfInstance, manager = {}, opts = {}) {
  const all = await fetchActiveUsers(kfInstance);
  const users = all
    .map((u) => ({
      id: String(u?._id || '').trim(),
      name: String(u?.Name || `${u?.FirstName || ''} ${u?.LastName || ''}` || '').trim(),
      email: String(u?.Email || '').trim(),
    }))
    .filter((u) => u.id && u.name);

  const managerEmail = normalizeEmail(manager?.email);
  const managerId = String(manager?.id || '').trim();
  if (!managerEmail && !managerId) return [];

  if (opts?.debug) {
    // Keep logs small; only expose safe values.
    console.info('fetchMyDirectReports: inputs', {
      origin: resolveKissflowOrigin(),
      accountId: getAccountId(kfInstance),
      totalUsers: users.length,
      managerEmail: managerEmail || undefined,
      managerId: managerId || undefined,
      usingAccessKeys: Boolean(opts?.accessKeyId && opts?.accessKeySecret),
    });
  }

  const profs = await mapWithLimit(users, 10, async (u) => {
    const profile = await fetchUserProfile(kfInstance, u.id, opts);
    return { u, profile };
  });

  const matches = [];
  let sampled = 0;
  for (const entry of profs) {
    if (!entry || entry.__error) continue;
    const { u, profile } = entry;
    if (opts?.debug && sampled < 5) {
      sampled += 1;
      console.info('fetchMyDirectReports: sample profile', {
        user: { id: u.id, name: u.name, email: normalizeEmail(u.email) || undefined },
        l1: normalizeEmail(profile?.L1_Manager_Email) || undefined,
        l2Id: String(profile?.L2_Manager?._id || '').trim() || undefined,
        mgrId: String(profile?.Manager?._id || '').trim() || undefined,
        hasKeys: {
          L1_Manager_Email: 'L1_Manager_Email' in (profile || {}),
          L2_Manager: 'L2_Manager' in (profile || {}),
          Manager: 'Manager' in (profile || {}),
        },
      });
    }
    if (reportsToManager(profile, { email: managerEmail, id: managerId })) {
      matches.push(u);
    }
  }

  if (opts?.debug) {
    console.info('fetchMyDirectReports: result', { matches: matches.length });
  }

  matches.sort((a, b) => a.name.localeCompare(b.name));
  return matches;
}

