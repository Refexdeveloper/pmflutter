export const PM_OPEN_TASK_DETAILS = 'pm-open-task-details'
export const PM_TASK_DETAILS_SAVED = 'pm-task-details-saved'

/** Open the in-app Task Details form (Create Task). */
export function requestOpenTaskDetails(defaults = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PM_OPEN_TASK_DETAILS, { detail: defaults || {} }))
}

export function notifyTaskDetailsSaved(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PM_TASK_DETAILS_SAVED, { detail }))
}
