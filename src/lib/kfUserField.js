import {
  lookupKissflowUserByEmail,
} from './kfUserLookup.js'

/** Pull a work email out of a string or Kissflow / User Master person object. */
export function asEmailText(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim()
    const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    return match ? match[0].trim() : ''
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = asEmailText(item)
      if (hit) return hit
    }
    return ''
  }
  if (typeof value === 'object') {
    return (
      asEmailText(value.Email) ||
      asEmailText(value.email) ||
      asEmailText(value.Value) ||
      asEmailText(value.value) ||
      asEmailText(value.Name) ||
      asEmailText(value.name)
    )
  }
  return ''
}

/**
 * Task / subtask list and report rows often have no Assigned_To / Assignee_1 object.
 * Assignee is `externalemail` (also Assignee_Email_Extracted).
 */
export function reportAssigneeEmail(row) {
  const raw = row?.raw && typeof row.raw === 'object' ? row.raw : {}
  return (
    asEmailText(row?.externalemail) ||
    asEmailText(raw.externalemail) ||
    asEmailText(row?.assignedToEmail) ||
    asEmailText(row?.assigneeEmail) ||
    asEmailText(raw.Assignee_Email_Extracted) ||
    asEmailText(row?.Assignee_Email_Extracted) ||
    asEmailText(row?.assignee_email) ||
    asEmailText(raw.assignee_email) ||
    asEmailText(row?.Assignee_Email) ||
    asEmailText(raw.Assignee_Email) ||
    asEmailText(row?.Assignee_1) ||
    asEmailText(raw.Assignee_1) ||
    asEmailText(row?.Assigned_To) ||
    asEmailText(raw.Assigned_To)
  )
}

export function reportAssigneeName(row) {
  const raw = row?.raw && typeof row.raw === 'object' ? row.raw : {}
  const fromUser = String(
    row?.Assigned_To?.Name ||
      raw.Assigned_To?.Name ||
      row?.Assignee_1?.Name ||
      raw.Assignee_1?.Name ||
      row?.assignedTo ||
      row?.assignee_name ||
      '',
  ).trim()
  if (fromUser && fromUser !== '—' && fromUser.toLowerCase() !== 'unassigned') return fromUser
  return reportAssigneeEmail(row) || 'Unassigned'
}

export function compactFields(value) {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) return value
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue
    if (typeof item === 'string' && item.trim() === '') {
      out[key] = null
      continue
    }
    out[key] = item
  }
  return out
}

const USER_FIELD_KEYS = new Set([
  'Assignee_1',
  'Assigned_To',
  'AssignedTo',
  'Assigned_To_1',
  'Secondary_Assignee',
  'Business_Owner',
  'Sponsor',
  'Project_Owner',
  'Project_Manager',
  'COS_Owner',
])

export function isKissflowUserId(value) {
  const id = String(value || '').trim()
  if (!id || id.startsWith('iam:') || id.includes('@') || id.includes('-')) return false
  return /^Us[A-Za-z0-9_]+$/.test(id)
}

export function personPickerLabel(user) {
  const name = String(user?.Name || user?.DisplayName || '').trim()
  const email = String(user?.Email || user?.email || '').trim()
  if (name && email && name.toLowerCase() !== email.toLowerCase()) {
    return `${name} (${email})`
  }
  return email || name || ''
}

/** User object for webhook / create payloads from any name or email. */
export function kissflowUserFromPerson(person) {
  if (!person) return null
  if (typeof person === 'string') {
    person = personFromTypedValue(person)
  }
  if (!person || typeof person !== 'object' || Array.isArray(person)) return null
  const Email = String(person.Email || person.email || '').trim()
  const Name =
    String(person.Name || person.DisplayName || '').trim() || (Email ? Email.split('@')[0] : '')
  const id = [
    person.kissflowUserId,
    person.kissflow_user_id,
    person._id,
    person.Id,
    person.id,
  ]
    .map((value) => String(value || '').trim())
    .find((value) => isKissflowUserId(value))
  if (!Email && !Name && !id) return null
  return {
    Kind: 'User',
    ...(id ? { _id: id } : {}),
    ...(Name ? { Name } : {}),
    ...(Email ? { Email } : {}),
  }
}

export function assigneeApiFields(kind = 'task', person = null) {
  const user = kissflowUserFromPerson(person)
  if (!user) return {}
  const email = user.Email || null
  const name = user.Name || null
  const fields = {
    Assignee_Name: name,
    Assignee_Email: email,
    Assignee_Email_Extracted: email,
  }
  if (String(kind).toLowerCase() === 'subtask') {
    return {
      Assignee: name || email || '',
      ...fields,
    }
  }
  return fields
}

