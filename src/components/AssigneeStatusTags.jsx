import { useEffect, useState } from 'react'
import {
  resolveKissflowDirectoryStatus,
  resolvePersonFromPicker,
  toKissflowUserField,
} from '../lib/kfUserField.js'

function Tag({ tone = 'slate', children }) {
  const tones = {
    sky: 'bg-sky-50 text-sky-800 ring-sky-200',
    emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    rose: 'bg-rose-50 text-rose-800 ring-rose-200',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ring-1 ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  )
}

export default function AssigneeStatusTags({
  kf,
  value,
  options = [],
  loginUser = null,
  payloadField = 'Assigned_To',
}) {
  const text = String(value || '').trim()
  const person = resolvePersonFromPicker(text, options)
  const email = String(person?.Email || person?.email || '').trim().toLowerCase()
  const loginEmail = String(loginUser?.Email || loginUser?.email || '').trim().toLowerCase()
  const isRequester = Boolean(email && loginEmail && email === loginEmail)
  const [kind, setKind] = useState('idle')

  useEffect(() => {
    let cancelled = false
    const selected = resolvePersonFromPicker(text, options)
    const selectedEmail = String(selected?.Email || selected?.email || '').trim()
    if (!text) {
      setKind('idle')
      return undefined
    }
    if (toKissflowUserField(selected)) {
      setKind('kissflow')
      return undefined
    }
    if (!selectedEmail) {
      setKind('unknown')
      return undefined
    }
    setKind('checking')
    const timer = setTimeout(() => {
      resolveKissflowDirectoryStatus(kf, selected)
        .then((result) => {
          if (!cancelled) setKind(result.status || 'unverified')
        })
        .catch(() => {
          if (!cancelled) setKind('unverified')
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [kf, text, email])

  if (kind === 'idle') return null

  const hint =
    kind === 'kissflow'
      ? `${payloadField} will be sent as a Kissflow User object.`
      : kind === 'external'
        ? `Not in the Kissflow directory. ${payloadField} will be null.`
        : kind === 'unverified'
          ? `Could not verify Kissflow. ${payloadField} stays null until the directory responds.`
          : kind === 'checking'
            ? 'Checking the Kissflow user directory…'
            : 'Pick a person with an email to check Kissflow.'

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {isRequester ? <Tag tone="sky">Requester</Tag> : null}
        {kind === 'checking' ? <Tag>Checking Kissflow…</Tag> : null}
        {kind === 'kissflow' ? <Tag tone="emerald">Kissflow user</Tag> : null}
        {kind === 'external' ? <Tag tone="amber">Not in Kissflow</Tag> : null}
        {kind === 'unverified' ? <Tag tone="rose">Couldn’t verify Kissflow</Tag> : null}
        {kind === 'unknown' ? <Tag>Name only — add an email</Tag> : null}
      </div>
      <p className="text-[11px] leading-snug text-slate-500">{hint}</p>
    </div>
  )
}
