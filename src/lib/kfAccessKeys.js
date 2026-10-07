/**
 * Public Kissflow tenant settings for the browser.
 * Access key id/secret stay on the Node server and are added by the /kf-dev and /kf-live proxy.
 */

const DEV_KISSFLOW_ORIGIN = 'https://development-refexgroup.kissflow.com';
const LIVE_KISSFLOW_ORIGIN = 'https://refexgroup.kissflow.com';

export const KF_ACCESS_KEY_ID = '';
export const KF_ACCESS_KEY_SECRET = '';
export const KF_LIVE_ACCESS_KEY_ID = '';
export const KF_LIVE_ACCESS_KEY_SECRET = '';

export const KF_API_ORIGIN =
  import.meta.env.VITE_KF_API_ORIGIN ||
  import.meta.env.VITE_KF_BASE_URL ||
  DEV_KISSFLOW_ORIGIN;

export const KF_DEV_ACCOUNT_ID =
  import.meta.env.VITE_KF_DEV_ACCOUNT_ID ||
  import.meta.env.VITE_KF_ACCOUNT_ID ||
  'AcCMptp3yqcn';

export const KF_DEFAULT_ACCOUNT_ID = KF_DEV_ACCOUNT_ID;

export const KF_LIVE_API_ORIGIN =
  import.meta.env.VITE_KF_LIVE_API_ORIGIN || LIVE_KISSFLOW_ORIGIN;

export const KF_LIVE_ACCOUNT_ID =
  import.meta.env.VITE_KF_LIVE_ACCOUNT_ID || 'AcCMptlq60zH';

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

/** Origin + account for the active Kissflow tenant. Key fields stay empty in the browser. */
export function getTenantAccessKeys(kfInstance) {
  const tenant = resolveKissflowTenant(kfInstance);

  if (tenant === 'live') {
    return {
      tenant,
      apiOrigin: KF_LIVE_API_ORIGIN,
      accessKeyId: '',
      accessKeySecret: '',
      defaultAccountId: KF_LIVE_ACCOUNT_ID || KF_DEFAULT_ACCOUNT_ID,
    };
  }

  return {
    tenant,
    apiOrigin: KF_API_ORIGIN,
    accessKeyId: '',
    accessKeySecret: '',
    defaultAccountId: KF_DEFAULT_ACCOUNT_ID,
  };
}

export function buildKissflowAccessKeyHeaders(accessKeyId, accessKeySecret, kfInstance) {
  const tenantKeys = kfInstance ? getTenantAccessKeys(kfInstance) : null;
  const id = String(accessKeyId || tenantKeys?.accessKeyId || '').trim();
  const secret = String(accessKeySecret || tenantKeys?.accessKeySecret || '').trim();
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (id && secret) {
    headers['X-Access-Key-Id'] = id;
    headers['X-Access-Key-Secret'] = secret;
  }
  return headers;
}
