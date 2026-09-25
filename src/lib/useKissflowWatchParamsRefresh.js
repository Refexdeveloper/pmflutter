import { useCallback, useEffect, useState } from 'react'

/** Shared Kissflow popup-close refresh. Same 300ms debounce as hub pages. */
export function useKissflowWatchParamsRefresh(kfInstance) {
  const [refreshTick, setRefreshTick] = useState(0)

  const bumpRefresh = useCallback(() => {
    setRefreshTick((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!kfInstance?.context?.watchParams) return undefined
    let timer = null
    const unsub = kfInstance.context.watchParams(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(bumpRefresh, 300)
    })
    return () => {
      if (timer) clearTimeout(timer)
      if (typeof unsub === 'function') unsub()
    }
  }, [kfInstance, bumpRefresh])

  return { refreshTick, bumpRefresh }
}
