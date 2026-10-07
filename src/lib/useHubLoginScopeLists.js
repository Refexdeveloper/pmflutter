import { useCallback, useEffect, useMemo, useState } from 'react'
import { countCreatedStatuses, filterHubScopeRows, isClosedWorkRow } from './pmHubLoginLists.js'
import { readListSnapshot, writeListSnapshot } from './listSnapshot.js'
import { useKissflowWatchParamsRefresh } from './useKissflowWatchParamsRefresh.js'

function snapshotKey(listKey, email) {
  const who = String(email || '').trim().toLowerCase()
  const kind = String(listKey || '').trim()
  if (!who || !kind) return ''
  return `hub:${kind}:${who}`
}

function readHubSnapshot(listKey, email) {
  const key = snapshotKey(listKey, email)
  if (!key) return null
  const snap = readListSnapshot(key)
  if (!Array.isArray(snap?.assigned) && !Array.isArray(snap?.created)) return null
  return {
    assigned: Array.isArray(snap.assigned) ? snap.assigned : [],
    created: Array.isArray(snap.created) ? snap.created : [],
  }
}

/**
 * Assigned + Created lists for the login email.
 * `fetchByScope(kf, { email, scope, bust })` must return `{ rows }`.
 * A previous visit paints immediately; Kissflow refreshes behind it.
 */
export function useHubLoginScopeLists({
  kfInstance,
  loginEmail,
  fetchByScope,
  listKey = '',
  enabled = true,
  taskScope = 'assigned',
  assignedStatus = 'open',
  createdStatusFilter = 'Draft',
}) {
  const { refreshTick, bumpRefresh } = useKissflowWatchParamsRefresh(enabled ? kfInstance : null)
  const initial = readHubSnapshot(listKey, loginEmail)
  const [assigned, setAssigned] = useState(() => initial?.assigned || [])
  const [created, setCreated] = useState(() => initial?.created || [])
  const [loading, setLoading] = useState(() => !(initial && (initial.assigned.length || initial.created.length)))

  useEffect(() => {
    if (!enabled) return undefined
    if (!kfInstance || !loginEmail) {
      return undefined
    }
    let cancelled = false
    const snap = readHubSnapshot(listKey, loginEmail)
    const hadRows = Boolean(snap && (snap.assigned.length || snap.created.length))
    if (hadRows) {
      setAssigned(snap.assigned)
      setCreated(snap.created)
      setLoading(false)
    } else {
      setLoading(true)
    }
    const bust = refreshTick > 0
    Promise.all([
      fetchByScope(kfInstance, { email: loginEmail, scope: 'assigned', bust }),
      fetchByScope(kfInstance, { email: loginEmail, scope: 'created', bust }),
    ])
      .then(([assignedResult, createdResult]) => {
        if (cancelled) return
        const nextAssigned = Array.isArray(assignedResult?.rows) ? assignedResult.rows : []
        const nextCreated = Array.isArray(createdResult?.rows) ? createdResult.rows : []
        setAssigned(nextAssigned)
        setCreated(nextCreated)
        const key = snapshotKey(listKey, loginEmail)
        if (key) writeListSnapshot(key, { assigned: nextAssigned, created: nextCreated })
      })
      .catch((error) => {
        if (cancelled) return
        console.warn('Hub login-email lists failed', error?.message || error)
        if (!hadRows) {
          setAssigned([])
          setCreated([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, kfInstance, loginEmail, refreshTick, fetchByScope, listKey])

  const assignedRows = Array.isArray(assigned) ? assigned : []
  const createdRows = Array.isArray(created) ? created : []

  const scopedRows = useMemo(
    () =>
      filterHubScopeRows(taskScope === 'created' ? createdRows : assignedRows, {
        scope: taskScope,
        assignedStatus,
        createdStatusFilter,
      }),
    [taskScope, createdRows, assignedRows, assignedStatus, createdStatusFilter],
  )

  const statusCounts = useMemo(() => countCreatedStatuses(createdRows), [createdRows])
  const scopeCounts = useMemo(() => {
    const assignedOpen = assignedRows.filter((row) => !isClosedWorkRow(row)).length
    return {
      created: createdRows.length,
      assignedOpen,
      assignedClosed: assignedRows.length - assignedOpen,
    }
  }, [assignedRows, createdRows])

  const removeRowsByIds = useCallback((ids, resolveId) => {
    const drop = new Set((Array.isArray(ids) ? ids : []).map(String))
    const keep = (row) => !drop.has(String(resolveId(row) || ''))
    setAssigned((prev) => prev.filter(keep))
    setCreated((prev) => prev.filter(keep))
  }, [])

  return {
    assignedRows,
    createdRows,
    scopedRows,
    loading,
    statusCounts,
    scopeCounts,
    refreshTick,
    bumpRefresh,
    removeRowsByIds,
  }
}