/** Logged-in user on task submit — webhook key `Requester Email`. */
export function requesterFields(loginUser = null) {
  const Email = String(loginUser?.Email || loginUser?.email || '').trim()
  const Name = String(loginUser?.Name || loginUser?.DisplayName || '').trim()
  if (!Email && !Name) return {}
  return {
    'Requester Email': Email || null,
    Requester_Email: Email || null,
    Requester_Name: Name || null,
    Created_by_flat_field_email: Email || null,
  }
}

/** Kissflow User fields are objects — `_id` when known, otherwise name/email. */
export function toKissflowUserField(user) {
  const mapped = kissflowUserFromPerson(user)
  if (!mapped) return null
  if (isKissflowUserId(mapped._id)) return mapped
  return null
}

export const toKissflowUserType = toKissflowUserField

/** Compact Kissflow user for Assigned_To / AssignedTo. */
export function toAssignedToPayload(user) {
  const mapped = toKissflowUserField(user)
  if (!mapped) return null
  return {
    _id: mapped._id,
    Kind: 'User',
    Name: mapped.Name,
    Email: mapped.Email,
  }
}

/**
 * Selected assignee → email → Kissflow User API search → Assigned_To object or null.
 * User Master UUID / iam: ids are never used. Only Kissflow `Us…` ids.
 */
export async function resolveKissflowDirectoryStatus(kfInstance, userOrEmail) {
  const person =
    typeof userOrEmail === 'string' ? personFromTypedValue(userOrEmail) : userOrEmail
  const email = String(person?.Email || person?.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { status: 'unknown', email: '', user: null }
  }

  try {
    const row = await lookupKissflowUserByEmail(kfInstance, email, { allowWhenPaused: true })
    if (row) {
      return { status: 'kissflow', email, user: toAssignedToPayload(row) }
    }
    return { status: 'external', email, user: null }
  } catch (err) {
    return {
      status: 'unverified',
      email,
      user: null,
      error: err?.message || 'Kissflow directory could not be verified',
    }
  }
}

export async function resolveKissflowUserField(kfInstance, userOrEmail) {
  const result = await resolveKissflowDirectoryStatus(kfInstance, userOrEmail)
  return result.user
}

export function personFromTypedValue(raw, fallbackUser = null) {
  const text = String(raw || '').trim()
  if (!text) return null
  const fallbackName = String(fallbackUser?.Name || fallbackUser?.DisplayName || '').trim()
  const fallbackEmail = String(fallbackUser?.Email || fallbackUser?.email || '').trim()
  if (
    fallbackUser
    && (text === fallbackName
      || text === fallbackEmail
      || (fallbackName && fallbackEmail && text === `${fallbackName} <${fallbackEmail}>`)
      || (fallbackName && fallbackEmail && text === `${fallbackName} (${fallbackEmail})`))
  ) {
    return fallbackUser
  }
  if (text.includes('@')) {
    const email = text.replace(/^.*<\s*/, '').replace(/\s*>$/, '').replace(/^.*\(/, '').replace(/\)\s*$/, '').trim()
    const name = text.includes('<')
      ? text.split('<')[0].trim()
      : text.includes('(')
        ? text.split('(')[0].trim()
        : email.split('@')[0]
    return { Name: name || email, Email: email, email }
  }
  return { Name: text, Email: '', email: '' }
}

export function resolvePersonFromPicker(raw, options = [], fallbackUser = null) {
  const text = String(raw || '').trim()
  if (!text) return null
  const selected = (Array.isArray(options) ? options : []).find(
    (o) => o.value === text || o.label === text,
  )
  return personFromTypedValue(text, selected?.user || fallbackUser)
}

export function externalPersonText(user) {
  if (!user || typeof user !== 'object') {
    return { Name: '', Email: '', not_in_kissflow: true }
  }
  return {
    Name: String(user.Name || user.DisplayName || '').trim(),
    Email: String(user.Email || user.email || '').trim(),
    not_in_kissflow: !toKissflowUserField(user),
  }
}

/** Typed assignee for the webhook. Never requires a Kissflow directory user. */
export function assigneeTextFields(raw, fallbackUser = null) {
  const source = personFromTypedValue(raw, fallbackUser)
  const text = externalPersonText(source)
  const Name = text.Name || String(raw || '').trim()
  return {
    Assignee_Name: Name || null,
    Assignee_Email: text.Email || null,
    not_in_kissflow: true,
  }
}

export function sanitizeWebhookUserFields(fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return fields
  const out = { ...fields }
  for (const key of USER_FIELD_KEYS) {
    if (!(key in out)) continue
    const value = out[key]
    if (value == null || value === '') {
      delete out[key]
      continue
    }
    const user = toKissflowUserField(value)
    if (user) out[key] = user
    else delete out[key]
  }
  return out
}
