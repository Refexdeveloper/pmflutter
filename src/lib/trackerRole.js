/** Tracker role taken from Refex One User Master, plus an admin override. */

const compact = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

export function isDirectoryAdminRole(role) {
  const blob = compact(role)
  return blob === 'admin' || blob === 'orgadmin' || blob === 'administrator' || blob === 'appadmin'
}

export function isProjectManagerDesignation(designation) {
  const blob = compact(designation)
  if (!blob) return false
  return blob.includes('manager') || blob.includes('projectmanager') || blob.includes('programmanager')
}

/**
 * @param {{ role?: string, directoryRole?: string, designation?: string, Role?: string }} row
 * @param {string} [override] admin-set `employee` or `pm`
 */
export function trackerRoleFromDirectory(row, override = '') {
  const directoryRole = row?.directoryRole || row?.role || ''
  if (isDirectoryAdminRole(directoryRole)) return 'admin'
  const chosen = compact(override)
  if (chosen === 'employee') return 'employee'
  if (chosen === 'pm' || chosen === 'projectmanager') return 'pm'
  const designation = row?.designation || row?.Role || ''
  if (isProjectManagerDesignation(designation)) return 'pm'
  return 'employee'
}
