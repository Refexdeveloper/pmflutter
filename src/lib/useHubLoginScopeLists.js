import { useCallback, useEffect, useMemo, useState } from 'react'
import { countCreatedStatuses, filterHubScopeRows, isClosedWorkRow } from './pmHubLoginLists.js'
import { useKissflowWatchParamsRefresh } from './useKissflowWatchParamsRefresh.js'

/**
 * Assigned + Created lists for the login email.
 * `fetchByScope(kf, { email, scope, bust })` must return `{ rows }`.
 */
export function useHubLoginScopeLists({
  kfInstance,
  loginEmail,
  fetchByScope,
  enabled = true,
  taskScope = 'assigned',
  assignedStatus = 'open',
  createdStatusFilter = 'Draft',
}) {
  const { refreshTick, bumpRefresh } = useKissflowWatchParamsRefresh(enabled ? kfInstance : null)
  const [assigned, setAssigned] = useState([])
  const [created, setCreated] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return undefined
    if (!kfInstance || !loginEmail) {
      setAssigned([])
      setCreated([])
      return undefined
    }
    let cancelled = false
    setLoading(true)
    const bust = refreshTick > 0
    Promise.all([
      fetchByScope(kfInstance, { email: loginEmail, scope: 'assigned', bust }),
      fetchByScope(kfInstance, { email: loginEmail, scope: 'created', bust }),
    ])
      .then(([assignedResult, createdResult]) => {
        if (cancelled) return
        setAssigned(Array.isArray(assignedResult?.rows) ? assignedResult.rows : [])
        setCreated(Array.isArray(createdResult?.rows) ? createdResult.rows : [])
      })
      .catch((error) => {
        if (cancelled) return
        console.warn('Hub login-email lists failed', error?.message || error)
        setAssigned([])
        setCreated([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, kfInstance, loginEmail, refreshTick, fetchByScope])

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
