export const PM_DIRECTORY_SESSION_KEY = 'pm_directory_session'

export function readDirectorySession() {
  if (typeof window === 'undefined') return ''
  try {
    return sessionStorage.getItem(PM_DIRECTORY_SESSION_KEY) || ''
  } catch {
    return ''
  }
}

export function persistDirectorySession(token) {
  if (typeof window === 'undefined') return
  try {
    if (token) sessionStorage.setItem(PM_DIRECTORY_SESSION_KEY, token)
    else sessionStorage.removeItem(PM_DIRECTORY_SESSION_KEY)
  } catch {
    /* ignore quota */
  }
}
