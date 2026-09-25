export const PM_OPEN_SUBTASK_DETAILS = 'pm-open-subtask-details'
export const PM_SUBTASK_DETAILS_SAVED = 'pm-subtask-details-saved'

/** Open the in-app Sub-Task form (Create Sub Task). */
export function requestOpenSubtaskDetails(defaults = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PM_OPEN_SUBTASK_DETAILS, { detail: defaults || {} }))
}

export function notifySubtaskDetailsSaved(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PM_SUBTASK_DETAILS_SAVED, { detail }))
}
