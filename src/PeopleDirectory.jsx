import { useState } from 'react'
import { readDirectorySession } from './lib/directorySession.js'
import { labelForPmRole } from './lib/pmRoles.js'

const ASSIGNABLE = [
  { value: 'employee', label: 'Employee' },
  { value: 'pm', label: 'Project Manager' },
]

export default function PeopleDirectory() {
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savingEmail, setSavingEmail] = useState('')

  const search = async (event) => {
    event?.preventDefault?.()
    const needle = query.trim()
    if (needle.length < 2) {
      setError('Type at least 2 characters.')
      setPeople([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/pm/people?q=${encodeURIComponent(needle)}`, {
        headers: { Authorization: `Bearer ${readDirectorySession()}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not load people.')
      setPeople(Array.isArray(data.people) ? data.people : [])
      if (!data.people?.length) setError('No User Master match.')
    } catch (err) {
      setPeople([])
      setError(err?.message || 'Could not load people.')
    } finally {
      setLoading(false)
    }
  }

  const saveRole = async (person, trackerRole) => {
    setSavingEmail(person.email)
    setError('')
    try {
      const res = await fetch('/api/pm/people/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${readDirectorySession()}`,
        },
        body: JSON.stringify({ email: person.email, trackerRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save the role.')
      setPeople((prev) => prev.map((row) => (row.email === person.email ? data.person : row)))
    } catch (err) {
      setError(err?.message || 'Could not save the role.')
    } finally {
      setSavingEmail('')
    }
  }

  return (
    <div className="min-h-full bg-[#edf1ff] p-3 sm:p-4 lg:p-5">
      <div className="mx-auto max-w-[1100px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/40">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <h1 className="text-sm font-semibold text-slate-800 sm:text-base">People</h1>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
            Roles come from the morning User Master sync. Admins can set Employee or Project Manager.
            User Master admins stay Admin.
          </p>
          <form onSubmit={search} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or email"
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1E88E5]"
              data-testid="pm-people-search"
            />
            <button
              type="submit"
              disabled={loading}
              className="h-10 rounded-xl bg-[#1E88E5] px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </form>
          {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Person</th>
                <th className="px-4 py-2 font-semibold">Designation</th>
                <th className="px-4 py-2 font-semibold">User Master</th>
                <th className="px-4 py-2 font-semibold">Tracker role</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const locked = person.directoryRole === 'admin' || person.directoryRole === 'org_admin'
                return (
                  <tr key={person.email} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{person.name}</p>
                      <p className="text-xs text-slate-500">{person.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{person.designation || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{person.directoryRole || 'user'}</td>
                    <td className="px-4 py-3">
                      {locked ? (
                        <span className="text-xs font-semibold text-sky-800">Admin</span>
                      ) : (
                        <select
                          aria-label={`Tracker role for ${person.name}`}
                          value={person.trackerRole === 'pm' ? 'pm' : 'employee'}
                          disabled={savingEmail === person.email}
                          onChange={(event) => saveRole(person, event.target.value)}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800"
                        >
                          {ASSIGNABLE.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      )}
                      {!locked && person.roleOverride ? (
                        <p className="mt-1 text-[10px] text-slate-400">Saved by admin · {labelForPmRole(person.trackerRole)}</p>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
