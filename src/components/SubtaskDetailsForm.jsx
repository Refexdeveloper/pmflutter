import { useEffect, useRef, useState } from 'react'
import {
  completePmProcessItem,
  createPmProcessDraft,
  finalizePmProcessCreate,
  isProcessCompleteStatus,
  loadPmProcessItem,
  processItemComments,
  savePmProcessItem,
} from '../lib/kfPmMyItemsCreate.js'
import { pauseKissflowReads } from '../lib/kfRuntime.js'
import { assigneeApiFields, requesterFields, resolveKissflowUserField, resolvePersonFromPicker } from '../lib/kfUserField.js'
import { SUBTASKS_ENTITY } from '../lib/pmMyItemsEntities.js'
import { notifySubtaskDetailsSaved } from '../lib/pmSubtaskDetails.js'
import { useUserMasterOptions } from '../lib/useUserMasterOptions.js'
import CreateDetailsPopup from './CreateDetailsPopup.jsx'
import AssigneeStatusTags from './AssigneeStatusTags.jsx'

const PRIORITIES = ['High', 'Medium', 'Low']

const inputClass =
  'h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#1E62F0]'
const selectClass = `${inputClass} appearance-none pr-8`
const greyInputClass =
  'h-10 w-full rounded border border-slate-300 bg-[#eef0f3] px-3 text-sm text-slate-700 outline-none'

function Field({ label, required, className = '', children }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-[13px] leading-none text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  )
}

function SelectWrap({ children }) {
  return (
    <div className="relative">
      {children}
      <i className="ri-arrow-down-s-line pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-lg text-slate-400" />
    </div>
  )
}

