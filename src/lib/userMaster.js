/**
 * Refex One User Master — shared people directory for assignee / owner pickers.
 * GET /api/v1/user-master?status=all&page=&page_size=
 */

const USER_MASTER_TOKEN = String(import.meta.env.VITE_USER_MASTER_TOKEN || '').trim();
const USER_MASTER_URL = String(
  import.meta.env.VITE_USER_MASTER_URL || 'https://refexone.com/api/v1/user-master',
).replace(/\/$/, '');

const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = { at: 0, users: null };

export function isUserMasterConfigured() {
  return Boolean(USER_MASTER_TOKEN);
}

function userMasterRequestUrl(page, pageSize) {
  const qs = `status=all&page=${page}&page_size=${pageSize}`;
  if (import.meta.env.DEV) return `/api/v1/user-master?${qs}`;
  return `${USER_MASTER_URL}?${qs}`;
}

function extractUsers(payload) {
  if (!payload) return { users: [], total: 0 };
  if (Array.isArray(payload)) return { users: payload, total: payload.length };
  const users = Array.isArray(payload.users)
    ? payload.users
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.results)
        ? payload.results
        : [];
  const total = Number(payload.total ?? payload.count ?? users.length) || users.length;
  return { users, total };
}

export function mapUserMasterPerson(row) {
  if (!row || typeof row !== 'object') return null;
  const email = String(row.email || row.work_email || row.Email || '').trim();
  const name = String(row.full_name || row.name || row.Name || '').trim() || email;
  const id = String(row.id || row.user_id || '').trim();
  if (!email && !id && !name) return null;
  const firstName = String(row.first_name || name.split(/\s+/)[0] || 'User').trim();
  return {
    ...row,
    _id: id ? `iam:${id}` : '',
    Name: name,
    Email: email,
    email,
    FirstName: firstName,
    LastName: String(row.last_name || '').trim(),
    Role: String(row.designation || row.title || row.role || '').trim(),
    _external: true,
    _user_master: true,
  };
}

export function userMasterOptionLabel(person) {
  const name = String(person?.Name || '').trim();
  const email = String(person?.Email || person?.email || '').trim();
  if (name && email && name.toLowerCase() !== email.toLowerCase()) {
    return `${name} (${email})`;
  }
  return name || email;
}

async function fetchUserMasterPage(page, pageSize) {
  if (!USER_MASTER_TOKEN) {
    throw new Error('User Master token is missing. Set VITE_USER_MASTER_TOKEN in .env.');
  }
  const res = await fetch(userMasterRequestUrl(page, pageSize), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${USER_MASTER_TOKEN}`,
    },
  });
  if (!res.ok) {
    throw new Error(`User Master HTTP ${res.status}`);
  }
  return extractUsers(await res.json());
}

/** All User Master people (cached). Walks pages unless the API returns the full set at once. */
export async function fetchUserMasterUsers({ force = false } = {}) {
  if (!force && cache.users && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.users;
  }
  if (!USER_MASTER_TOKEN) return [];

  const seen = new Set();
  const merged = [];
  let total = Infinity;

  for (let page = 1; page <= MAX_PAGES && merged.length < total; page += 1) {
    const { users, total: reported } = await fetchUserMasterPage(page, PAGE_SIZE);
    total = Number(reported) || total;
    if (!users.length) break;
    users.forEach((row) => {
      const person = mapUserMasterPerson(row);
      if (!person) return;
      const key = String(person.email || person._id || person.Name).trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(person);
    });
    if (users.length < PAGE_SIZE) break;
    if (page === 1 && users.length >= total) break;
  }

  merged.sort((a, b) => String(a.Name || '').localeCompare(String(b.Name || '')));
  cache = { at: Date.now(), users: merged };
  return merged;
}

export function userMasterSearchHaystack(person) {
  return [
    person?.Name,
    person?.Email,
    person?.email,
    person?.Role,
    person?.department,
    person?.Department,
    person?.employee_code,
    person?.employee_id,
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ')
}

export function filterUserMasterUsers(users, query, limit = 8) {
  const list = Array.isArray(users) ? users : []
  const needle = String(query || '').trim().toLowerCase()
  const matched = needle
    ? list.filter((person) => userMasterSearchHaystack(person).includes(needle))
    : list
  return matched.slice(0, Math.max(1, Number(limit) || 8))
}

export async function lookupUserMasterByEmail(email) {
  const needle = String(email || '').trim().toLowerCase();
  if (!needle) return null;
  const users = await fetchUserMasterUsers();
  return users.find((u) => String(u.Email || u.email || '').trim().toLowerCase() === needle) || null;
}

export async function lookupUserMasterByName(name) {
  const needle = String(name || '').trim().toLowerCase();
  if (!needle) return null;
  const users = await fetchUserMasterUsers();
  const exact = users.find((u) => String(u.Name || '').trim().toLowerCase() === needle);
  if (exact) return exact;
  const starts = users.filter((u) => String(u.Name || '').trim().toLowerCase().startsWith(needle));
  return starts.length === 1 ? starts[0] : null;
}

export function toUserMasterPickerOptions(users, currentUser = null) {
  const list = Array.isArray(users) ? users.slice() : [];
  const opts = [];
  const seen = new Set();

  const push = (person) => {
    if (!person) return;
    const email = String(person.Email || person.email || '').trim();
    const value = email || String(person._id || person.Name || '').trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    opts.push({
      value,
      label: userMasterOptionLabel(person),
      user: person,
    });
  };

  push(currentUser);
  list.forEach(push);
  return opts;
}
