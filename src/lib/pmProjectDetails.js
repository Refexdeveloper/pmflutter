export const PM_OPEN_PROJECT_DETAILS = 'pm-open-project-details'
export const PM_PROJECT_DETAILS_SAVED = 'pm-project-details-saved'

/** Open the in-app Project Details form (Create Project). */
export function requestOpenProjectDetails(defaults = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PM_OPEN_PROJECT_DETAILS, { detail: defaults || {} }))
}

export function notifyProjectDetailsSaved(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PM_PROJECT_DETAILS_SAVED, { detail }))
}
