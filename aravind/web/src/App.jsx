import { useCallback, useEffect, useState } from 'react'
import ProjectDashboardPage from '../../../src/ProjectDashboardPage.jsx'

async function loadDashboard() {
  const res = await fetch('/api/dashboard')
  if (!res.ok) throw new Error(`Dashboard API ${res.status}`)
  return res.json()
}

export default function App() {
  const [bundle, setBundle] = useState(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setError('')
      setBundle(await loadDashboard())
    } catch (err) {
      setError(err.message || 'Failed to load dashboard')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf1ff] p-6 text-sm text-rose-700">
        {error}. Start the API with <code className="mx-1 rounded bg-white px-1.5 py-0.5">npm run dev:api</code>
        in the aravind folder.
      </div>
    )
  }

  if (!bundle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf1ff] text-sm text-slate-500">
        <i className="ri-loader-4-line mr-2 animate-spin" aria-hidden />
        Loading Project Management Tracker…
      </div>
    )
  }

  const me = bundle.me || {}

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff]">
      <ProjectDashboardPage
        useLayout={false}
        hideUserScopeToggle
        standaloneData={{
          projects: bundle.projects || [],
          tasks: bundle.tasks || [],
          subtasks: bundle.subtasks || [],
          userName: me.name || 'Aravind Srinivasan',
          roleName: me.role || 'Employee',
        }}
        scopeUser={{
          _id: me.id,
          Name: me.name,
          FirstName: me.firstName,
          Email: me.email,
          Role: { Name: me.role || 'Employee' },
        }}
      />
    </div>
  )
}
