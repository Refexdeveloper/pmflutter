/** Hub Assigned / Created chips after lists are loaded for the login email. */

function rowWorkflowStatus(row) {
  return String(
    row?.status ||
      row?.Task_Status ||
      row?.TStatus ||
      row?.raw?.Task_Status ||
      row?.raw?.TStatus ||
      row?.raw?._status ||
      '',
  )
}

export function isClosedWorkRow(row) {
  const status = rowWorkflowStatus(row).toLowerCase()
  return /complete|closed|done|withdrawn|rejected|cancelled|canceled/.test(status)
}

export function createdStatusBucket(row) {
  const status = rowWorkflowStatus(row).toLowerCase()
  if (/withdraw/.test(status)) return 'Withdrawn'
  if (/reject/.test(status)) return 'Rejected'
  if (/complete|closed|done/.test(status)) return 'Completed'
  if (/draft/.test(status)) return 'Draft'
  return 'In progress'
}

export function countCreatedStatuses(rows) {
  const counts = { Draft: 0, 'In progress': 0, Completed: 0, Withdrawn: 0, Rejected: 0 }
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = createdStatusBucket(row)
    if (counts[key] != null) counts[key] += 1
  }
  return counts
}

export function filterHubScopeRows(rows, { scope, assignedStatus, createdStatusFilter }) {
  const list = Array.isArray(rows) ? rows : []
  if (scope === 'created') {
    return list.filter((row) => createdStatusBucket(row) === createdStatusFilter)
  }
  const wantClosed = assignedStatus === 'closed'
  return list.filter((row) => isClosedWorkRow(row) === wantClosed)
}
