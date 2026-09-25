import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_SATELLITE_OPTIONS,
  openSatelliteCreate,
} from '../lib/kfSatelliteCreate.js'

/**
 * Satellite FAB — same hover-fan pattern as solar FloatingActionButton:
 * pills live in the same DOM zone as the +, so the cursor can reach them.
 */

const PILL_WIDTH = 168
const PILL_HEIGHT = 34
const PILL_GAP = 8
const PILL_STEP = PILL_HEIGHT + PILL_GAP
const PLUS_SIZE = 36
const PILL_H_GAP = 10
const PILL_TRANSLATE_X = PLUS_SIZE + PILL_H_GAP

/** Attach fan offsets / delays for 1–3+ options. `direction`: center | down | up */
export function withFanLayout(baseOptions = [], direction = 'center') {
  const n = baseOptions.length
  if (n === 0) return []

  if (direction === 'down') {
    return baseOptions.map((o, i) => ({
      ...o,
      offsetY: i * PILL_STEP,
      delayOpen: `${i * 45}ms`,
      delayClose: `${(n - 1 - i) * 40}ms`,
    }))
  }

  if (direction === 'up') {
    return baseOptions.map((o, i) => ({
      ...o,
      offsetY: -i * PILL_STEP,
      delayOpen: `${i * 45}ms`,
      delayClose: `${(n - 1 - i) * 40}ms`,
    }))
  }

  if (n === 1) {
    return [{ ...baseOptions[0], offsetY: 0, delayOpen: '0ms', delayClose: '0ms' }]
  }
  if (n === 2) {
    const step = PILL_STEP / 2
    return [
      { ...baseOptions[0], offsetY: -step, delayOpen: '0ms', delayClose: '40ms' },
      { ...baseOptions[1], offsetY: step, delayOpen: '55ms', delayClose: '0ms' },
    ]
  }
  return baseOptions.map((o, i) => {
    const mid = (n - 1) / 2
    return {
      ...o,
      offsetY: (i - mid) * PILL_STEP,
      delayOpen: `${i * 45}ms`,
      delayClose: `${(n - 1 - i) * 40}ms`,
    }
  })
}

function fanMetrics(optionCount, direction = 'center') {
  const spread =
    optionCount <= 1
      ? 0
      : direction === 'center' && optionCount === 2
        ? PILL_STEP
        : PILL_STEP * (optionCount - 1)
  const fanWidth = PILL_TRANSLATE_X + PILL_WIDTH + 8

  if (direction === 'down') {
    const pillAnchorTop = (PLUS_SIZE - PILL_HEIGHT) / 2
    const fanHeight = Math.max(PLUS_SIZE, pillAnchorTop + spread + PILL_HEIGHT) + 8
    return { fanWidth, fanHeight, plusTop: 0, pillAnchorTop, fanAlign: 'top' }
  }

  if (direction === 'up') {
    const fanHeight = Math.max(PLUS_SIZE, spread + PILL_HEIGHT) + 8
    const plusTop = fanHeight - PLUS_SIZE
    const pillAnchorTop = plusTop + (PLUS_SIZE - PILL_HEIGHT) / 2
    return { fanWidth, fanHeight, plusTop, pillAnchorTop, fanAlign: 'bottom' }
  }

  const fanHeight = spread + PILL_HEIGHT + 16
  const plusTop = (fanHeight - PLUS_SIZE) / 2
  const pillAnchorTop = fanHeight / 2 - PILL_HEIGHT / 2
  return { fanWidth, fanHeight, plusTop, pillAnchorTop, fanAlign: 'center' }
}

function PlusIcon({ open }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{
        display: 'block',
        transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
      }}
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SatellitePill({ action, actionOpen, busy, onAction, pillAnchorTop }) {
  return (
    <button
      type="button"
      aria-label={`Create ${action.label}`}
      disabled={Boolean(busy) || !actionOpen}
      onClick={() => onAction?.(action)}
      className="pt-fab-pill satellite-pill absolute inline-flex cursor-pointer items-center justify-start gap-2 rounded-xl disabled:cursor-wait disabled:opacity-60"
      style={{
        width: `${PILL_WIDTH}px`,
        height: `${PILL_HEIGHT}px`,
        padding: '0 12px',
        top: `${pillAnchorTop}px`,
        right: 0,
        transform: actionOpen
          ? `translate(-${PILL_TRANSLATE_X}px, ${action.offsetY}px) scale(1)`
          : 'translate(0px, 0px) scale(0.55)',
        opacity: actionOpen ? 1 : 0,
        pointerEvents: actionOpen ? 'auto' : 'none',
        transitionDelay: actionOpen ? action.delayOpen : action.delayClose,
        transformOrigin: 'right center',
        zIndex: 22,
      }}
    >
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#1E88E5]/10"
        aria-hidden
      >
        {busy === action.key ? (
          <i
            className="ri-loader-4-line animate-spin text-[#5B21B6]"
            style={{ fontSize: 12, lineHeight: 1, display: 'block' }}
          />
        ) : (
          <i
            className={`${action.icon} text-[#6D28D9]`}
            style={{ fontSize: 12, lineHeight: 1, display: 'block' }}
          />
        )}
      </span>
      <span
        className="min-w-0 truncate text-left text-xs font-semibold tracking-wide text-slate-700"
        style={{ lineHeight: 1 }}
      >
        {action.label}
      </span>
    </button>
  )
}

