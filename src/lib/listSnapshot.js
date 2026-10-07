/** Last successful list, so the next visit paints before Kissflow answers. */

const PREFIX = 'pm:snap:'

export function readListSnapshot(key) {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const parsed = JSON.parse(sessionStorage.getItem(`${PREFIX}${key}`) || 'null')
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function writeListSnapshot(key, value) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value))
  } catch {
    /* quota — keep the in-memory copy */
  }
}
