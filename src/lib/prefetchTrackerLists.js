import { fetchEmployeeDashboardProjects } from './kfEmployeeProjectsReport.js'
import { fetchEmployeeSubtasksByScope } from './kfEmployeeSubtasksReport.js'
import { fetchEmployeeTasksByScope } from './kfEmployeeTasksReport.js'

/** Start project, task, and subtask reports together so tabs are warm before they open. */
export function prefetchTrackerLists(kfInstance) {
  const email = String(kfInstance?.user?.Email || kfInstance?.user?.email || '').trim()
  if (!email.includes('@')) return
  const run = (work) => {
    Promise.resolve()
      .then(work)
      .catch(() => {})
  }
  run(() => fetchEmployeeDashboardProjects(kfInstance, { email }))
  run(() => fetchEmployeeTasksByScope(kfInstance, { email, scope: 'assigned' }))
  run(() => fetchEmployeeTasksByScope(kfInstance, { email, scope: 'created' }))
  run(() => fetchEmployeeSubtasksByScope(kfInstance, { email, scope: 'assigned' }))
  run(() => fetchEmployeeSubtasksByScope(kfInstance, { email, scope: 'created' }))
}
