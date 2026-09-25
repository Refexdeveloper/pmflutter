/**
 * Maps Kissflow Project / Task / Subtask / CR items into the row shape expected by
 * PmMyItemsProShell (ported from ContractsMyItemsPro / kfContractItemMap).
 */

function stringifyKfValue(val) {
  if (val == null) return ''
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (typeof val === 'object') {
    if (val.Name != null) return String(val.Name)
    if (val._name != null) return String(val._name)
    if (val.Title != null) return String(val.Title)
    if (val.Project_Name != null) return String(val.Project_Name)
    if (val.value != null) return stringifyKfValue(val.value)
    if (val.label != null) return String(val.label)
    if (Array.isArray(val) && val.length) return val.map(stringifyKfValue).filter(Boolean).join(', ')
  }
  return ''
}

function getVal(item, keys, def = '') {
  const sources = [item, item?.Data, item?.data, item?._data, item?._source_data, item?._fields].filter(Boolean)
  for (const src of sources) {
    if (Array.isArray(src)) continue
    for (const k of keys) {
      const v = src?.[k]
      if (v !== undefined && v !== null && v !== '') return v
    }
    const lowerKeys = keys.map((k) => String(k).toLowerCase())
    for (const [k, v] of Object.entries(src || {})) {
      if (v !== undefined && v !== null && v !== '' && lowerKeys.includes(String(k).toLowerCase())) return v
    }
  }
  return def
}

function formatStatusForDisplay(raw) {
  if (raw == null || raw === '') return ''
  const t = String(raw).trim()
  const norm = t.replace(/\s+/g, '')
  const map = {
    InProgress: 'In progress',
    inprogress: 'In progress',
    'In Progress': 'In progress',
    'In progress': 'In progress',
    Draft: 'Draft',
    draft: 'Draft',
    Completed: 'Completed',
    completed: 'Completed',
    Withdrawn: 'Withdrawn',
    withdrawn: 'Withdrawn',
    Rejected: 'Rejected',
    rejected: 'Rejected',
    Active: 'In progress',
    Open: 'Draft',
    Pending: 'Draft',
    Overdue: 'In progress',
  }
  return map[t] || map[norm] || t
}

export function resolveStatusFromItem(item, listUrlSegment) {
  if (!item || typeof item !== 'object') {
    return listUrlSegment
      ? formatStatusForDisplay(listUrlSegment === 'inprogress' ? 'In progress' : listUrlSegment)
      : ''
  }
  let raw =
    item._status ??
    item.Status ??
    item.status ??
    item.Task_Status ??
    item.Approval_Status ??
    item._status_name ??
    item._workflow_status ??
    item.Workflow_status
  if (raw == null || String(raw).trim() === '') {
    const step = item._current_step ?? item.Current_step ?? item.current_step
    if (step != null && typeof step === 'object') {
      raw = step.Name ?? step._name ?? step.Title ?? step.Step_name
    } else if (step != null) {
      raw = step
    }
  }
  if ((raw == null || String(raw).trim() === '') && listUrlSegment) {
    const segMap = {
      draft: 'Draft',
      inprogress: 'In progress',
      completed: 'Completed',
      withdrawn: 'Withdrawn',
      rejected: 'Rejected',
    }
    return segMap[listUrlSegment] || formatStatusForDisplay(listUrlSegment)
  }
  return formatStatusForDisplay(raw)
}

function formatDateUs(raw) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    const s = String(raw).slice(0, 10)
    return s || '—'
  }
  return d.toLocaleDateString('en-US')
}

function formatProgressDisplay(raw) {
  if (raw == null || raw === '') return '—'
  if (typeof raw === 'object' && raw.value != null) return formatProgressDisplay(raw.value)
  const n = Number(String(raw).replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(n)) {
    const s = stringifyKfValue(raw)
    return s || '—'
  }
  if (n <= 1) return `${Math.round(n * 100)}%`
  if (n <= 100) return `${Math.round(n)}%`
  return String(Math.round(n))
}

/** SLA deadline — End_Date / Due / explicit SLA fields. */
export function resolvePmSlaDeadlineRaw(item) {
  if (!item || typeof item !== 'object') return ''
  const keys = [
    'SLA_Deadline',
    'Sla_Deadline',
    'Deadline',
    'Due_Date',
    'DueDate',
    'End_Date',
    'fetch_End_date',
    'Actual_End_Date_1',
    '_sla_deadline',
  ]
  const raw = getVal(item, keys, '')
  if (raw == null || raw === '') return ''
  if (typeof raw === 'number') return raw
  return String(raw)
}

function resolvePersonName(val) {
  if (!val) return ''
  if (typeof val === 'string') return val.trim()
  if (typeof val === 'object') {
    const name = val.Name || val._name || [val.FirstName, val.LastName].filter(Boolean).join(' ')
    return String(name || '').trim()
  }
  return stringifyKfValue(val)
}

function resolveSecondaryLabel(item, keys) {
  const raw = getVal(item, keys, null)
  if (raw == null) return '—'
  if (typeof raw === 'object') {
    return (
      stringifyKfValue(raw.Project_Name) ||
      stringifyKfValue(raw.Name) ||
      stringifyKfValue(raw.Title) ||
      stringifyKfValue(raw) ||
      '—'
    )
  }
  return stringifyKfValue(raw) || '—'
}

/**
 * Map any PM entity item → ContractsMyItemsPro-compatible row.
 * - vendor ← owner/assignee
 * - contractType / contractCategory ← project / priority / department
 * - valueDisplay ← progress % (or priority for CR when configured via columns label)
 */
