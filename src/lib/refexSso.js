import { persistDirectorySession } from './directorySession.js'

const TOKEN_KEY = 'iam_token'

export function refexOneOrigin() {
  return String(import.meta.env.VITE_REFEXONE_ORIGIN || 'https://refexone.com').replace(/\/$/, '')
}

export function refexLoginUrl() {
  const returnTo = `${window.location.origin}${window.location.pathname}`
  return `${refexOneOrigin()}/login?oidc_redirect=${encodeURIComponent(returnTo)}`
}

export function refexLogoutUrl() {
  return `${refexOneOrigin()}/launcher`
}

export function readIamToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

/** Same handoff P2P uses: Refex One appends ?token= after login. */
export function captureSsoTokenFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const incoming = params.get('token') || params.get('iam_token') || ''
  if (incoming) {
    try {
      localStorage.setItem(TOKEN_KEY, incoming)
    } catch {
      /* ignore quota */
    }
    params.delete('token')
    params.delete('iam_token')
    const next = params.toString()
    const path = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', path)
  }
  return readIamToken()
}

export function clearRefexSession() {
  persistDirectorySession('')
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('iam_user')
  } catch {
    /* ignore */
  }
  try {
    document.cookie = 'iam_token=; Path=/; Max-Age=0; SameSite=Lax'
  } catch {
    /* ignore */
  }
}

export async function establishRefexSso() {
  const iamToken = captureSsoTokenFromUrl()
  if (!iamToken) return { redirect: refexLoginUrl() }

  const res = await fetch('/api/pm/sso/session', {
    headers: { Accept: 'application/json', Authorization: `Bearer ${iamToken}` },
  })
  if (res.status === 401) {
    clearRefexSession()
    return { redirect: refexLoginUrl() }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error || 'Could not sign in with Refex One.' }
  }
  const data = await res.json()
  persistDirectorySession(data.token)
  try {
    localStorage.setItem('iam_user', JSON.stringify(data.person || {}))
  } catch {
    /* ignore */
  }
  const person = data.person || {}
  return {
    identity: {
      email: person.email,
      name: person.name || person.email,
      pmRole: person.trackerRole || 'employee',
      title: person.designation || '',
      source: 'refex-sso',
    },
  }
}

export function logoutToRefexOne() {
  clearRefexSession()
  window.location.replace(refexLogoutUrl())
}
