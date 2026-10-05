/** Tracker roles: Employee, Project Manager, and Admin (from User Master). */

import { isDirectoryAdminRole, isProjectManagerDesignation } from './trackerRole.js'

export const PM_ROLE_KEYS = {
  employee: 'employee',
  pm: 'pm',
  admin: 'admin',
}

export const PM_ROLE_OPTIONS = [
  {
    key: 'employee',
    label: 'Employee',
    hint: 'My projects, tasks and subtasks',
  },
  {
    key: 'pm',
    label: 'Project Manager',
    hint: 'My projects, team, tasks and subtasks',
  },
]

export const PM_ROLE_LABELS = {
  employee: 'Employee',
  pm: 'Project Manager',
  admin: 'Admin',
}

const compact = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

export function stringifyKfRole(roleLike) {
  if (!roleLike) return ''
  if (typeof roleLike === 'string') return roleLike.trim()
  if (Array.isArray(roleLike)) {
    for (const item of roleLike) {
      const text = stringifyKfRole(item)
      if (text) return text
    }
    return ''
  }
  if (typeof roleLike === 'object') {
    return String(
      roleLike.Name ||
        roleLike.name ||
        roleLike.Title ||
        roleLike.title ||
        roleLike.Role ||
        roleLike.role ||
        '',
    ).trim()
  }
  return ''
}

function roleBlobFromUser(user) {
  if (!user) return ''
  return [
    user._pm_role,
    stringifyKfRole(user.Role),
    stringifyKfRole(user.Roles),
    user._tracker_role,
    user._user_type,
    user.title,
    user.job_title,
    user.designation,
  ]
    .filter(Boolean)
    .join(' ')
}

function keyFromRoleName(name) {
  const blob = compact(name)
  if (!blob) return ''
  if (blob === 'employee' || blob === 'user') return 'employee'
  if (blob === 'pm' || blob === 'projectmanager') return 'pm'
  if (isDirectoryAdminRole(blob) || blob === 'orgadmin') return 'admin'
  if (
    blob === 'cto' ||
    blob === 'groupcto' ||
    blob === 'groupctos' ||
    blob === 'pmhead' ||
    blob === 'pmohead' ||
    blob === 'headpm'
  ) {
    return 'pm'
  }
  return ''
}

export function resolvePmRoleKey(user, fallback = 'employee') {
  const explicit = keyFromRoleName(user?._pm_role)
  if (explicit) return explicit

  const named = keyFromRoleName(
    stringifyKfRole(user?.Role) || stringifyKfRole(user?.Roles) || user?._tracker_role,
  )
  if (named) return named

  const blob = compact(roleBlobFromUser(user))
  if (!blob) return fallback

  if (isDirectoryAdminRole(blob) || blob.includes('orgadmin')) return 'admin'
  if (blob.includes('employee')) return 'employee'
  if (
    isProjectManagerDesignation(blob) ||
    blob.includes('pmhead') ||
    blob.includes('groupcto') ||
    blob.includes('cto') ||
    blob === 'pm' ||
    blob.includes('pmo')
  ) {
    return 'pm'
  }
  return fallback
}

export function labelForPmRole(roleKey) {
  const key = PM_ROLE_KEYS[roleKey] || resolvePmRoleKey({ _pm_role: roleKey }, 'employee')
  return PM_ROLE_LABELS[key] || 'Employee'
}

export function canEditTrackerDirectory(user) {
  return resolvePmRoleKey(user, 'employee') === 'admin'
}
