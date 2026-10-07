import { useEffect, useRef, useState } from 'react'
import {
  completePmProcessItem,
  createPmProcessDraft,
  finalizePmProcessCreate,
  isProcessCompleteStatus,
  loadPmProcessItem,
  processItemComments,
  processItemText,
  savePmProcessItem,
} from '../lib/kfPmMyItemsCreate.js'
import { pauseKissflowReads } from '../lib/kfRuntime.js'
import {
  assigneeApiFields,
  externalPersonText,
  requesterFields,
  resolveKissflowUserField,
  resolvePersonFromPicker,
} from '../lib/kfUserField.js'
import { mergeDropdownValue, useTaskFormDropdowns } from '../lib/kfTaskFormDropdowns.js'
import { TASKS_ENTITY } from '../lib/pmMyItemsEntities.js'
import { notifyTaskDetailsSaved } from '../lib/pmTaskDetails.js'
import { useUserMasterOptions } from '../lib/useUserMasterOptions.js'
import CreateDetailsPopup from './CreateDetailsPopup.jsx'
import AssigneeStatusTags from './AssigneeStatusTags.jsx'

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

export default function TaskDetailsForm({ kf, defaults = {}, onClose }) {
  const user = kf?.user
  const isUpdate = String(defaults.mode || '').toLowerCase() === 'update' || Boolean(defaults.instanceId)
  const [taskName, setTaskName] = useState(() => String(defaults.taskName || '').trim())
  const [priority, setPriority] = useState(() => String(defaults.priority || '').trim())
  const [project] = useState(defaults.projectName || 'Individual Task')
  const [taskType, setTaskType] = useState(() => String(defaults.taskType || 'New').trim() || 'New')
  const [entity, setEntity] = useState(() => String(defaults.entity || '').trim())
  const [dependent, setDependent] = useState(() => Boolean(defaults.dependent))
  const [dependentOn, setDependentOn] = useState(() => String(defaults.dependentOn || '').trim())
  const [functions, setFunctions] = useState(() => String(defaults.functions || '').trim())
  const [startDate, setStartDate] = useState(() => String(defaults.startDate || '').trim())
  const [endDate, setEndDate] = useState(() => String(defaults.endDate || '').trim())
  const [assignedTo, setAssignedTo] = useState(() => String(defaults.assignedTo || '').trim())
  const [secondary, setSecondary] = useState('')
  const [status, setStatus] = useState(() => String(defaults.status || 'Open').trim() || 'Open')
  const [detail, setDetail] = useState(() => String(defaults.detail || '').trim())
  const [comments, setComments] = useState(() => String(defaults.comments || '').trim())
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submittingRef = useRef(false)

  const { options: assigneeOptions } = useUserMasterOptions(user)
  const dropdowns = useTaskFormDropdowns(kf, {
    instanceId: defaults.instanceId,
    activityId: defaults.activityId,
  })
  const priorities = mergeDropdownValue(dropdowns.Task_Priority, priority)
  const taskTypes = mergeDropdownValue(dropdowns.Task_type, taskType)
  const entities = mergeDropdownValue(dropdowns.Entity, entity)
  const functionOptions = mergeDropdownValue(dropdowns.Functions, functions)
  const statuses = mergeDropdownValue(dropdowns.Task_Status, status)

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
    loadPmProcessItem(kf, TASKS_ENTITY, {
      instanceId: defaults.instanceId,
      accountId: defaults.accountId,
    })
      .then((item) => {
        if (cancelled || !item) return
        const type = processItemText(item, 'Task_type', 'Task_Type')
        const entityValue = processItemText(item, 'Entity')
        const functionsValue = processItemText(item, 'Functions', 'Function_Type')
        const detailValue = processItemText(item, 'Task_Detail')
        const commentsValue = processItemComments(item)
        if (type) setTaskType((prev) => prev || type)
        if (entityValue) setEntity((prev) => prev || entityValue)
        if (functionsValue) setFunctions((prev) => prev || functionsValue)
        if (detailValue) setDetail((prev) => prev || detailValue)
        if (commentsValue) setComments((prev) => prev || commentsValue)
        if (item.Is_Dependent_on_another_Task != null) {
          setDependent(Boolean(item.Is_Dependent_on_another_Task))
        }
        const dependentValue = processItemText(item, 'Dependent_On')
        if (dependentValue) setDependentOn((prev) => prev || dependentValue)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isUpdate, kf, defaults.instanceId, defaults.accountId])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submittingRef.current || busy) return
    if (!taskName.trim()) {
      setError('Task Name is required.')
      return
    }
    if (!priority) {
      setError('Task Priority is required.')
      return
    }
    if (!startDate || !endDate) {
      setError('Start Date and End Date are required.')
      return
    }
    if (!assignedTo.trim()) {
      setError('Assigned To is required.')
      return
    }
    if (isProcessCompleteStatus(status) && !comments.trim()) {
      setError('Comments are required when Task Status is Completed.')
      return
    }
    submittingRef.current = true
    setError('')
    setBusy(true)
    try {
      const assigneePerson = resolvePersonFromPicker(assignedTo, assigneeOptions)
      if (!String(assigneePerson?.Email || assigneePerson?.email || '').trim()) {
        setError('Assigned To needs an email.')
        return
      }
      const loginEmail = String(user?.Email || user?.email || '').trim()
      if (!loginEmail) {
        setError('Requester email is missing. Sign in again.')
        return
      }
      const kissflowAssignee = await resolveKissflowUserField(kf, assigneePerson)
      const secondarySource = secondary
        ? resolvePersonFromPicker(secondary, assigneeOptions)
        : null
      const secondaryText = secondarySource ? externalPersonText(secondarySource) : null
      const body = {
        ...(isUpdate && defaults.instanceId ? { _id: defaults.instanceId } : {}),
        Sub_Task_Name: taskName.trim(),
        Task_Priority: priority,
        Project: project || null,
        Project_Name: project || null,
        Task_type: taskType || null,
        Entity: entity || null,
        Functions: functions || null,
        Start_Date: startDate,
        End_Date: endDate,
        Task_Status: status || 'Open',
        Task_Detail: detail || null,
        ...assigneeApiFields('task', assigneePerson),
        Assigned_To: kissflowAssignee || null,
        AssignedTo: kissflowAssignee || null,
        ...requesterFields(user),
        ...(secondaryText?.Name ? { Secondary_Assignee_Name: secondaryText.Name } : {}),
        ...(secondaryText?.Email ? { Secondary_Assignee_Email: secondaryText.Email } : {}),
        Is_Dependent_on_another_Task: Boolean(dependent),
        Dependent_On: dependent && dependentOn.trim() ? dependentOn.trim() : null,
        Comments: comments.trim() || null,
        Supporting_Document_Names: files.length ? files.map((f) => f.name).join(', ') : null,
        ...(defaults.projectId ? { Project_ID_Hidden: defaults.projectId } : {}),
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
        ? isProcessCompleteStatus(status)
          ? await completePmProcessItem(kf, TASKS_ENTITY, body, ids)
          : await savePmProcessItem(kf, TASKS_ENTITY, body, ids)
        : await finalizePmProcessCreate(kf, TASKS_ENTITY, body, await createPmProcessDraft(kf, TASKS_ENTITY, body))
      kf?.client?.showInfo?.(
        created.webhookOnly
          ? 'Task sent to the Kissflow integration.'
          : isUpdate && isProcessCompleteStatus(status) && created.submitted
            ? `Task completed in Kissflow (${created.instanceId}).`
            : isUpdate && isProcessCompleteStatus(status)
              ? 'Task fields saved. Kissflow workflow did not move to Completed.'
              : created.instanceId
                ? isUpdate
                  ? `Task updated (${created.instanceId}).`
                  : `Task draft created (${created.instanceId}).`
                : isUpdate
                  ? 'Task updated.'
                  : 'Task draft created.',
      )
      notifyTaskDetailsSaved(created)
      onClose?.()
    } catch (err) {
      setError(err?.message || (isUpdate ? 'Could not update the task.' : 'Could not create the task.'))
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  return (
    <CreateDetailsPopup
      title={isUpdate ? 'Update Task' : 'Task Details'}
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={busy}
      error={error}
      submitLabel={isUpdate ? 'Update' : 'Submit'}
      busyLabel={isUpdate ? 'Updating…' : 'Waiting for Kissflow…'}
    >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
            <Field label="Task Name" required>
              <input className={inputClass} value={taskName} onChange={(e) => setTaskName(e.target.value)} />
            </Field>
            <Field label="Task Priority" required>
              <SelectWrap>
                <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="" />
                  {priorities.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </SelectWrap>
            </Field>
            <Field label="Project">
              <input className={greyInputClass} value={project} readOnly />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
            <Field label="Task type">
              <SelectWrap>
                <select className={selectClass} value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                  <option value="" />
                  {taskTypes.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </SelectWrap>
            </Field>
            <Field label="Entity">
              <SelectWrap>
                <select className={selectClass} value={entity} onChange={(e) => setEntity(e.target.value)}>
                  <option value="" />
                  {entities.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </SelectWrap>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
            <Field label="Is Dependent on another Task?">
              <div className="flex h-10 overflow-hidden rounded border border-slate-300">
                {['Yes', 'No'].map((label) => {
                  const on = (label === 'Yes') === dependent
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setDependent(label === 'Yes')}
                      className={`flex-1 text-sm font-medium ${
                        on ? 'bg-[#1E62F0] text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </Field>
            <Field label="Dependent On">
              <div className="relative">
                <input
                  className={`${inputClass} pr-9`}
                  value={dependentOn}
                  onChange={(e) => setDependentOn(e.target.value)}
                  disabled={!dependent}
                />
                <i className="ri-search-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
            <Field label="Functions">
              <SelectWrap>
                <select className={selectClass} value={functions} onChange={(e) => setFunctions(e.target.value)}>
                  <option value="" />
                  {functionOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </SelectWrap>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
            <div className="grid grid-cols-2 gap-3">
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
            <Field label="Assigned To" required>
              <input
                className={inputClass}
                list="pm-task-assignee"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="Name or email"
                autoComplete="off"
              />
              <datalist id="pm-task-assignee">
                {assigneeOptions.map((o) => (
                  <option key={o.value} value={o.label} />
                ))}
              </datalist>
              <AssigneeStatusTags
                kf={kf}
                value={assignedTo}
                options={assigneeOptions}
                loginUser={user}
                payloadField="Assigned_To"
              />
            </Field>
            <Field label="Secondary Assignee">
              <input
                className={inputClass}
                list="pm-task-secondary"
                value={secondary}
                onChange={(e) => setSecondary(e.target.value)}
                placeholder="Name or email"
                autoComplete="off"
              />
              <datalist id="pm-task-secondary">
                {assigneeOptions.map((o) => (
                  <option key={`s-${o.value}`} value={o.label} />
                ))}
              </datalist>
              <AssigneeStatusTags
                kf={kf}
                value={secondary}
                options={assigneeOptions}
                loginUser={user}
                payloadField="Secondary_Assignee"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
            <Field label="Task Detail" className="md:col-span-2">
              <div className="overflow-hidden rounded border border-slate-300 bg-white">
                <textarea
                  rows={8}
                  className="w-full resize-y px-3 py-2 text-sm text-slate-800 outline-none"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                />
                <div className="flex items-center gap-4 border-t border-slate-200 px-3 py-1.5 text-slate-500">
                  <button type="button" className="font-serif text-sm font-bold" tabIndex={-1}>B</button>
                  <button type="button" className="font-serif text-sm italic" tabIndex={-1}>I</button>
                  <span className="text-xs">x₁</span>
                  <span className="text-xs">x¹</span>
                  <i className="ri-link" />
                  <i className="ri-format-clear" />
                </div>
              </div>
            </Field>
            <div className="space-y-4">
              <Field label="Supporting Document">
                <label className="flex min-h-[132px] cursor-pointer flex-col items-start gap-1 rounded border border-dashed border-sky-300 bg-[#f7fbff] px-3 py-3 text-sm">
                  <span className="font-medium text-[#1E88E5]">@ Upload files</span>
                  <span className="text-xs text-slate-500">Drag and drop files or paste from clipboard</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                  {files.length ? (
                    <span className="mt-2 text-xs text-slate-600">{files.map((f) => f.name).join(', ')}</span>
                  ) : null}
                </label>
              </Field>
              <Field label="Task Status">
                <div className="relative">
                  <select
                    className={`${selectClass} ${status ? 'pr-14' : ''}`}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="" />
                    {statuses.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  {status ? (
                    <button
                      type="button"
                      onClick={() => setStatus('')}
                      className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label="Clear status"
                    >
                      <i className="ri-close-line text-lg" />
                    </button>
                  ) : null}
                  <i className="ri-arrow-down-s-line pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-lg text-slate-400" />
                </div>
              </Field>
              {isProcessCompleteStatus(status) ? (
                <Field label="Comments" required>
                  <textarea
                    rows={4}
                    className="w-full resize-y rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#1E62F0]"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Required to complete this task in Kissflow"
                  />
                </Field>
              ) : null}
            </div>
          </div>
        </div>
    </CreateDetailsPopup>
  )
}