/**
 * Quick-create + hub with left-fanning pills.
 * `inline` — Insights row. `overlay` — absolute in a header (legacy).
 */
export default function SatelliteOrbitMenu({
  kfInstance = null,
  className = '',
  onCreated = null,
  options = DEFAULT_SATELLITE_OPTIONS,
  placement = 'inline',
  /**
   * How pills spread vs the + hub.
   * `down` — use in sticky/top headers so Project isn't clipped by the viewport.
   * `center` — classic mid-page fan. `up` — bottom-docked FABs.
   */
  fanDirection = 'center',
  /** Per-option popup ids, e.g. `{ task: 'Popup_QO1ppGoYU6' }` */
  popupIds = null,
}) {
  const closeTimerRef = useRef(null)
  const [actionOpen, setActionOpen] = useState(false)
  const [busyKey, setBusyKey] = useState(null)
  const [error, setError] = useState('')

  const fanActions = useMemo(
    () => withFanLayout(options, fanDirection),
    [options, fanDirection],
  )
  const { fanWidth, fanHeight, plusTop, pillAnchorTop, fanAlign } = useMemo(
    () => fanMetrics(fanActions.length, fanDirection),
    [fanActions.length, fanDirection],
  )

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const openMenu = useCallback(() => {
    clearCloseTimer()
    setActionOpen(true)
  }, [clearCloseTimer])

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      if (!busyKey) setActionOpen(false)
      closeTimerRef.current = null
    }, 120)
  }, [busyKey, clearCloseTimer])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  useEffect(() => {
    if (!actionOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setActionOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [actionOpen])

  const handleAction = useCallback(
    async (action) => {
      if (!action?.key || busyKey) return
      setBusyKey(action.key)
      setError('')
      try {
        await openSatelliteCreate(kfInstance, action.key, {
          popupIds: popupIds || undefined,
          option: action,
        })
        onCreated?.(action.key)
        setActionOpen(false)
      } catch (err) {
        const message = err?.message || `Failed to open ${action.label}`
        console.warn('Satellite create failed:', message)
        setError(message)
        try {
          kfInstance?.client?.showInfo?.(message)
        } catch {
          // ignore
        }
      } finally {
        setBusyKey(null)
      }
    },
    [busyKey, kfInstance, onCreated, popupIds],
  )

  const zoneClass =
    placement === 'overlay'
      ? 'pt-fab-zone absolute right-2 top-1/2 z-40 -translate-y-1/2 sm:right-5'
      : 'pt-fab-zone relative z-40 shrink-0'

  const labels = fanActions.map((a) => a.label).join(', ')

  return (
    <div
      className={`${zoneClass} ${className}`}
      style={{ width: `${PLUS_SIZE}px`, height: `${PLUS_SIZE}px` }}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <div
        className={
          fanAlign === 'top'
            ? 'absolute right-0 top-0'
            : fanAlign === 'bottom'
              ? 'absolute right-0 bottom-0'
              : 'absolute right-0 top-1/2 -translate-y-1/2'
        }
        style={{
          width: `${fanWidth}px`,
          height: `${fanHeight}px`,
          pointerEvents: actionOpen ? 'auto' : 'none',
        }}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        {fanActions.map((action) => (
          <SatellitePill
            key={action.key}
            action={action}
            actionOpen={actionOpen}
            busy={busyKey}
            onAction={handleAction}
            pillAnchorTop={pillAnchorTop}
          />
        ))}

        <button
          type="button"
          aria-expanded={actionOpen}
          aria-label={labels ? `Quick create — ${labels}` : 'Quick create'}
          onClick={() => {
            clearCloseTimer()
            setActionOpen((v) => !v)
          }}
          className={`pt-fab-btn absolute right-0 flex items-center justify-center rounded-full transition-all duration-300 ${
            actionOpen ? 'is-open' : ''
          }`}
          style={{
            width: `${PLUS_SIZE}px`,
            height: `${PLUS_SIZE}px`,
            top: `${plusTop}px`,
            zIndex: 30,
            pointerEvents: 'auto',
          }}
        >
          <PlusIcon open={actionOpen} />
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="absolute right-0 top-full z-30 mt-2 max-w-[14rem] rounded-lg border border-violet-200 bg-white px-2 py-1 text-[10px] font-medium text-violet-800 shadow-sm"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
