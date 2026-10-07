import { useEffect, useMemo, useState } from 'react'
import { persistDirectorySession } from '../lib/directorySession.js'
import { KF_PM_TRACKER_APP_NAME } from '../lib/kfPmApp.js'
import { labelForPmRole } from '../lib/pmRoles.js'
import { trackerRoleFromDirectory } from '../lib/trackerRole.js'
import {
  fetchUserMasterUsers,
  filterUserMasterUsers,
  isUserMasterConfigured,
  lookupUserMasterByEmail,
  mapUserMasterPerson,
  userMasterOptionLabel,
} from '../lib/userMaster.js'
import PtUserAvatar from './PtUserAvatar.jsx'

function departmentOf(person) {
  return String(
    person?.department ||
      person?.Department ||
      person?.business_unit ||
      person?.company ||
      '',
  ).trim()
}

function roleOf(person) {
  return (
    person?.trackerRole ||
    trackerRoleFromDirectory({
      role: person?.directoryRole,
      designation: person?.designation || person?.Role,
    })
  )
}

function selectPerson(person, setQuery, setSelected, setPmRole) {
  if (!person) return
  const mapped = person.Name ? person : mapUserMasterPerson(person)
  setSelected(mapped)
  setQuery(userMasterOptionLabel(mapped))
  setPmRole(roleOf(mapped))
}

