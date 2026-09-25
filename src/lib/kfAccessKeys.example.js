/** Kissflow access keys — copy to kfAccessKeys.js and fill via .env / VITE_* vars. */

const DEV_KISSFLOW_ORIGIN = 'https://development-refexgroup.kissflow.com';
const LIVE_KISSFLOW_ORIGIN = 'https://refexgroup.kissflow.com';

/** Dev / testing tenant (development-refexgroup). */
export const KF_ACCESS_KEY_ID = import.meta.env.VITE_KF_ACCESS_KEY_ID || '';

export const KF_ACCESS_KEY_SECRET = import.meta.env.VITE_KF_ACCESS_KEY_SECRET || '';

export const KF_API_ORIGIN =
  import.meta.env.VITE_KF_API_ORIGIN || DEV_KISSFLOW_ORIGIN;

export const KF_DEFAULT_ACCOUNT_ID =
  import.meta.env.VITE_KF_ACCOUNT_ID || 'AcCMptp3yqcn';

/** Production tenant (refexgroup) — set in live build / .env.production.local */
export const KF_LIVE_ACCESS_KEY_ID = import.meta.env.VITE_KF_LIVE_ACCESS_KEY_ID || '';

export const KF_LIVE_ACCESS_KEY_SECRET = import.meta.env.VITE_KF_LIVE_ACCESS_KEY_SECRET || '';

export const KF_LIVE_API_ORIGIN =
  import.meta.env.VITE_KF_LIVE_API_ORIGIN || LIVE_KISSFLOW_ORIGIN;

export const KF_LIVE_ACCOUNT_ID = import.meta.env.VITE_KF_LIVE_ACCOUNT_ID || '';

function collectHostHints(kfInstance) {
  const hints = [];
  const push = (value) => {
    const text = String(value ?? '').trim().toLowerCase();
    if (text) hints.push(text);
  };

  push(kfInstance?.account?.Domain);
  push(kfInstance?.account?.domain);
  push(kfInstance?.account?.SubDomain);
  push(kfInstance?.account?.subdomain);
  push(typeof window !== 'undefined' ? window?.location?.hostname : '');
  push(typeof document !== 'undefined' ? document?.referrer : '');

  try {
    push(typeof window !== 'undefined' ? window?.top?.location?.hostname : '');
    push(typeof window !== 'undefined' ? window?.parent?.location?.hostname : '');
  } catch {
    // Cross-origin iframe — ignore.
  }

  return hints;
}

/** `live` = refexgroup production tenant; `dev` = development-refexgroup. */
export function resolveKissflowTenant(kfInstance) {
  const hints = collectHostHints(kfInstance).join(' ');

  if (hints.includes('kissflow.store')) return 'live';
  if (hints.includes('development-refexgroup')) return 'dev';
  if (hints.includes('refexgroup.kissflow.com') && !hints.includes('development-refexgroup')) {
    return 'live';
  }

  const isDevBuild =
    (typeof import.meta !== 'undefined' && import.meta?.env?.DEV) ||
    (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development');

  return isDevBuild ? 'dev' : 'live';
}

/** Keys + origin + account fallback for the active Kissflow tenant. */
export function getTenantAccessKeys(kfInstance) {
  const tenant = resolveKissflowTenant(kfInstance);

  if (tenant === 'live') {
    return {
      tenant,
      apiOrigin: KF_LIVE_API_ORIGIN,
      accessKeyId: KF_LIVE_ACCESS_KEY_ID,
      accessKeySecret: KF_LIVE_ACCESS_KEY_SECRET,
      defaultAccountId: KF_LIVE_ACCOUNT_ID || KF_DEFAULT_ACCOUNT_ID,
    };
  }

  return {
    tenant,
    apiOrigin: KF_API_ORIGIN,
    accessKeyId: KF_ACCESS_KEY_ID,
    accessKeySecret: KF_ACCESS_KEY_SECRET,
    defaultAccountId: KF_DEFAULT_ACCOUNT_ID,
  };
}

export function buildKissflowAccessKeyHeaders(accessKeyId, accessKeySecret, kfInstance) {
  const tenantKeys = kfInstance ? getTenantAccessKeys(kfInstance) : null;
  const id = String(accessKeyId || tenantKeys?.accessKeyId || KF_ACCESS_KEY_ID || '').trim();
  const secret = String(accessKeySecret || tenantKeys?.accessKeySecret || KF_ACCESS_KEY_SECRET || '').trim();

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Access-Key-Id': id,
    'X-Access-Key-Secret': secret,
  };
}