export function mapPmMyItemsItem(item, entity, listUrlSegment) {
  if (!item || typeof item !== 'object' || !entity) return null
  const keys = entity.fieldKeys || {}
  const id = String(getVal(item, ['_id', '_item_id', 'id', 'Subtaxk_id'], '') || '').trim()
  if (!id && !getVal(item, keys.title || [], '')) return null

  const ctx = Array.isArray(item._current_context) ? item._current_context : []
  const firstCtx = ctx.length > 0 ? ctx[0] : null
  const activityId =
    item._activity_id ??
    item._activityId ??
    item._context_activity_id ??
    item._current_activity_id ??
    item._activity?._id ??
    firstCtx?._context_activity_id ??
    firstCtx?._context_current_step_id ??
    ''
  const activityInstanceId =
    item._activity_instance_id ??
    item._context_activity_instance_id ??
    item._activityInstanceId ??
    item._activity_instance?._id ??
    firstCtx?._context_activity_instance_id ??
    ''
  const normalizedActivityInstanceId = Array.isArray(activityInstanceId)
    ? (activityInstanceId[0] ?? '')
    : activityInstanceId

  const name =
    stringifyKfValue(getVal(item, keys.title || [], '')) || id || '—'
  const ownerRaw = getVal(item, keys.owner || [], null)
  const vendor = resolvePersonName(ownerRaw) || resolvePersonName(item._created_by) || '—'
  const secondary = resolveSecondaryLabel(item, keys.secondary || [])
  const priority = stringifyKfValue(getVal(item, keys.priority || [], '')) || '—'
  const progressRaw = getVal(item, keys.progress || [], null)
  const valueDisplay =
    entity.key === 'changeRequests'
      ? priority
      : formatProgressDisplay(progressRaw ?? item._progress)
  const startRaw = getVal(item, keys.start || [], '')
  const endRaw = getVal(item, keys.end || [], '')
  const endDate = endRaw ? String(endRaw).slice(0, 10) : '—'
  const startDateDisplay = formatDateUs(startRaw)
  const endDateDisplay = formatDateUs(endRaw)
  const status = resolveStatusFromItem(item, listUrlSegment)
  const createdDate = stringifyKfValue(
    getVal(item, ['Created_at', '_created_at', '_modified_at', 'Modified_at'], ''),
  )
  const description = stringifyKfValue(getVal(item, keys.description || [], ''))
  const createdBy =
    item._created_by?.Name ||
    item.Created_by?.Name ||
    resolvePersonName(item._created_by) ||
    vendor

  const delayDays = (() => {
    if (status.toLowerCase().includes('complete')) return 0
    if (!endRaw) return 0
    const end = new Date(endRaw)
    if (Number.isNaN(end.getTime())) return 0
    const diff = Math.ceil((Date.now() - end.getTime()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  })()

  return {
    id: id || String(Math.random()),
    name,
    vendor,
    rawItem: item,
    raw: item,
    valueDisplay: valueDisplay || '—',
    endDate,
    startDateDisplay,
    endDateDisplay,
    contractType: secondary,
    contractRequestDisplay: id,
    contractCategory: priority !== '—' ? priority : secondary,
    contractDescription: description,
    currency: '',
    paymentType: '—',
    contractDocumentsSummary: '—',
    ratingOverall: null,
    ratingTat: null,
    ratingService: null,
    ratingResponse: null,
    ratingPm: null,
    nda: vendor && vendor !== '—' ? 'Yes' : 'No',
    msa: delayDays > 0 ? 'No' : 'Yes',
    sow: priority && /high/i.test(priority) ? 'No' : 'Yes',
    fullName: vendor,
    phoneNumber: '',
    emailId: '',
    address: '',
    message: description || '',
    website: secondary,
    createdDate,
    modifiedAt: stringifyKfValue(getVal(item, ['_modified_at', 'Modified_at'], '')),
    completedAt: stringifyKfValue(getVal(item, ['_completed_at', 'Completed_at'], '')),
    status,
    progress: Number(progressRaw) || 0,
    createdBy,
    currentStep: stringifyKfValue(getVal(item, ['_current_step', 'Current_step'], '')),
    activityId,
    activityInstanceId: normalizedActivityInstanceId,
    slaDeadline: resolvePmSlaDeadlineRaw(item),
    // KPI helpers (admin-style)
    contractTitle: name,
    valueNum: Number(String(valueDisplay).replace(/[^0-9.-]/g, '')) || 0,
    endDateObj: endRaw ? new Date(endRaw) : null,
    createdDateObj: createdDate ? new Date(createdDate) : null,
    businessStatus: status,
    vendorCategory: secondary,
    delayDays,
    priority,
    _entityKey: entity.key,
  }
}

/** Admin/KPI mapper alias — same as mapPmMyItemsItem without segment. */
export function mapKfPmAdminItem(item, entity) {
  return mapPmMyItemsItem(item, entity, undefined)
}

export function pmStatusPillClass(status) {
  const s = String(status || '').toLowerCase().replace(/\s+/g, '')
  if (s.includes('complete')) return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  if (s.includes('reject') || s.includes('withdraw')) return 'bg-rose-100 text-rose-700 border border-rose-200'
  if (s.includes('progress') || s.includes('active') || s.includes('open')) {
    return 'bg-sky-100 text-sky-700 border border-sky-200'
  }
  if (s.includes('draft')) return 'bg-slate-100 text-slate-700 border border-slate-200'
  return 'bg-slate-100 text-slate-700 border border-slate-200'
}
