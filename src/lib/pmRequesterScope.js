import { asEmailText, reportAssigneeEmail } from './kfUserField.js'

export function rowRequesterEmail(row) {
  const raw = row?.raw && typeof row.raw === 'object' ? row.raw : {}
  return (
    asEmailText(row?.requesterEmail) ||
    asEmailText(raw['Requester Email']) ||
    asEmailText(raw.Requester_Email) ||
    asEmailText(raw.Requester) ||
    asEmailText(raw.Created_by_flat_field_email) ||
    asEmailText(raw._created_by)
  ).toLowerCase()
}

export function rowAssigneeEmail(row) {
  return reportAssigneeEmail(row).toLowerCase()
}

/** Local / User Master login: show items requested by this email (and items assigned to them). */
export function rowVisibleToRequester(row, user) {
  const email = asEmailText(user?.Email || user?.email).toLowerCase()
  if (!email) return false
  if (rowRequesterEmail(row) === email) return true
  if (rowAssigneeEmail(row) === email) return true
  return false
}

export function filterRowsForRequester(rows, user) {
  const email = asEmailText(user?.Email || user?.email)
  if (!email) return Array.isArray(rows) ? rows : []
  return (Array.isArray(rows) ? rows : []).filter((row) => rowVisibleToRequester(row, user))
}

export function isLocalRequesterIdentity(user) {
  if (user?._external) return true
  const source = String(user?._identity_source || user?._identitySource || '').trim().toLowerCase()
  if (source === 'user-master' || source === 'manual' || source === 'iam') return true
  const id = String(user?._id || '').trim()
  return id.startsWith('iam:')
}
