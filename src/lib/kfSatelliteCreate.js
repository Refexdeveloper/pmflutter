/**
 * Quick-create from satellite orbit menu — Project / Task / Change Request / Subtask.
 * Reuses existing My Items entity configs + popup create patterns.
 */

import {
  PROJECTS_ENTITY,
  TASKS_ENTITY,
  SUBTASKS_ENTITY,
  CR_ENTITY,
} from './pmMyItemsEntities.js'
import { openPmNewItemPopup } from './kfPmMyItemsCreate.js'
import { resolvePmPopupId } from './kfPmMyItemsPaths.js'
import { requestOpenTaskDetails } from './pmTaskDetails.js'
import { requestOpenSubtaskDetails } from './pmSubtaskDetails.js'
import { requestOpenProjectDetails } from './pmProjectDetails.js'

export const SATELLITE_ORBIT_OPTIONS = [
  {
    key: 'project',
    label: 'Project',
    icon: 'ri-folder-3-line',
    entity: PROJECTS_ENTITY,
  },
  {
    key: 'task',
    label: 'Task',
    icon: 'ri-task-line',
    entity: TASKS_ENTITY,
  },
  {
    key: 'changeRequest',
    label: 'Change Request',
    icon: 'ri-git-pull-request-line',
    entity: CR_ENTITY,
  },
  {
    key: 'subtask',
    label: 'Subtask',
    icon: 'ri-node-tree',
    entity: SUBTASKS_ENTITY,
  },
]

/** Default employee / general hub: Project · Task · Change Request */
export const DEFAULT_SATELLITE_OPTIONS = SATELLITE_ORBIT_OPTIONS.filter((o) =>
  ['project', 'task', 'changeRequest'].includes(o.key),
)

/** UserSpecificPT / PM hub: Project · Task · Sub Task */
export const PROJECT_TASK_SATELLITE_OPTIONS = [
  ...SATELLITE_ORBIT_OPTIONS.filter((o) => ['project', 'task'].includes(o.key)),
  {
    ...SATELLITE_ORBIT_OPTIONS.find((o) => o.key === 'subtask'),
    label: 'Sub Task',
  },
].filter(Boolean)

/** Tasks dashboard hub: Task · Subtask only */
export const TASKS_DASHBOARD_SATELLITE_OPTIONS = SATELLITE_ORBIT_OPTIONS.filter((o) =>
  ['task', 'subtask'].includes(o.key),
)

function resolveSdk(kfInstance) {
  return (
    kfInstance ??
    (typeof window !== 'undefined' ? window.kf : null) ??
    null
  )
}

function canOpenKissflowPopup(sdk) {
  return typeof sdk?.app?.page?.openPopup === 'function'
}

function openLocalCreateForm(optionKey, overrides = {}) {
  if (optionKey === 'task') {
    requestOpenTaskDetails(overrides.taskDefaults || {})
    return { localForm: true }
  }
  if (optionKey === 'subtask') {
    requestOpenSubtaskDetails(overrides.subtaskDefaults || {})
    return { localForm: true }
  }
  if (optionKey === 'project') {
    requestOpenProjectDetails(overrides.projectDefaults || {})
    return { localForm: true }
  }
  return null
}

/**
 * Open create flow for a satellite orbit option.
 * - Task / Subtask: POST draft → openPopup with InstanceID + ActivityInstanceID
 * - Project / CR: open entity popup (case / process create UI)
 * @param {object} [overrides]
 * @param {Record<string, string>} [overrides.popupIds] — per-option popup id
 * @param {object} [overrides.option] — full option (when using a custom options list)
 */
export async function openSatelliteCreate(kfInstance, optionKey, overrides = {}) {
  const option =
    overrides.option ||
    SATELLITE_ORBIT_OPTIONS.find((o) => o.key === optionKey)
  if (!option) throw new Error(`Unknown satellite option: ${optionKey}`)

  const sdk = resolveSdk(kfInstance)
  if (!canOpenKissflowPopup(sdk)) {
    const local = openLocalCreateForm(optionKey, overrides)
    if (local) return local
    throw new Error('Kissflow forms are not available outside Kissflow.')
  }
  if (!sdk) throw new Error('Kissflow SDK not available')

  const entity = option.entity
  const popupOverride = String(overrides?.popupIds?.[optionKey] || '').trim()

  if (entity?.createDraftOnNew && entity?.kind === 'process') {
    if (popupOverride) {
      return openPmNewItemPopup(sdk, { ...entity, popupId: popupOverride })
    }
    return openPmNewItemPopup(sdk, entity)
  }

  const popupId = popupOverride || resolvePmPopupId(entity)
  if (!popupId) throw new Error(`Missing popup id for ${option.label}`)
  if (typeof sdk?.app?.page?.openPopup !== 'function') {
    sdk?.client?.showInfo?.(
      `Kissflow forms are not available outside Kissflow. ${option.label} create needs a Kissflow login — you can still view items by email.`,
    )
    return { popupId: null, localOnly: true }
  }

  const params = {
    width: 960,
    height: 720,
    popupWidth: '960px',
    popupHeight: '720px',
  }

  // Do not await openPopup — Kissflow often never resolves on close, which stuck the FAB spinner.
  const p = sdk.app.page.openPopup(popupId, params)
  if (p && typeof p.catch === 'function') {
    p.catch((err) => console.warn('Satellite openPopup failed:', err))
  }
  return { popupId }
}
