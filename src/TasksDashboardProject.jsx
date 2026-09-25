import TasksDashboardPage from './TasksDashboardPage.jsx'

/** Kissflow entry — tasks assigned to the logged-in user. */
export default function TasksDashboardProject() {
  return <TasksDashboardPage useLayout={false} scopeToCurrentUser />
}