export default function NonKissflowIdentityGate({ onContinue, error }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [pmRole, setPmRole] = useState('employee')
  const [users, setUsers] = useState([])
  const [loadingDirectory, setLoadingDirectory] = useState(true)
  const [directoryError, setDirectoryError] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  const [openList, setOpenList] = useState(false)
  const [apiReady, setApiReady] = useState(false)

  const loadDirectory = async () => {
    setLoadingDirectory(true)
    setDirectoryError('')
    try {
      if (!isUserMasterConfigured()) {
        throw new Error('User Master is not configured on the server.')
      }
      const rows = await fetchUserMasterUsers({ force: true })
      setUsers(Array.isArray(rows) ? rows : [])
      if (!rows?.length) {
        setDirectoryError('User Master returned no people.')
      }
    } catch (err) {
      setUsers([])
      setDirectoryError(err?.message || 'Could not load User Master.')
    } finally {
      setLoadingDirectory(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/pm/health')
        if (!res.ok) throw new Error('Directory API is not ready')
        if (!cancelled) {
          setApiReady(true)
          setLoadingDirectory(false)
        }
      } catch {
        if (!cancelled) loadDirectory()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!apiReady || selected) return undefined
    const needle = query.trim()
    if (needle.length < 2) {
      setUsers([])
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pm/search?q=${encodeURIComponent(needle)}&limit=8`)
        const data = await res.json()
        if (cancelled) return
        setUsers((Array.isArray(data.people) ? data.people : []).map((person) => mapUserMasterPerson({
          ...person,
          full_name: person.name,
          email: person.email,
          role: person.directoryRole,
          designation: person.designation,
          trackerRole: person.trackerRole,
        })))
        setDirectoryError('')
      } catch (err) {
        if (!cancelled) setDirectoryError(err?.message || 'Could not search User Master.')
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [apiReady, query, selected])

  const matches = useMemo(
    () => (apiReady ? users : filterUserMasterUsers(users, query, 10)),
    [apiReady, users, query],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLocalError('')

    let person = selected
    if (!person) {
      const typed = query.trim()
      if (!typed) {
        setLocalError('Search User Master and pick your name.')
        setOpenList(true)
        return
      }
      person =
        matches.length === 1
          ? matches[0]
          : (await lookupUserMasterByEmail(typed)) ||
            users.find(
              (row) =>
                String(row.Email || '').toLowerCase() === typed.toLowerCase() ||
                String(row.Name || '').toLowerCase() === typed.toLowerCase(),
            )
    }

    if (!person?.Email) {
      setLocalError('Choose a person from User Master to sign in.')
      setOpenList(true)
      return
    }

    let assignedRole = roleOf(person)
    setPmRole(assignedRole)
    setBusy(true)
    try {
      const loginRes = await fetch('/api/pm/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: String(person.Email).trim().toLowerCase() }),
      })
      if (loginRes.ok) {
        const loginBody = await loginRes.json()
        persistDirectorySession(loginBody.token)
        if (loginBody.person?.trackerRole) assignedRole = loginBody.person.trackerRole
      } else {
        persistDirectorySession('')
      }
      await onContinue({
        email: String(person.Email).trim().toLowerCase(),
        name: person.Name || person.Email,
        pmRole: assignedRole,
        title: labelForPmRole(assignedRole),
        source: 'user-master',
        kissflowUserId: String(person.kissflow_user_id || person.kissflowUserId || '').trim(),
      })
    } catch (err) {
      setLocalError(err?.message || 'Could not sign in.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff]">
      <div className="mx-auto flex min-h-full max-w-5xl items-center px-4 py-10 sm:px-6">
        <div className="grid w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/50 lg:grid-cols-[1.05fr_1.2fr]">
          <aside className="relative hidden bg-[#0f2747] px-8 py-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">
                Refex One
              </p>
              <h1 className="mt-3 text-2xl font-semibold leading-tight">{KF_PM_TRACKER_APP_NAME}</h1>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-sky-100/80">
                Sign in with your work email. Employee, Project Manager, and Admin come from User Master.
              </p>
            </div>
            <ul className="space-y-3 text-sm text-sky-100/85">
              <li className="flex items-start gap-2">
                <i className="ri-user-search-line mt-0.5 text-sky-300" aria-hidden />
                Search by name or work email
              </li>
              <li className="flex items-start gap-2">
                <i className="ri-shield-user-line mt-0.5 text-sky-300" aria-hidden />
                Only people in User Master can enter
              </li>
              <li className="flex items-start gap-2">
                <i className="ri-layout-grid-line mt-0.5 text-sky-300" aria-hidden />
                Role is assigned from User Master
              </li>
            </ul>
          </aside>

          <div className="px-5 py-8 sm:px-8 sm:py-10">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1E88E5] text-white">
                <i className="ri-folder-chart-line text-xl" aria-hidden />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">
                  Refex One
                </p>
                <h1 className="text-lg font-semibold text-slate-900">{KF_PM_TRACKER_APP_NAME}</h1>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use your Refex One work email. Your role is taken from User Master.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5" data-testid="pm-non-kf-identity-form">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  User Master
                </label>
                <div className="relative">
                  <i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    autoFocus
                    autoComplete="off"
                    value={query}
                    disabled={loadingDirectory || busy}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setSelected(null)
                      setOpenList(true)
                    }}
                    onFocus={() => setOpenList(true)}
                    placeholder={loadingDirectory ? 'Loading directory…' : 'Search name or email'}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#1E88E5] focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
                    data-testid="pm-non-kf-email"
                  />
                </div>

                {openList && !loadingDirectory && !selected ? (
                  <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white py-1">
                    {matches.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-slate-500">No User Master match.</p>
                    ) : (
                      matches.map((person) => {
                        const email = String(person.Email || '').toLowerCase()
                        return (
                          <button
                            key={email || person._id || person.Name}
                            type="button"
                            data-testid={`pm-login-user-${email}`}
                            onClick={() => {
                              selectPerson(person, setQuery, setSelected, setPmRole)
                              setOpenList(false)
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                          >
                            <PtUserAvatar name={person.Name} sizeClass="h-8 w-8" textClass="text-[11px]" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-800">
                                {person.Name}
                              </span>
                              <span className="block truncate text-[11px] text-slate-500">
                                {person.Email}
                                {person.Role ? ` · ${person.Role}` : ''}
                              </span>
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                ) : null}
              </div>

              {selected ? (
                <div
                  className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-3"
                  data-testid="pm-login-selected"
                >
                  <PtUserAvatar name={selected.Name} sizeClass="h-10 w-10" textClass="text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{selected.Name}</p>
                    <p className="truncate text-xs text-slate-500">{selected.Email}</p>
                    <p className="truncate text-[11px] text-slate-400">
                      {[selected.Role, departmentOf(selected)].filter(Boolean).join(' · ') || 'User Master'}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-sky-800" data-testid="pm-login-role">
                      {labelForPmRole(pmRole || roleOf(selected))}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-sky-700 hover:underline"
                    onClick={() => {
                      setSelected(null)
                      setQuery('')
                      setOpenList(true)
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : null}

              {(localError || error || directoryError) && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {localError || error || directoryError}
                </p>
              )}

              {directoryError ? (
                <button
                  type="button"
                  onClick={loadDirectory}
                  className="text-sm font-semibold text-sky-700 hover:underline"
                >
                  Retry User Master
                </button>
              ) : null}

              <button
                type="submit"
                disabled={busy || loadingDirectory}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1E88E5] px-4 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="pm-non-kf-continue"
              >
                {busy || loadingDirectory ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" aria-hidden />
                    {loadingDirectory ? 'Loading User Master…' : 'Signing in…'}
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
