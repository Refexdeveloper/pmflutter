/**
 * Resolve the current person without a Kissflow SDK session — same idea as
 * Refex One ITSM for users who are not in Kissflow.
 *
 * Order:
 *  1. URL (superapp / embed): email, user_email, user_name, user_title
 *  2. sessionStorage (this app's identity gate)
 *  3. localStorage iam_user / iam_token (same-origin Refex One)
 *  4. optional GET {VITE_IAM_API_URL}/auth/me
 */

export const PM_IDENTITY_STORAGE_KEY = 'pm_external_identity';

function firstNameFrom(name, email) {
  const fromName = String(name || '').trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = String(email || '').split('@')[0] || '';
  return local || 'User';
}

function readJson(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function readQueryIdentity() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const email = String(params.get('email') || params.get('user_email') || '').trim();
    const name = String(params.get('user_name') || params.get('name') || '').trim();
    const title = String(params.get('user_title') || params.get('title') || '').trim();
    if (!email && !name) return null;
    return {
      email,
      name,
      title,
      source: 'url',
    };
  } catch {
    return null;
  }
}

function fromIamProfile(profile, source) {
  if (!profile) return null;
  const email = String(profile.email || profile.Email || profile.user_email || '').trim();
  const name = String(
    profile.name || profile.full_name || profile.Name || profile.display_name || '',
  ).trim();
  const title = String(
    profile.job_title || profile.title || profile.designation || profile.Role || '',
  ).trim();
  const kissflowUserId = String(profile.kissflow_user_id || profile.kissflowUserId || '').trim();
  if (!email && !name) return null;
  return {
    email,
    name,
    title,
    kissflowUserId,
    source,
    raw: profile,
  };
}

function normalizeIdentity(raw) {
  if (!raw) return null;
  const email = String(raw.email || '').trim().toLowerCase();
  const name = String(raw.name || '').trim();
  const title = String(raw.title || '').trim();
  const pmRole = String(raw.pmRole || raw.pm_role || '').trim();
  const kissflowUserId = String(raw.kissflowUserId || raw.kissflow_user_id || '').trim();
  if (!email) return null;
  return {
    email,
    name: name || email,
    firstName: firstNameFrom(name, email),
    title,
    pmRole,
    kissflowUserId,
    source: raw.source || 'manual',
  };
}

export function readStoredPmIdentity() {
  if (typeof window === 'undefined') return null;
  return normalizeIdentity(readJson(sessionStorage, PM_IDENTITY_STORAGE_KEY));
}

export function persistPmIdentity(identity) {
  const normalized = normalizeIdentity(identity);
  if (!normalized || typeof window === 'undefined') return null;
  try {
    sessionStorage.setItem(PM_IDENTITY_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore quota */
  }
  return normalized;
}

export function clearPmIdentity() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PM_IDENTITY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

async function fetchIamMe(token) {
  const base = String(import.meta.env.VITE_IAM_API_URL || '').replace(/\/$/, '');
  if (!base || !token) return null;
  try {
    const res = await fetch(`${base}/auth/me`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ email: string, name: string, firstName: string, title: string, kissflowUserId: string, source: string } | null>}
 */
export async function resolveExternalIdentity() {
  const fromUrl = normalizeIdentity(readQueryIdentity());
  if (fromUrl) {
    persistPmIdentity(fromUrl);
    return fromUrl;
  }

  const stored = readStoredPmIdentity();
  if (stored) return stored;

  if (typeof window !== 'undefined') {
    const iamUser = fromIamProfile(readJson(localStorage, 'iam_user'), 'iam_cache');
    const cached = normalizeIdentity(iamUser);
    if (cached) {
      persistPmIdentity(cached);
      return cached;
    }

    const token = localStorage.getItem('iam_token');
    if (token) {
      const me = fromIamProfile(await fetchIamMe(token), 'iam');
      const live = normalizeIdentity(me);
      if (live) {
        persistPmIdentity(live);
        return live;
      }
    }
  }

  return null;
}

export function syntheticKissflowUser(identity) {
  const normalized = normalizeIdentity(identity);
  if (!normalized) return null;
  const name = normalized.name || normalized.email;
  return {
    _id: normalized.kissflowUserId || `iam:${normalized.email}`,
    Id: normalized.kissflowUserId || `iam:${normalized.email}`,
    Name: name,
    FirstName: normalized.firstName,
    Email: normalized.email,
    email: normalized.email,
    Role: { Name: normalized.title || 'Employee' },
    Roles: [{ Name: normalized.title || 'Employee' }],
    _pm_role: normalized.pmRole || 'employee',
    _user_type: normalized.title || 'Employee',
    _external: true,
    _identity_source: normalized.source,
  };
}