export default function SubtaskDetailsForm({ kf, defaults = {}, onClose }) {
  const user = kf?.user
  const isUpdate = String(defaults.mode || '').toLowerCase() === 'update' || Boolean(defaults.instanceId)
  const [name, setName] = useState(() => String(defaults.name || '').trim())
  const [priority, setPriority] = useState(() => String(defaults.priority || 'Medium').trim() || 'Medium')
  const [assignee, setAssignee] = useState(() => String(defaults.assignee || '').trim())
  const [startDate, setStartDate] = useState(() => String(defaults.startDate || '').trim())
  const [endDate, setEndDate] = useState(() => String(defaults.endDate || '').trim())
  const [dependent, setDependent] = useState(() => Boolean(defaults.dependent))
  const [chooseSubtask, setChooseSubtask] = useState(() => String(defaults.chooseSubtask || '').trim())
  const [summary, setSummary] = useState(() => String(defaults.summary || '').trim())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submittingRef = useRef(false)
  const taskId = String(defaults.taskId || '').trim()
  const [statusLabel, setStatusLabel] = useState(() => String(defaults.status || 'Open').trim() || 'Open')
  const [comments, setComments] = useState(() => String(defaults.comments || '').trim())

  const { options: assigneeOptions } = useUserMasterOptions(user)

  useEffect(() => {
    pauseKissflowReads(120000)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [busy, onClose])

  useEffect(() => {
    if (!isUpdate || !defaults.instanceId) return undefined
    let cancelled = false
    loadPmProcessItem(kf, SUBTASKS_ENTITY, {
      instanceId: defaults.instanceId,
      accountId: defaults.accountId,
    })
      .then((item) => {
        const text = processItemComments(item)
        if (cancelled || !text) return
        setComments((prev) => prev || text)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isUpdate, kf, defaults.instanceId, defaults.accountId])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submittingRef.current || busy) return
    if (!name.trim()) {
      setError('Sub task Name is required.')
      return
    }
    if (!priority) {
      setError('Sub task Priority is required.')
      return
    }
    if (!assignee.trim()) {
      setError('Assignee is required.')
      return
    }
    if (!startDate || !endDate) {
      setError('Start Date and End Date are required.')
      return
    }
    if (isProcessCompleteStatus(statusLabel) && !comments.trim()) {
      setError('Comments are required when Status is Completed.')
      return
    }
    submittingRef.current = true
    setError('')
    setBusy(true)
    try {
      const assigneePerson = resolvePersonFromPicker(assignee, assigneeOptions)
      const kissflowAssignee = await resolveKissflowUserField(kf, assigneePerson)
      const body = {
        Sub_task_Name: name.trim(),
        Sub_task_Priority: priority || undefined,
        ...assigneeApiFields('subtask', assigneePerson),
        ...requesterFields(user),
        Assignee_1: kissflowAssignee || null,
        Start_Date: startDate,
        End_Date: endDate,
        TStatus: statusLabel || 'Open',
        SubTask_Summary: summary || undefined,
        Comments: comments.trim() || undefined,
        Dependent_ON: Boolean(dependent),
        ...(dependent && chooseSubtask.trim() ? { Choose_Subtask: chooseSubtask.trim() } : {}),
        ...(taskId ? { Task_ID_Hidden: taskId } : {}),
      }
      const ids = {
        instanceId: defaults.instanceId,
        activityId: defaults.activityId,
        activityInstanceId: defaults.activityId,
        accountId: defaults.accountId,
        _id: defaults.instanceId,
        comment: comments.trim(),
      }
      const created = isUpdate
        ? isProcessCompleteStatus(statusLabel)
          ? await completePmProcessItem(kf, SUBTASKS_ENTITY, body, ids)
          : await savePmProcessItem(kf, SUBTASKS_ENTITY, body, ids)
        : await finalizePmProcessCreate(
            kf,
            SUBTASKS_ENTITY,
            body,
            await createPmProcessDraft(kf, SUBTASKS_ENTITY, body),
          )
      kf?.client?.showInfo?.(
        created.webhookOnly
          ? 'Subtask sent to the Kissflow integration.'
          : created.instanceId
            ? isUpdate
              ? `Subtask updated (${created.instanceId}).`
              : `Subtask draft created (${created.instanceId}).`
            : isUpdate
              ? 'Subtask updated.'
              : 'Subtask draft created.',
      )
      notifySubtaskDetailsSaved(created)
      onClose?.()
    } catch (err) {
      setError(err?.message || (isUpdate ? 'Could not update the subtask.' : 'Could not create the subtask.'))
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  return (
    <CreateDetailsPopup
      title={isUpdate ? 'Update Sub-Task' : 'Sub-Task'}
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={busy}
      error={error}
      submitLabel={isUpdate ? 'Update' : 'Submit'}
      busyLabel={isUpdate ? 'Updating…' : 'Waiting for Kissflow…'}
    >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
            <Field label="Sub task Name" required>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Sub task Priority" required>
              <SelectWrap>
                <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </SelectWrap>
            </Field>
            <Field label="Assignee" required>
              <input
                className={inputClass}
                list="pm-subtask-assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Name or email"
                autoComplete="off"
              />
              <datalist id="pm-subtask-assignee">
                {assigneeOptions.map((o) => (
                  <option key={o.value} value={o.label} />
                ))}
              </datalist>
              <AssigneeStatusTags
                kf={kf}
                value={assignee}
                options={assigneeOptions}
                loginUser={user}
                payloadField="Assignee_1"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
            <Field label="Start Date" required>
              <div className="relative">
                <input
                  type="date"
                  className={`${inputClass} pr-9`}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <i className="ri-calendar-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </Field>
            <Field label="End Date" required>
              <div className="relative">
                <input
                  type="date"
                  className={`${inputClass} pr-9`}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <i className="ri-calendar-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
            <Field label="Dependent ON">
              <div className="flex h-10 overflow-hidden rounded border border-slate-300">
                {['Yes', 'No'].map((label) => {
                  const on = (label === 'Yes') === dependent
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setDependent(label === 'Yes')}
                      className={`flex-1 text-sm font-medium ${
                        on ? 'bg-[#1E62F0] text-white' : 'bg-[#f1f3f6] text-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </Field>
            <Field label="Choose Subtask">
              <div className="relative">
                <input
                  className={`${inputClass} pr-9`}
                  value={chooseSubtask}
                  onChange={(e) => setChooseSubtask(e.target.value)}
                  disabled={!dependent}
                />
                <i className="ri-search-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
            <Field label="Sub-Task Summary" className="md:col-span-2">
              <div className="overflow-hidden rounded border border-slate-300 bg-white">
                <textarea
                  rows={7}
                  className="w-full resize-y px-3 py-2 text-sm text-slate-800 outline-none"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
                <div className="flex items-center justify-end gap-4 border-t border-slate-200 px-3 py-1.5 text-slate-500">
                  <button type="button" className="font-serif text-sm font-bold" tabIndex={-1}>B</button>
                  <button type="button" className="font-serif text-sm italic" tabIndex={-1}>I</button>
                  <span className="text-xs">x₂</span>
                  <span className="text-xs">x²</span>
                  <i className="ri-link" />
                  <i className="ri-format-clear" />
                </div>
              </div>
            </Field>
            <Field label="Status">
              <SelectWrap>
                <select className={selectClass} value={statusLabel} onChange={(e) => setStatusLabel(e.target.value)}>
                  {(statusLabel && !['Open', 'Completed'].includes(statusLabel)
                    ? ['Open', 'Completed', statusLabel]
                    : ['Open', 'Completed']
                  ).map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </SelectWrap>
            </Field>
            {isProcessCompleteStatus(statusLabel) ? (
              <Field label="Comments" required className="md:col-span-2">
                <textarea
                  rows={3}
                  className="w-full resize-y rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#1E62F0]"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Required to complete this subtask in Kissflow"
                />
              </Field>
            ) : null}
          </div>

          <Field label="Task ID">
            <input className={greyInputClass} value={taskId} readOnly />
          </Field>
        </div>
    </CreateDetailsPopup>
  )
}
