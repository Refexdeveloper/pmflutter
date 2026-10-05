import { useContext, useEffect, useMemo, useState } from 'react'
import { KissflowSDKContext } from './sdk/context.jsx'
import { KF_PM_TRACKER_APP_NAME } from './lib/kfPmApp.js'
import { resolvePmRoleKey } from './lib/pmRoles.js'
import UserHubProjectsPage from './UserHubProjectsPage.jsx'
import UserHubTasksPage from './UserHubTasksPage.jsx'
import UserHubSubTasksPage from './UserHubSubTasksPage.jsx'
import UserSpecificPT from './UserSpecificPT.jsx'
import AdminTasks from './AdminTasks.jsx'

const EMPLOYEE_PAGES = [
  { id: 'projects', label: 'Projects' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'subtasks', label: 'SubTasks' },
]

function TrackerTitle() {
  return (
    <div className="flex min-w-0 items-center gap-1.5 px-4 py-2.5 sm:px-5">
      <h1 className="truncate text-[15px] font-semibold text-slate-800">
        {KF_PM_TRACKER_APP_NAME}
      </h1>
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400">
        <i className="ri-information-line text-sm" aria-hidden />
      </span>
    </div>
  )
}

function tabClass(active) {
  return `border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? 'border-sky-600 text-sky-700'
      : 'border-transparent text-slate-500 hover:text-slate-800'
  }`
}

function PmHeader({ page, setPage }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <TrackerTitle />
      <nav className="flex items-center gap-1 overflow-x-auto px-3 sm:px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="pm-tracker-nav">
        <button type="button" onClick={() => setPage('home')} className={`${tabClass(page === 'home')} shrink-0`} data-testid="pm-tab-home">
          Home
        </button>
        <button type="button" onClick={() => setPage('admin')} className={`${tabClass(page === 'admin')} shrink-0`} data-testid="pm-tab-admin">
          Admin Tasks
        </button>
      </nav>
    </header>
  )
}

function TrackerHeader({ page, setPage }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <TrackerTitle />
      <nav className="flex items-center gap-1 overflow-x-auto px-3 sm:px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="pm-tracker-nav">
        {EMPLOYEE_PAGES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPage(item.id)}
            className={`${tabClass(page === item.id)} shrink-0`}
            data-testid={`pm-tab-${item.id}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  )
}

export default function PmTrackerChrome({ children }) {
  const { kf, sdkFailed, identityReady } = useContext(KissflowSDKContext)
  const [employeePage, setEmployeePage] = useState('projects')
  const [visitedEmployeePages, setVisitedEmployeePages] = useState({ projects: true })
  const [pmPage, setPmPage] = useState('home')

  useEffect(() => {
    setVisitedEmployeePages((prev) => (
      prev[employeePage] ? prev : { ...prev, [employeePage]: true }
    ))
  }, [employeePage])

  const role = useMemo(() => resolvePmRoleKey(kf?.user, 'employee'), [kf?.user])
  const isPm = role === 'pm'

  if (!sdkFailed) return children
  if (!identityReady) return children

  if (isPm) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f4f6fb] text-slate-800">
        <PmHeader page={pmPage} setPage={setPmPage} />
        <div className="min-w-0 flex-1">
          {pmPage === 'admin' ? <AdminTasks /> : <UserSpecificPT useLayout={false} />}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6fb] text-slate-800">
      <TrackerHeader page={employeePage} setPage={setEmployeePage} />
      <div className="min-w-0 flex-1">
        {visitedEmployeePages.projects ? (
          <div className={employeePage === 'projects' ? 'min-w-0' : 'hidden'}>
            <UserHubProjectsPage useLayout={false} isActive={employeePage === 'projects'} />
          </div>
        ) : null}
        {visitedEmployeePages.tasks ? (
          <div className={employeePage === 'tasks' ? 'min-w-0' : 'hidden'}>
            <UserHubTasksPage useLayout={false} isActive={employeePage === 'tasks'} />
          </div>
        ) : null}
        {visitedEmployeePages.subtasks ? (
          <div className={employeePage === 'subtasks' ? 'min-w-0' : 'hidden'}>
            <UserHubSubTasksPage useLayout={false} isActive={employeePage === 'subtasks'} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
