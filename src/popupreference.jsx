import React, { useState, useMemo, useEffect, useLayoutEffect, useContext, useRef } from 'react'
import { createPortal } from 'react-dom'
import { kf, KissflowSDKContext } from './sdk/index.js'
import KPICards from './KPICards.jsx'
import { getApiBase } from './apiBase.js'
import { buildLeadProcessApiPaths, buildLeadAdminApiPaths, resolveKfApplicationId } from './kfLeadPaths.js'
import AOS from 'aos'
import { useMediaQuery } from './hooks/useMediaQuery.js'
import MobileLeadCards from './MobileLeadCards.jsx'
import MobileTaskCards from './MobileTaskCards.jsx'

const STATUS_TO_SEGMENT = {
  'Draft': 'draft',
  'In progress': 'inprogress',
  'Completed': 'completed',  // lowercase: myitems/completed
  'Withdrawn': 'withdrawn',
  'Rejected': 'rejected',
}

/** URL segment → label shown when API omits per-row status (matches myitems/{segment} request) */
const SEGMENT_TO_STATUS_LABEL = {
  draft: 'Draft',
  inprogress: 'In progress',
  completed: 'Completed',
  withdrawn: 'Withdrawn',
  rejected: 'Rejected',
}

function stringifyKfFieldValue(val) {
  if (val == null) return ''
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (typeof val === 'object') {
    if (val.Name != null) return String(val.Name)
    if (val._name != null) return String(val._name)
    if (val.Title != null) return String(val.Title)
    if (val.value != null) return stringifyKfFieldValue(val.value)
    if (val.label != null) return String(val.label)
    if (Array.isArray(val) && val.length) return val.map(stringifyKfFieldValue).filter(Boolean).join(', ')
  }
  return ''
}

function stringifyKfRole(abc) {
  if (!abc) return ''
  if (typeof abc === 'string') return abc.trim()
  if (Array.isArray(abc)) {
    for (const x of abc) {
      const s = stringifyKfRole(x)
      if (s) return s
    }
    return ''
  }
  if (typeof abc === 'object') {
    const n = abc.Name ?? abc.name ?? abc._name ?? abc.Title ?? abc.title ?? abc.Role ?? abc.role ?? ''
    return String(n || '').trim()
  }
  return ''
}

function getVal(item, keys, def = '') {
  const sources = [item, item?.Data, item?.data].filter(Boolean)
  for (const src of sources) {
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

function extractFullName(item) {
  const direct = stringifyKfFieldValue(getVal(item, ['Untitled_Field', 'Full_Name', 'Customer_Name', 'Name'], ''))
  if (!direct) return ''
  // "LEAD-Refex Renewables-0013 - Umesh Banerjee" -> "Umesh Banerjee"
  const parts = direct.split(' - ')
  if (parts.length >= 2) return String(parts[parts.length - 1] || '').trim()
  return direct
}

/** Website may be Website, lookup object, or internal field name — match Kissflow payload */
function resolveWebsiteFromItem(item) {
  const tryKeys = [
    'Website_and_form',
    'Website',
    'website',
    'Lead_source',
    'Lead_website',
    'Website_URL',
    'Website_url',
    'Source_website',
  ]
  for (const k of tryKeys) {
    const s = stringifyKfFieldValue(item[k])
    if (s) return s
  }
  for (const k of Object.keys(item)) {
    if (k.startsWith('_')) continue
    if (/website|web_?site|lead_?source|form_?url|source_?url/i.test(k)) {
      const s = stringifyKfFieldValue(item[k])
      if (s) return s
    }
  }
  // Fallback: attempt to parse from item.Name patterns like:
  // "LEAD-Refex Group-0004 - Indrajit Chakraborty"
  const name = stringifyKfFieldValue(item.Name || item.Untitled_Field)
  if (name && /^LEAD[-\s]/i.test(name)) {
    // Try patterns:
    // 1) LEAD-<website>-<id> - <fullName>
    // 2) LEAD <website> <id> - <fullName>
    // Capture the segment before the last " - " which usually precedes the full name
    const beforeFullName = name.split(' - ')[0] || name
    // Remove leading "LEAD" and separators
    const cleaned = beforeFullName.replace(/^LEAD[\s-_:]*/i, '')
    // If it still contains an id suffix like "-0004", strip the trailing "-<digits>{2,}" or similar tokens
    const websiteGuess = cleaned.replace(/[-_\s]*\d{2,}$/, '').trim()
    if (websiteGuess) return websiteGuess
  }
  return ''
}

function formatStatusForDisplay(raw) {
  if (raw == null || raw === '') return ''
  const t = String(raw).trim()
  const norm = t.replace(/\s+/g, '')
  const map = {
    InProgress: 'In progress',
    inprogress: 'In progress',
    INPROGRESS: 'In progress',
    Draft: 'Draft',
    draft: 'Draft',
    Completed: 'Completed',
    completed: 'Completed',
    Withdrawn: 'Withdrawn',
    withdrawn: 'Withdrawn',
    Rejected: 'Rejected',
    rejected: 'Rejected',
  }
  return map[t] || map[norm] || t
}

function getStatusBadgeClass(status) {
  const s = String(formatStatusForDisplay(status) || '').toLowerCase()
  if (s.includes('completed')) return 'bg-emerald-100 text-emerald-800 border border-emerald-200/80'
  if (s.includes('in progress')) return 'bg-blue-100 text-blue-800 border border-blue-200/80'
  if (s.includes('rejected')) return 'bg-rose-100 text-rose-800 border border-rose-200/80'
  if (s.includes('withdrawn')) return 'bg-orange-100 text-orange-800 border border-orange-200/80'
  if (s.includes('draft')) return 'bg-slate-100 text-slate-700 border border-slate-200/80'
  return 'bg-violet-100 text-violet-800 border border-violet-200/80'
}

/**
 * Prefer real API fields (_status, _current_step, etc.); if missing, use list URL segment
 * (same record set as myitems/draft | inprogress | …).
 */
function resolveStatusFromItem(item, listUrlSegment) {
  let raw =
    item._status ??
    item.Status ??
    item.status ??
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
  if (raw != null && String(raw).trim() !== '') {
    return formatStatusForDisplay(raw)
  }
  if (listUrlSegment && SEGMENT_TO_STATUS_LABEL[listUrlSegment]) {
    return SEGMENT_TO_STATUS_LABEL[listUrlSegment]
  }
  return 'Draft'
}

function pickFirstId(value) {
  if (Array.isArray(value)) {
    const first = value.find((v) => v != null && String(v).trim() !== '')
    return first != null ? String(first) : ''
  }
  if (value == null) return ''
  return String(value)
}

function mapKfItemToLead(item, listUrlSegment) {
  if (!item || typeof item !== 'object') return null
  const fullName = extractFullName(item)
  const website = resolveWebsiteFromItem(item)
  const id = getVal(item, ['_id', 'Lead_ID', 'id'], '')
  const ctx = Array.isArray(item._current_context) ? item._current_context : []
  const firstCtx = ctx.length > 0 ? ctx[0] : null
  // Activity id (workflow activity)
  const activityId =
    item._activity_id ??
    item._activityId ??
    item._context_activity_id ??
    item._current_activity_id ??
    item._activity?._id ??
    item._activity?.id ??
    firstCtx?._context_activity_id ??
    firstCtx?._context_current_step_id ??
    ''
  // Activity Instance Id (what Kissflow typically calls _activity_instance_id)
  const activityInstanceId =
    item._activity_instance_id ??
    item._context_activity_instance_id ??
    item._activityInstanceId ??
    item._activity_instance?._id ??
    item._activity_instance?.id ??
    item._context_activity_instance?._id ??
    item._context_activity_instance?.id ??
    firstCtx?._context_activity_instance_id ??
    firstCtx?._context_activity_instance ??
    ''
  const name = stringifyKfFieldValue(getVal(item, ['Name', 'Untitled_Field'], '')) || (website && fullName ? `LEAD-${String(website).replace(/\s+/g, '')}-${String(id).slice(-4)} - ${fullName}` : fullName || id || '—')
  const createdBy =
    item._created_by?.Name ||
    item.Created_by?.Name ||
    stringifyKfFieldValue(getVal(item, ['_current_assigned_to', 'AssignedTo', 'assigned_to'], '')) ||
    null

  const currentStep = stringifyKfFieldValue(getVal(item, ['_current_step', 'Current_step', 'current_step'], ''))
  return {
    id,
    name,
    fullName,
    phoneNumber: stringifyKfFieldValue(getVal(item, ['Phone_Number', 'Phone', 'Mobile_Number', 'Contact_Number'], '')),
    emailId: stringifyKfFieldValue(getVal(item, ['Email_Id', 'Email', 'Email_ID'], '')),
    address: stringifyKfFieldValue(getVal(item, ['Address_1', 'Address', 'Company_Name'], '')),
    message: stringifyKfFieldValue(getVal(item, ['Your_Message', 'Message', 'Description'], '')),
    botsSummary: stringifyKfFieldValue(getVal(item, ['Bots_Summary', 'Bot_Summary', 'BotsSummary', 'bots_summary'], '')),
    recordingUrl: stringifyKfFieldValue(getVal(item, ['Recording_URL', 'Recording_Url', 'RecordingURL', 'recording_url'], '')),
    conversationId: stringifyKfFieldValue(getVal(item, ['conversation_id', 'Conversation_ID', 'ConversationId'], '')),
    website,
    createdDate: stringifyKfFieldValue(getVal(item, ['Created_at', '_created_at', '_modified_at', 'Modified_at'], '')),
    modifiedAt: stringifyKfFieldValue(getVal(item, ['_modified_at', 'Modified_at'], '')),
    completedAt: stringifyKfFieldValue(getVal(item, ['_completed_at', 'Completed_at'], '')),
    status: resolveStatusFromItem(item, listUrlSegment),
    progress: Number(getVal(item, ['_progress', 'Progress'], 0)) || 0,
    createdBy,
    currentStep,
    activityId: pickFirstId(activityId),
    activityInstanceId: pickFirstId(activityInstanceId),
  }
}

function InlineAudioPlayer({ url }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)
  const src = String(url || '').trim()
  if (!src) return <span className="text-sm text-slate-500">No recording</span>
  const togglePlay = async () => {
    const el = audioRef.current
    if (!el) return
    try {
      if (playing) {
        el.pause()
        setPlaying(false)
      } else {
        await el.play()
        setPlaying(true)
      }
    } catch {
      setPlaying(false)
    }
  }
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={togglePlay}
        className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
      >
        <i className={`text-base ${playing ? 'ri-pause-circle-line' : 'ri-play-circle-line'}`} />
        {playing ? 'Pause' : 'Play'}
      </button>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        className="h-9 max-w-[260px]"
        controls
      />
    </div>
  )
}

function initialsFromUser(user) {
  if (!user) return 'U'
  const name = user.Name || user.FirstName || ''
  const parts = String(name).trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] || '') + (parts[1][0] || '')
  if (user.FirstName && user.LastName) return (user.FirstName[0] || '') + (user.LastName[0] || '')
  return name.slice(0, 2).toUpperCase() || 'U'
}

function getTimeGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function mapKfTaskToRow(item, fallbackActivityId) {
  const lead = mapKfItemToLead(item, undefined)
  if (!lead) return null
  const createdBy = item._created_by?.Name || lead.createdBy
  const createdByInitials = initialsFromUser(item._created_by)
  const statusDisplay = formatStatusForDisplay(lead.status) || lead.status || 'In progress'
  return {
    ...lead,
    activityId: lead.activityId || fallbackActivityId || '',
    createdBy,
    createdByInitials,
    status: statusDisplay,
  }
}

function buildMyItemsPath(leadPaths, statusFilter, pageNumber, pageSize) {
  const segment = STATUS_TO_SEGMENT[statusFilter] || 'draft'
  const pn = Math.max(1, Number(pageNumber) || 1)
  const ps = Math.max(1, Number(pageSize) || 50)
  return `/process/2/${leadPaths.accountId}/${leadPaths.processId}/myitems/${segment}?apply_preference=true&page_number=${pn}&page_size=${ps}&skip_aggregation=true&_application_id=${encodeURIComponent(leadPaths.applicationId)}`
}

const STATUS_OPTIONS = ['Draft', 'In progress', 'Completed', 'Withdrawn', 'Rejected']
const TASKS_APPLICATION_ID = 'Lead_Trcaker_A00'

/** Same role → website map as LeadDashboardPage (sales managers see one property). */
const ROLE_TO_WEBSITE_KPI = {
  '3isalesmanager': '3iMedtech',
  '3isalesteam': '3iMedtech',
  'salesmanageradonis': 'Adonis',
  'salesmanageranamaya': 'Anamaya',
  'salesmanagerril': 'Refex Industries Limited',
  'salesteamril': 'Refex Industries Limited',
  'salesmanagerrlfc': 'Refex Life Sciences',
  'salesteamrlfc': 'Refex Life Sciences',
  'salesmanagerrril': 'Refex Renewables',
  'salesteamrril': 'Refex Renewables',
  'salesmanagerrefexgroup': 'Refex Group',
  'salesmanagerrefexmobility': 'Refex Mobility',
  'salesmanagersparzan': 'Sparzana',
  'salesmanagersparzana': 'Sparzana',
  'venwindsalesmanager': 'Venwind Refex',
  'venwindsalesteam': 'Venwind Refex',
}

function normalizeTextKpi(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function resolveWebsiteFromOptionsKpi(targetWebsite, websiteOptions) {
  if (!targetWebsite) return null
  const targetNorm = normalizeTextKpi(targetWebsite)
  const exact = websiteOptions.find((opt) => normalizeTextKpi(opt) === targetNorm)
  if (exact) return exact
  const fuzzy = websiteOptions.find((opt) => {
    const norm = normalizeTextKpi(opt)
    return norm && (norm.includes(targetNorm) || targetNorm.includes(norm))
  })
  return fuzzy || targetWebsite
}

function statusNormKpi(lead) {
  return String(lead?.status ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function isClosedSuccessKpi(lead) {
  const s = statusNormKpi(lead)
  return (
    s === 'completed' ||
    s === 'complete' ||
    s === 'closed' ||
    s.includes('completed') ||
    s.includes('closed') ||
    (s.includes('complete') && !s.includes('incomplete'))
  )
}

function isTerminalNegativeKpi(lead) {
  const s = statusNormKpi(lead)
  return s.includes('rejected') || s.includes('withdrawn')
}

function isOpenPipelineKpi(lead) {
  return !isClosedSuccessKpi(lead) && !isTerminalNegativeKpi(lead)
}

function isCreatedTodayKpi(lead) {
  if (!lead?.createdDate) return false
  const d = new Date(lead.createdDate)
  if (isNaN(d.getTime())) return false
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setHours(23, 59, 59, 999)
  return d >= start && d <= end
}

function isCreatedThisWeekKpi(lead) {
  if (!lead?.createdDate) return false
  const d = new Date(lead.createdDate)
  if (isNaN(d.getTime())) return false
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endToday = new Date(startOfToday)
  endToday.setHours(23, 59, 59, 999)
  const sevenDaysAgo = new Date(startOfToday)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return d >= sevenDaysAgo && d <= endToday
}

const DEMO_ITEMS = [
  { id: '1', name: 'LEAD-Anamaya-0502 - t1232', fullName: 't1232', emailId: 'sathishkumar.r@refex.co.in', message: 'cwdwjfhwec', createdDate: '2026-03-17T15:10:00', status: 'Draft' },
  { id: '2', name: 'LEAD-3iMedtech-0501 - asdf', fullName: 'asdf', emailId: 'sathishkumar.r@refex.co.in', message: 'raghul.je@refex.co.in', createdDate: '2026-03-17T14:42:00', status: 'Draft' },
  { id: '3', name: '—', fullName: '', emailId: '', message: '', createdDate: '2026-03-17T14:39:00', status: 'Draft' },
]

const ITEMS_COLUMNS = [
  { id: 'name', label: 'Name' },
  { id: 'createdAt', label: 'Created at' },
  { id: 'fullName', label: 'Full name' },
  { id: 'emailId', label: 'Email Id' },
  { id: 'message', label: 'Your Message' },
]
const TASKS_COLUMNS = [
  { id: 'name', label: 'Name' },
  { id: 'createdAt', label: 'Created at' },
  { id: 'createdBy', label: 'Created by' },
  { id: 'status', label: 'Status' },
  { id: 'fullName', label: 'Full name' },
]

const DEFAULT_VISIBLE_ITEMS = Object.fromEntries(ITEMS_COLUMNS.map((c) => [c.id, true]))
const DEFAULT_VISIBLE_TASKS = Object.fromEntries(TASKS_COLUMNS.map((c) => [c.id, true]))

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function LeadsManagementPage() {
  const { kf: kfFromContext, sdkReady } = useContext(KissflowSDKContext)
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null)
  const leadPaths = useMemo(() => buildLeadProcessApiPaths(kfInstance), [kfInstance])
  const adminPaths = useMemo(() => buildLeadAdminApiPaths(kfInstance), [kfInstance])

  const [activeTab, setActiveTab] = useState('tasks')
  const [statusFilter, setStatusFilter] = useState('Draft')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [roleName, setRoleName] = useState('')
  const [itemsPage, setItemsPage] = useState(1)
  const [tasksPage, setTasksPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [selectedItemIds, setSelectedItemIds] = useState(new Set())
  const [selectedLead, setSelectedLead] = useState(null)
  const [statusCountsFromApi, setStatusCountsFromApi] = useState(null)
  const [pendingActivities, setPendingActivities] = useState(null)
  const [currentActivityId, setCurrentActivityId] = useState(null)
  const [currentStepName, setCurrentStepName] = useState('Review Lead Details')
  const [totalTasksCount, setTotalTasksCount] = useState(0)
  const [tasksFromApi, setTasksFromApi] = useState(null)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [columnsPopoverOpen, setColumnsPopoverOpen] = useState(false)
  const [filterFromDate, setFilterFromDate] = useState('')
  const [filterToDate, setFilterToDate] = useState('')
  const [visibleColumnsItems, setVisibleColumnsItems] = useState(DEFAULT_VISIBLE_ITEMS)
  const [visibleColumnsTasks, setVisibleColumnsTasks] = useState(DEFAULT_VISIBLE_TASKS)
  const [expandedItemId, setExpandedItemId] = useState(null)
  const [expandedTaskId, setExpandedTaskId] = useState(null)
  const [itemDetailsById, setItemDetailsById] = useState({})
  const [taskDetailsById, setTaskDetailsById] = useState({})
  const [deletingDrafts, setDeletingDrafts] = useState(false)
  const [watchParamsTick, setWatchParamsTick] = useState(0)
  const [kpiLeads, setKpiLeads] = useState(null)
  const [kpiLeadsLoading, setKpiLeadsLoading] = useState(false)
  const [kpiLeadsCapReached, setKpiLeadsCapReached] = useState(false)
  const [activeKpiCardId, setActiveKpiCardId] = useState('total')
  const [greeting, setGreeting] = useState(getTimeGreeting())
  const filterPopoverRef = useRef(null)
  const columnsPopoverRef = useRef(null)
  const filterDropdownRef = useRef(null)
  const columnsDropdownRef = useRef(null)
  const [filterAnchorRect, setFilterAnchorRect] = useState(null)
  const [columnsAnchorRect, setColumnsAnchorRect] = useState(null)

  const isMdUp = useMediaQuery('(min-width: 768px)')

  useLayoutEffect(function positionFilterPopover() {
    if (!filterPopoverOpen || !filterPopoverRef.current) {
      setFilterAnchorRect(null)
      return
    }
    const rect = filterPopoverRef.current.getBoundingClientRect()
    setFilterAnchorRect({ top: rect.bottom + 8, right: window.innerWidth - rect.right, width: 288 })
  }, [filterPopoverOpen])

  useLayoutEffect(function positionColumnsPopover() {
    if (!columnsPopoverOpen || !columnsPopoverRef.current) {
      setColumnsAnchorRect(null)
      return
    }
    const rect = columnsPopoverRef.current.getBoundingClientRect()
    setColumnsAnchorRect({ top: rect.bottom + 8, right: window.innerWidth - rect.right, width: 224 })
  }, [columnsPopoverOpen])

  useEffect(function setupWatchParamsRefetch() {
    if (!kfInstance?.context?.watchParams) return
    function handleWatchParams(data) {
      if (data && typeof data === 'object') {
        if (data.statusFilter != null) setStatusFilter(String(data.statusFilter))
        if (data.search != null) setSearch(String(data.search))
      }
      // Keep counts/lists fresh after workflow actions from popup or other pages.
      setWatchParamsTick((n) => n + 1)
    }
    kfInstance.context.watchParams(handleWatchParams)
  }, [kfInstance])

  useEffect(function setupRoleNameOnLoad() {
    const sdk = kfInstance
    if (!sdk || !sdk.app) return
    let cancelled = false

    async function run() {
      try {
        const abc =
          sdk.user?.Role ||
          sdk.context?.user?.Role ||
          sdk.user?.Roles?.[0] ||
          sdk.context?.user?.Roles?.[0] ||
          null
        const roleFromSdk = stringifyKfRole(abc)
        const roleToStore = String(abc?.Name || roleFromSdk || '').trim()
        if (!roleToStore) return

        await sdk.app.setVariable('user_role_name', roleToStore)
        const variableName = await sdk.app.getVariable('user_role_name')
        const variableRole = String(variableName || '').trim()
        const resolvedRole =
          variableRole && variableRole.toLowerCase() !== 'user'
            ? variableRole
            : String(roleToStore || '').trim()
        if (!resolvedRole || cancelled) return
        setRoleName(resolvedRole)
        // if (sdk.client?.showInfo) sdk.client.showInfo(resolvedRole)
      } catch (e) {
        if (!cancelled) console.warn('Role setup failed:', e?.message || e)
      }
    }
    run()
    return () => { cancelled = true }
  }, [kfInstance])

  useEffect(function fetchStatusCounts() {
    if (!leadPaths) return
    const kf = kfInstance
    let cancelled = false
    async function run() {
      try {
        let response
        if (kf?.api) {
          const resp = await kf.api(leadPaths.statusCountPath, { method: 'GET', headers: { Accept: 'application/json' } })
          response = resp?.data ?? resp ?? null
        } else {
          const res = await fetch(getApiBase() + leadPaths.statusCountPath, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
          if (!res.ok) return
          response = await res.json()
        }
        if (!cancelled && response && typeof response === 'object') {
          setStatusCountsFromApi({
            Draft: response.Draft ?? 0,
            'In progress': response.InProgress ?? 0,
            Completed: response.Completed ?? 0,
            Withdrawn: response.Withdrawn ?? 0,
            Rejected: response.Rejected ?? 0,
          })
        }
      } catch (e) {
        if (!cancelled) console.warn('Status count fetch failed:', e?.message || e)
      }
    }
    run()
    return () => { cancelled = true }
  }, [sdkReady, watchParamsTick, leadPaths, kfInstance])

  useEffect(function fetchPendingActivityCount() {
    if (!leadPaths) return
    const kf = kfInstance
    let cancelled = false
    async function run() {
      try {
        let response
        const pendingCountPath = `/process/2/${leadPaths.accountId}/${leadPaths.processId}/pending/activity/count?_application_id=${encodeURIComponent(TASKS_APPLICATION_ID)}`
        if (kf?.api) {
          const resp = await kf.api(pendingCountPath, { method: 'GET', headers: { Accept: 'application/json' } })
          response = resp?.data ?? resp ?? null
        } else {
          const res = await fetch(getApiBase() + pendingCountPath, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
          if (!res.ok) return
          response = await res.json()
        }
        if (cancelled) return
        const list = Array.isArray(response) ? response : (response?.Data ?? response?.data ?? [])
        const activities = Array.isArray(list) ? list : []
        setPendingActivities(activities)
        const stillExists = activities.some((a) => a?._id === currentActivityId)
        const firstActivity = activities.find((a) => a?._id) || null
        if (activities.length === 1 && activities[0]?._id) {
          setCurrentActivityId(activities[0]._id)
          setCurrentStepName(activities[0].StepName || 'Review Lead Details')
          setTotalTasksCount(activities[0].Count ?? 0)
          return
        }
        if (!stillExists || !currentActivityId) {
          if (firstActivity?._id) setCurrentActivityId(firstActivity._id)
          setCurrentStepName(firstActivity?.StepName || 'Review Lead Details')
          setTotalTasksCount(firstActivity?.Count ?? 0)
        }
      } catch (e) {
        if (!cancelled) console.warn('Pending activity count failed:', e?.message || e)
      }
    }
    run()
    return () => { cancelled = true }
  }, [sdkReady, watchParamsTick, leadPaths, kfInstance, currentActivityId])

  useEffect(function fetchUser() {
    if (!leadPaths) return
    const kf = kfInstance
    const userId = kf?.user?._id || kf?.context?.user?._id || 'UsCyVwuplHVM'
    const path = leadPaths.userPathPrefix + userId + leadPaths.userPathSuffix
    const url = getApiBase() + path
    let cancelled = false
    async function run() {
      try {
        let response
        if (kf?.api) {
          const resp = await kf.api(path, { method: 'GET', headers: { Accept: 'application/json' } })
          response = resp?.data ?? resp ?? null
        } else {
          const res = await fetch(url, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
          if (!res.ok) return
          response = await res.json()
        }
        if (!cancelled && response && (response._id || response.Name)) setUser(response)
      } catch (e) {
        if (!cancelled) console.warn('User fetch failed:', e?.message || e)
      }
      if (!cancelled && !user && kf?.user?.Name) {
        const u = kf.user
        setUser({
          _id: u._id,
          Name: u.Name,
          FirstName: u.FirstName || (u.Name && u.Name.split(' ')[0]) || 'User',
          LastName: u.LastName,
          Email: u.Email,
          _user_type: u._user_type || u.Groups?.[0]?.Name || u.Roles?.[0]?.Name || 'User',
        })
      }
    }
    run()
    return () => { cancelled = true }
  }, [sdkReady, leadPaths])

  useEffect(function fetchItemsByStatus() {
    if (!leadPaths) return
    const kf = kfInstance
    let cancelled = false
    setItemsLoading(true)
    // Fetch selected status list from /myitems/{status} endpoint.
    const path = buildMyItemsPath(leadPaths, statusFilter, 1, 50)
    const segment = STATUS_TO_SEGMENT[statusFilter] || 'draft'
    const url = getApiBase() + path
    async function run() {
      try {
        let response
        if (kf?.api) {
          const resp = await kf.api(path, { method: 'GET', headers: { Accept: 'application/json' } })
          response = resp?.data ?? resp ?? null
        } else {
          const res = await fetch(url, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
          if (!res.ok) return
          response = await res.json()
        }
        if (cancelled) return
        const data = Array.isArray(response) ? response : response?.Data ?? response?.data ?? response?.Item ?? response?.items ?? null
        const list = Array.isArray(data)
          ? data
              .map((row) => mapKfItemToLead(row, segment))
              .filter(Boolean)
          : []
        setItems(list)
      } catch (e) {
        if (!cancelled) {
          console.warn('Leads items fetch failed:', e?.message || e)
          setItems(null)
        }
      } finally {
        if (!cancelled) setItemsLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [sdkReady, statusFilter, watchParamsTick, leadPaths, kfInstance])

  useEffect(function fetchTasksForActivity() {
    if (!leadPaths) return
    if (!currentActivityId) {
      setTasksFromApi([])
      setTasksLoading(false)
      return
    }
    const kf = kfInstance
    let cancelled = false
    setTasksLoading(true)
    // Fetch selected activity tasks from pending/{activityId} endpoint.
    const path = `/process/2/${leadPaths.accountId}/${leadPaths.processId}/pending/${encodeURIComponent(String(currentActivityId))}?apply_preference=true&page_number=1&page_size=10&skip_aggregation=true&_application_id=${encodeURIComponent(TASKS_APPLICATION_ID)}`
    const url = getApiBase() + path
    async function run() {
      try {
        let response
        if (kf?.api) {
          const resp = await kf.api(path, { method: 'GET', headers: { Accept: 'application/json' } })
          response = resp?.data ?? resp ?? null
        } else {
          const res = await fetch(url, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
          if (!res.ok) return
          response = await res.json()
        }
        if (cancelled) return
        const data = Array.isArray(response) ? response : response?.Data ?? response?.data ?? null
        const list = Array.isArray(data) ? data.map((row) => mapKfTaskToRow(row, '')).filter(Boolean) : []
        setTasksFromApi(list)
        if (!cancelled) {
          const active = Array.isArray(pendingActivities) ? pendingActivities.find((a) => a?._id === currentActivityId) : null
          setTotalTasksCount(active?.Count ?? (Array.isArray(list) ? list.length : 0))
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('Tasks fetch failed:', e?.message || e)
          setTasksFromApi(null)
        }
      } finally {
        if (!cancelled) setTasksLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [sdkReady, watchParamsTick, leadPaths, kfInstance, currentActivityId, pendingActivities])

  useEffect(function hydrateExpandedTaskDetails() {
    if (!expandedTaskId || !leadPaths) return
    if (taskDetailsById[expandedTaskId]) return
    const baseTask = (tasksFromApi || []).find((t) => t?.id === expandedTaskId)
    if (!baseTask) return
    if (baseTask.address && baseTask.message && baseTask.phoneNumber && baseTask.emailId) return

    const sdk = kfInstance
    const instanceId = baseTask?._id || baseTask?.id
    const activityInstanceId = baseTask?.activityInstanceId || baseTask?._activity_instance_id
    if (!instanceId || !activityInstanceId) return
    const path = `/process/2/${leadPaths.accountId}/${leadPaths.processId}/${encodeURIComponent(String(instanceId))}/${encodeURIComponent(String(activityInstanceId))}?_application_id=${encodeURIComponent(TASKS_APPLICATION_ID)}`
    let cancelled = false

    async function run() {
      try {
        let response
        if (sdk?.api) {
          const resp = await sdk.api(path, { method: 'GET', headers: { Accept: 'application/json' } })
          response = resp?.data ?? resp ?? null
        } else {
          const res = await fetch(getApiBase() + path, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
          if (!res.ok) return
          response = await res.json()
        }
        if (cancelled || !response) return
        const merged = mapKfTaskToRow(response, baseTask?.activityId || currentActivityId || '')
        if (!merged) return
        setTaskDetailsById((prev) => ({ ...prev, [expandedTaskId]: { ...baseTask, ...merged } }))
      } catch (e) {
        if (!cancelled) console.warn('Task detail hydrate failed:', e?.message || e)
      }
    }
    run()
    return () => { cancelled = true }
  }, [expandedTaskId, leadPaths, kfInstance, tasksFromApi, taskDetailsById, currentActivityId])

  useEffect(function hydrateExpandedItemDetails() {
    if (!expandedItemId || !leadPaths) return
    if (itemDetailsById[expandedItemId]) return
    const baseItem = (items || []).find((t) => t?.id === expandedItemId)
    if (!baseItem) return
    if (baseItem.botsSummary && baseItem.recordingUrl) return

    const sdk = kfInstance
    const instanceId = baseItem?._id || baseItem?.id
    const activityInstanceId = baseItem?.activityInstanceId || baseItem?._activity_instance_id
    if (!instanceId) return
    let cancelled = false

    async function fetchOne(path) {
      if (sdk?.api) {
        const resp = await sdk.api(path, { method: 'GET', headers: { Accept: 'application/json' } })
        return resp?.data ?? resp ?? null
      }
      const res = await fetch(getApiBase() + path, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
      if (!res.ok) return null
      return res.json()
    }

    async function run() {
      try {
        const detailPath = activityInstanceId
          ? `/process/2/${leadPaths.accountId}/${leadPaths.processId}/${encodeURIComponent(String(instanceId))}/${encodeURIComponent(String(activityInstanceId))}?_application_id=${encodeURIComponent(TASKS_APPLICATION_ID)}`
          : null
        const fallbackPath = `/process/2/${leadPaths.accountId}/${leadPaths.processId}/${encodeURIComponent(String(instanceId))}?_application_id=${encodeURIComponent(TASKS_APPLICATION_ID)}`
        let response = null
        if (detailPath) response = await fetchOne(detailPath)
        if (!response) response = await fetchOne(fallbackPath)
        if (cancelled || !response) return
        const merged = mapKfItemToLead(response, undefined)
        if (!merged) return
        setItemDetailsById((prev) => ({ ...prev, [expandedItemId]: { ...baseItem, ...merged } }))
      } catch (e) {
        if (!cancelled) console.warn('Item detail hydrate failed:', e?.message || e)
      }
    }
    run()
    return () => { cancelled = true }
  }, [expandedItemId, leadPaths, kfInstance, items, itemDetailsById])

  useEffect(function initAOS() {
    AOS.init({ duration: 800, once: true })
  }, [])

  useEffect(function syncGreetingClock() {
    const t = setInterval(() => setGreeting(getTimeGreeting()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(function closePopoversOnClickOutside() {
    if (!filterPopoverOpen && !columnsPopoverOpen) return
    const handle = (e) => {
      if (filterPopoverRef.current?.contains(e.target) || filterDropdownRef.current?.contains(e.target)) return
      if (columnsPopoverRef.current?.contains(e.target) || columnsDropdownRef.current?.contains(e.target)) return
      setFilterPopoverOpen(false)
      setColumnsPopoverOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [filterPopoverOpen, columnsPopoverOpen])

  useEffect(function fetchKpiLeadsAdminList() {
    if (!adminPaths) return
    const kf = kfInstance
    let cancelled = false
    setKpiLeadsLoading(true)

    async function fetchOnePage(pageNumber) {
      const path = adminPaths.getLeadItemsPath(pageNumber, 100000)
      if (kf?.api) {
        const resp = await kf.api(path, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        return resp?.data ?? resp ?? null
      }
      const res = await fetch(getApiBase() + path, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`KPI lead list HTTP ${res.status}`)
      return res.json()
    }

    async function run() {
      try {
        const response = await fetchOnePage(1)
        if (cancelled) return
        const data = response?.Data ?? response?.data ?? (Array.isArray(response) ? response : null)
        const list = Array.isArray(data) ? data : []
        const merge = []
        for (let i = 0; i < list.length; i += 1) {
          const row = mapKfItemToLead(list[i], undefined)
          if (row) merge.push(row)
        }
        if (!cancelled) {
          setKpiLeadsCapReached(false)
          setKpiLeads(merge)
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('KPI leads fetch failed:', e?.message || e)
          setKpiLeads(null)
          setKpiLeadsCapReached(false)
        }
      } finally {
        if (!cancelled) setKpiLeadsLoading(false)
      }
    }
    run()
    return function () { cancelled = true }
  }, [sdkReady, watchParamsTick, adminPaths, kfInstance])

  useEffect(function resetItemsPageOnKpiCardChange() {
    setItemsPage(1)
  }, [activeKpiCardId])

  const itemList = items !== null ? items : DEMO_ITEMS
  const taskList = tasksFromApi ?? []
  const activityTabs = useMemo(() => {
    const list = Array.isArray(pendingActivities) ? pendingActivities : []
    return list.filter((a) => a && a._id)
  }, [pendingActivities])

  const totalItemsCount = statusCountsFromApi?.[statusFilter] ?? 0

  function itemMatchesDateRange(item, from, to) {
    const d = item?.createdDate ? new Date(item.createdDate) : null
    if (!d || isNaN(d.getTime())) return false
    if (from) {
      const fromD = new Date(from)
      fromD.setHours(0, 0, 0, 0)
      if (d < fromD) return false
    }
    if (to) {
      const toD = new Date(to)
      toD.setHours(23, 59, 59, 999)
      if (d > toD) return false
    }
    return true
  }

  const websiteOptionsKpi = useMemo(() => {
    const base = Array.isArray(kpiLeads) ? kpiLeads : []
    const set = new Set()
    base.forEach((lead) => {
      const w = lead?.website != null && String(lead.website).trim() !== '' ? String(lead.website).trim() : null
      if (w) set.add(w)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [kpiLeads])

  const lockedWebsiteKpi = useMemo(() => {
    const roleCandidates = [
      roleName,
      user?.Role?.Name,
      user?._user_type,
      user?.Groups?.[0]?.Name,
      user?.Roles?.[0]?.Name,
    ]
      .filter(Boolean)
      .map((v) => String(v).trim())
      .filter(Boolean)

    if (roleCandidates.length === 0 || websiteOptionsKpi.length === 0) return null

    const normalizedRoles = roleCandidates.map(normalizeTextKpi).filter(Boolean)

    for (let i = 0; i < normalizedRoles.length; i += 1) {
      const mappedWebsite = ROLE_TO_WEBSITE_KPI[normalizedRoles[i]]
      if (mappedWebsite) {
        return resolveWebsiteFromOptionsKpi(mappedWebsite, websiteOptionsKpi)
      }
    }

    for (let i = 0; i < websiteOptionsKpi.length; i += 1) {
      const website = websiteOptionsKpi[i]
      const wNorm = normalizeTextKpi(website)
      if (!wNorm) continue
      const matched = normalizedRoles.some((rNorm) => rNorm.includes(wNorm) || wNorm.includes(rNorm))
      if (matched) return website
    }
    return null
  }, [roleName, user, websiteOptionsKpi])

  const roleCandidatesForAdmin = useMemo(() => {
    return [
      roleName,
      user?.Role?.Name,
      user?._user_type,
      user?.Groups?.[0]?.Name,
      user?.Roles?.[0]?.Name,
    ]
      .filter(Boolean)
      .map((v) => String(v).trim())
      .filter(Boolean)
  }, [roleName, user])

  const isAdminRole = useMemo(() => {
    const normalized = roleCandidatesForAdmin.map((r) => normalizeTextKpi(r))
    return normalized.includes('admin')
  }, [roleCandidatesForAdmin])

  useEffect(() => {
    // If role is not Admin, the "Lead Sources" card is hidden; avoid stale selection.
    if (!isAdminRole && activeKpiCardId === 'sources') setActiveKpiCardId('total')
  }, [isAdminRole, activeKpiCardId])

  /** Full-process lead set for KPI cards: respects role-scoped website + toolbar date/search (not status tab). */
  const kpiDisplayLeads = useMemo(() => {
    const base = Array.isArray(kpiLeads) ? kpiLeads : []
    let list = base
    if (lockedWebsiteKpi) {
      list = list.filter((l) => String(l.website || '').trim() === lockedWebsiteKpi)
    }
    if (filterFromDate || filterToDate) {
      list = list.filter((item) => itemMatchesDateRange(item, filterFromDate, filterToDate))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (item) =>
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.fullName && item.fullName.toLowerCase().includes(q)) ||
          (item.emailId && item.emailId.toLowerCase().includes(q)) ||
          (item.message && item.message.toLowerCase().includes(q))
      )
    }
    return list
  }, [kpiLeads, lockedWebsiteKpi, filterFromDate, filterToDate, search])

  const filteredItems = useMemo(() => {
    let list = itemList
    if (statusFilter) {
      list = list.filter((item) => (formatStatusForDisplay(item?.status) || 'Draft') === statusFilter)
    }
    if (filterFromDate || filterToDate) {
      list = list.filter((item) => itemMatchesDateRange(item, filterFromDate, filterToDate))
    }
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      (item) =>
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.fullName && item.fullName.toLowerCase().includes(q)) ||
        (item.emailId && item.emailId.toLowerCase().includes(q)) ||
        (item.message && item.message.toLowerCase().includes(q))
    )
  }, [itemList, statusFilter, search, filterFromDate, filterToDate])

  const filteredTasks = useMemo(() => {
    let list = taskList
    if (filterFromDate || filterToDate) {
      list = list.filter((t) => itemMatchesDateRange(t, filterFromDate, filterToDate))
    }
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      (t) =>
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.fullName && t.fullName.toLowerCase().includes(q)) ||
        (t.createdBy && t.createdBy.toLowerCase().includes(q))
    )
  }, [taskList, search, filterFromDate, filterToDate])

  const statusCounts = useMemo(() => {
    if (statusCountsFromApi) return statusCountsFromApi
    const counts = { Draft: 0, 'In progress': 0, Completed: 0, Withdrawn: 0, Rejected: 0 }
    itemList.forEach((item) => {
      const s = item.status || 'Draft'
      if (counts[s] !== undefined) counts[s]++
      else counts.Draft++
    })
    return counts
  }, [statusCountsFromApi, itemList])

  const filteredItemsAfterKpi = useMemo(() => {
    let list = filteredItems
    if (activeTab !== 'items') return list
    const id = activeKpiCardId
    if (!id || id === 'total') return list
    if (id === 'today') return list.filter(isCreatedTodayKpi)
    if (id === 'week') return list.filter(isCreatedThisWeekKpi)
    if (id === 'pending') return list.filter(isOpenPipelineKpi)
    if (id === 'closed') return list.filter(isClosedSuccessKpi)
    if (id === 'sources') {
      const counts = {}
      kpiDisplayLeads.forEach((l) => {
        const w = l?.website != null && String(l.website).trim() !== '' ? String(l.website).trim() : null
        if (!w) return
        counts[w] = (counts[w] || 0) + 1
      })
      const topWebsite = Object.entries(counts).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0]
      if (!topWebsite) return list
      return list.filter((l) => String(l?.website || '').trim() === topWebsite)
    }
    return list
  }, [filteredItems, activeKpiCardId, activeTab, kpiDisplayLeads])

  const itemsPaginated = filteredItemsAfterKpi.slice((itemsPage - 1) * rowsPerPage, itemsPage * rowsPerPage)
  const tasksPaginated = filteredTasks.slice((tasksPage - 1) * rowsPerPage, tasksPage * rowsPerPage)

  const totalItemsPages = Math.max(1, Math.ceil(filteredItemsAfterKpi.length / rowsPerPage))
  const totalTasksPages = Math.max(1, Math.ceil(filteredTasks.length / rowsPerPage))

  // Bulk selection checkboxes: keep for Draft items, hide for other item statuses.
  const showItemBulkCheckboxes = statusFilter === 'Draft'
  const itemsTableLeadingCols = showItemBulkCheckboxes ? 2 : 1
  const tasksTableLeadingCols = 1 // expand column only (no task checkboxes)

  const toggleItemSelection = (id) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllItems = (checked) => {
    if (checked) setSelectedItemIds(new Set(itemsPaginated.map((i) => i.id)))
    else setSelectedItemIds(new Set())
  }

  const handleDeleteSelectedDrafts = async () => {
    const ids = Array.from(selectedItemIds).filter(Boolean)
    if (ids.length === 0) return
    if (activeTab !== 'items' || statusFilter !== 'Draft') return
    if (!leadPaths) {
      window.alert('Kissflow paths are not ready yet. Please wait and try again.')
      return
    }

    const confirmed = window.confirm(`Delete ${ids.length} selected draft record(s)? This cannot be undone.`)
    if (!confirmed) return

    const sdk = kfInstance
    setDeletingDrafts(true)
    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          // Admin delete endpoint (no _application_id query required).
          const recordId = encodeURIComponent(String(id))
          const path = `/process/2/${leadPaths.accountId}/admin/${leadPaths.processId}/${recordId}`
          if (sdk?.api) {
            return sdk.api(path, { method: 'DELETE', headers: { Accept: 'application/json' } })
          }
          const res = await fetch(getApiBase() + path, {
            method: 'DELETE',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          })
          if (!res.ok) throw new Error(`Delete failed (${res.status})`)
          return true
        })
      )

      const successIds = []
      let failed = 0
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') successIds.push(ids[idx])
        else failed += 1
      })

      if (successIds.length > 0) {
        setItems((prev) => (Array.isArray(prev) ? prev.filter((row) => !successIds.includes(row.id)) : prev))
        setSelectedItemIds((prev) => {
          const next = new Set(prev)
          successIds.forEach((id) => next.delete(id))
          return next
        })
        setStatusCountsFromApi((prev) => {
          if (!prev || typeof prev !== 'object') return prev
          return { ...prev, Draft: Math.max(0, (prev.Draft || 0) - successIds.length) }
        })
      }

      if (failed > 0) {
        window.alert(`${successIds.length} draft(s) deleted, ${failed} failed.`)
      } else {
        window.alert(`${successIds.length} draft(s) deleted successfully.`)
      }
    } catch (e) {
      console.warn('Bulk draft delete failed:', e?.message || e)
      window.alert('Delete failed. Please try again or contact support.')
    } finally {
      setDeletingDrafts(false)
    }
  }

  // Same pattern as DashboardPage.handleCreateContract — only popup id + openPage fallback differ
  const handleNewItem = () => {
    const sdk = typeof kf !== 'undefined' ? kf : window.kf
    const POPUP_ID = 'Popup_w-VaMxwzHv'
    const popupParams = {
      width: 960,
      height: 720,
      popupWidth: '960px',
      popupHeight: '720px',
    }
    const appId = resolveKfApplicationId(sdk)
    if (typeof sdk?.app?.page?.openPopup === 'function') {
      sdk.app.page.openPopup(POPUP_ID, popupParams)
    } else if (sdk?.navigation && typeof sdk.navigation.navigate === 'function') {
      sdk.navigation.navigate({ page: 'create' })
    } else if (sdk?.app?.openPage && appId) {
      sdk.app.openPage(appId)
    } else {
      console.info('New item – wire popup/navigation in Kissflow')
    }
  }

  const openLeadPopup = (row) => {
    const kfInstance = typeof kf !== 'undefined' ? kf : window.kf
    const POPUP_ID = 'Popup_w-VaMxwzHv'
    const instanceId = row?.id || row?._id
    const activityInstanceId = row?.activityInstanceId || row?._activity_instance_id || ''
    // Popup expects ActivityID; prioritize activity instance id for workflow-form loading.
    const activityId = activityInstanceId || row?.activityId || currentActivityId || ''

    if (!kfInstance?.app?.page?.openPopup) return
    if (!instanceId || !activityId) {
      console.warn('View Details: missing required popup params', {
        instanceId,
        activityId,
        activityInstanceId,
        row,
      })
      // Safe UI fallback so user can still inspect details
      setSelectedLead(row)
      return
    }

    try {
      const p = kfInstance.app.page.openPopup(POPUP_ID, {
        // Keep canonical names requested by your popup, plus aliases for compatibility.
        ActivityID: String(activityId),
        InstanceId: String(instanceId),
        ActivityInstanceId: String(activityInstanceId || activityId),
        ActivityId: String(activityId),
        activityId: String(activityId),
        InstanceID: String(instanceId),
        width: 960,
        height: 720,
        popupWidth: '960px',
        popupHeight: '720px',
      })
      if (p && typeof p.catch === 'function') {
        p.catch((e) => {
          console.warn('View Details popup failed:', e?.message || e)
          setSelectedLead(row)
        })
      }
    } catch (e) {
      console.warn('View Details popup failed:', e?.message || e)
      setSelectedLead(row)
    }
  }

  const firstName = user?.FirstName || user?.Name?.split(' ')[0] || 'User'
  const displayRole =
    roleName ||
    user?.Role?.Name?.trim() ||
    user?._user_type ||
    user?.Groups?.[0]?.Name ||
    user?.Roles?.[0]?.Name ||
    'User'

  return (
    <div className="bg-[#f6f8fb] p-3 md:p-4 overflow-hidden">
      <div className="mx-auto max-w-[1500px] min-w-0">
          <div className="p-2 sm:p-3 md:p-4 space-y-5 sm:space-y-6 transition-smooth">
            <section className="mb-3 sm:mb-4" data-aos="fade-down">
              <div className="flex items-center gap-3 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden whitespace-nowrap">
                <div className="flex items-center gap-3 min-w-0 shrink-0">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 via-brand-blue to-brand-green flex items-center justify-center text-white text-sm font-bold shadow-sm">
                    {(firstName || 'U').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base sm:text-lg font-semibold tracking-tight text-gray-900 truncate">{greeting}, {firstName}</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">Logged in as {displayRole}</p>
                  </div>
                </div>
                {(lockedWebsiteKpi || kpiLeadsLoading) && (
                  <div className="ml-auto text-xs sm:text-sm text-slate-600 font-medium">
                    {lockedWebsiteKpi ? <span className="text-brand-blue font-semibold">{lockedWebsiteKpi}</span> : <span>All properties</span>}
                    {kpiLeadsLoading ? <span className="text-slate-400"> · Loading metrics…</span> : null}
                  </div>
                )}
              </div>
            </section>

            <div className="space-y-1 min-w-0" data-aos="fade-up">
              <KPICards
                leads={kpiDisplayLeads}
                allLeads={kpiDisplayLeads}
                datasetCapReached={kpiLeads !== null && kpiLeadsCapReached}
                dateRange="Last 30 Days"
                onCardClick={(id) => setActiveKpiCardId(id)}
                activeCardId={activeKpiCardId}
                showSourcesCard={isAdminRole}
              />
            </div>

            {/* Tabs + actions toolbar (ContractsMyItemsPro-style single row on sm+) */}
            <div
              className="rounded-2xl border border-white/60 bg-white/50 backdrop-blur-sm shadow-sm overflow-hidden"
              data-aos="fade-down"
            >
              <div className="relative z-[100] flex flex-col gap-3 border-b border-slate-200/60 bg-gradient-to-r from-slate-50/70 to-white/40 px-2.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3 sm:py-3">
                <div
                  className="grid grid-cols-2 w-full gap-1 p-1 rounded-2xl border border-slate-300/70 bg-white/70 shadow-sm sm:w-auto"
                  role="tablist"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'tasks'}
                    onClick={() => setActiveTab('tasks')}
                    className={`min-h-[44px] sm:min-h-[36px] rounded-xl text-sm sm:text-xs font-semibold transition-all duration-200 touch-manipulation inline-flex items-center justify-center gap-2 text-center px-3 ${
                      activeTab === 'tasks'
                        ? 'bg-white text-brand-blue shadow-md ring-1 ring-brand-blue/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <span className="leading-tight">My Tasks</span>
                      {totalTasksCount > 0 && (
                        <span
                          className={`inline-flex items-center justify-center min-w-[1.375rem] h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums ${
                            activeTab === 'tasks'
                              ? 'bg-brand-blue text-white shadow-sm'
                              : 'bg-brand-blue/15 text-brand-blue border border-brand-blue/20'
                          }`}
                        >
                          {totalTasksCount > 99 ? '99+' : totalTasksCount}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'items'}
                    onClick={() => setActiveTab('items')}
                    className={`min-h-[44px] sm:min-h-[36px] rounded-xl text-sm sm:text-xs font-semibold transition-all duration-200 touch-manipulation inline-flex items-center justify-center gap-2 text-center px-3 ${
                      activeTab === 'items'
                        ? 'bg-white text-brand-blue shadow-md ring-1 ring-brand-blue/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <span className="leading-tight">My Items</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:flex-nowrap sm:justify-end min-w-0 shrink-0">
                {activeTab === 'items' && statusFilter === 'Draft' && selectedItemIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelectedDrafts}
                    disabled={deletingDrafts}
                    className="min-h-[44px] md:min-h-[40px] px-4 py-2.5 md:px-4 md:py-2 rounded-xl text-sm font-semibold transition-all duration-300 touch-manipulation border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 whitespace-nowrap"
                    title="Delete selected draft records"
                  >
                    <i className="ri-delete-bin-6-line shrink-0" />
                    {deletingDrafts ? 'Deleting…' : `Delete (${selectedItemIds.size})`}
                  </button>
                )}
                {activeTab === 'items' && (
                  <button
                    type="button"
                    onClick={handleNewItem}
                    className="min-h-[44px] md:min-h-[40px] px-4 py-2.5 md:px-4 md:py-2 rounded-xl text-sm font-semibold transition-all duration-300 touch-manipulation inline-flex items-center justify-center gap-2 bg-gradient-to-br from-brand-blue to-indigo-600 text-white shadow-md shadow-indigo-500/25 hover:shadow-lg hover:scale-[1.01] whitespace-nowrap shrink-0"
                  >
                    <i className="ri-add-line text-base"></i>
                    New item
                  </button>
                )}
                <div className="relative w-full sm:w-auto flex-1 sm:max-w-xs min-w-0 order-3 sm:order-none">
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"></i>
                  <input
                    type="text"
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full min-h-[44px] pl-10 pr-4 py-2.5 text-sm bg-white/80 border border-slate-300/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue placeholder:text-slate-400 touch-manipulation"
                  />
                </div>
                <div className="order-2 sm:order-none flex items-center gap-2 shrink-0">
                <div className="relative" ref={filterPopoverRef}>
                  <button
                    type="button"
                    onClick={() => { setFilterPopoverOpen((o) => !o); setColumnsPopoverOpen(false) }}
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl border touch-manipulation transition-colors ${filterPopoverOpen ? 'bg-brand-blue/10 border-brand-blue text-brand-blue' : 'bg-white/80 border-slate-300/80 text-slate-600 hover:bg-white'}`}
                    aria-label="Filter"
                  >
                    <i className="ri-filter-3-line text-lg"></i>
                  </button>
                  {filterPopoverOpen &&
                  isMdUp &&
                  filterAnchorRect &&
                  createPortal(
                    <div
                      ref={filterDropdownRef}
                      className="rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-300/80 shadow-2xl p-4"
                      style={{
                        position: 'fixed',
                        top: filterAnchorRect.top,
                        right: filterAnchorRect.right,
                        width: filterAnchorRect.width,
                        zIndex: 9999,
                      }}
                    >
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Filter by date</p>
                      <div className="space-y-2">
                        <label className="block text-sm text-slate-700">From</label>
                        <input
                          type="date"
                          value={filterFromDate}
                          onChange={(e) => setFilterFromDate(e.target.value)}
                          className="w-full min-h-[40px] px-3 py-2 text-sm bg-white/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
                        />
                        <label className="block text-sm text-slate-700">To</label>
                        <input
                          type="date"
                          value={filterToDate}
                          onChange={(e) => setFilterToDate(e.target.value)}
                          className="w-full min-h-[40px] px-3 py-2 text-sm bg-white/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
                        />
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          type="button"
                          onClick={() => { setFilterFromDate(''); setFilterToDate(''); setFilterPopoverOpen(false) }}
                          className="flex-1 min-h-[40px] px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterPopoverOpen(false)}
                          className="flex-1 min-h-[40px] px-3 py-2 text-sm font-medium text-white bg-brand-blue rounded-xl hover:opacity-90"
                        >
                          Apply
                        </button>
                      </div>
                    </div>,
                    document.body
                  )}
                  {filterPopoverOpen &&
                  !isMdUp &&
                  createPortal(
                    <div
                      className="fixed inset-0 z-[10050] flex flex-col justify-end bg-black/45 backdrop-blur-[2px]"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="date-filter-sheet-title-ad"
                      onClick={() => setFilterPopoverOpen(false)}
                    >
                      <div
                        ref={filterDropdownRef}
                        className="w-full max-h-[min(88vh,540px)] rounded-t-2xl bg-white shadow-2xl border-t border-slate-200/80 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden />
                        <h2 id="date-filter-sheet-title-ad" className="text-base font-bold text-slate-900 mb-1">
                          Filter by date
                        </h2>
                        <p className="text-xs text-slate-500 mb-4">Choose a range, then tap Apply.</p>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
                            <input
                              type="date"
                              value={filterFromDate}
                              onChange={(e) => setFilterFromDate(e.target.value)}
                              className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
                            <input
                              type="date"
                              value={filterToDate}
                              onChange={(e) => setFilterToDate(e.target.value)}
                              className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
                            />
                          </div>
                        </div>
                        <div className="mt-5 flex gap-3">
                          <button
                            type="button"
                            onClick={() => { setFilterFromDate(''); setFilterToDate(''); setFilterPopoverOpen(false) }}
                            className="flex-1 min-h-[48px] px-4 py-3 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 touch-manipulation"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterPopoverOpen(false)}
                            className="flex-1 min-h-[48px] px-4 py-3 text-sm font-semibold text-white bg-brand-blue rounded-xl hover:opacity-90 touch-manipulation"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
                <div className="relative" ref={columnsPopoverRef}>
                  <button
                    type="button"
                    onClick={() => { setColumnsPopoverOpen((o) => !o); setFilterPopoverOpen(false) }}
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl border touch-manipulation transition-colors ${columnsPopoverOpen ? 'bg-brand-blue/10 border-brand-blue text-brand-blue' : 'bg-white/80 border-slate-300/80 text-slate-600 hover:bg-white'}`}
                    aria-label="Column visibility"
                  >
                    <i className="ri-eye-line text-lg"></i>
                  </button>
                  {columnsPopoverOpen && isMdUp && columnsAnchorRect && createPortal(
                    <div
                      ref={columnsDropdownRef}
                      className="rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-300/80 shadow-2xl p-4"
                      style={{
                        position: 'fixed',
                        top: columnsAnchorRect.top,
                        right: columnsAnchorRect.right,
                        width: columnsAnchorRect.width,
                        zIndex: 9999,
                      }}
                    >
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Visible columns</p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {activeTab === 'items' &&
                          ITEMS_COLUMNS.map((col) => (
                            <label key={col.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!visibleColumnsItems[col.id]}
                                onChange={() =>
                                  setVisibleColumnsItems((prev) => ({ ...prev, [col.id]: !prev[col.id] }))
                                }
                                className="rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                              />
                              <span className="text-sm text-slate-700">{col.label}</span>
                            </label>
                          ))}
                        {activeTab === 'tasks' &&
                          TASKS_COLUMNS.map((col) => (
                            <label key={col.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!visibleColumnsTasks[col.id]}
                                onChange={() =>
                                  setVisibleColumnsTasks((prev) => ({ ...prev, [col.id]: !prev[col.id] }))
                                }
                                className="rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                              />
                              <span className="text-sm text-slate-700">{col.label}</span>
                            </label>
                          ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setColumnsPopoverOpen(false)}
                        className="mt-3 w-full min-h-[40px] px-3 py-2 text-sm font-medium text-white bg-brand-blue rounded-xl hover:opacity-90"
                      >
                        Done
                      </button>
                    </div>,
                    document.body
                  )}

                  {columnsPopoverOpen && !isMdUp && createPortal(
                    <div
                      className="fixed inset-0 z-[10050] flex flex-col justify-end bg-black/45 backdrop-blur-[2px]"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="columns-sheet-title"
                      onClick={() => setColumnsPopoverOpen(false)}
                    >
                      <div
                        ref={columnsDropdownRef}
                        className="w-full max-h-[min(88vh,620px)] rounded-t-2xl bg-white shadow-2xl border-t border-slate-200/80 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden />
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <h2 id="columns-sheet-title" className="text-base font-bold text-slate-900">
                              Visible columns
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">Choose what to show in the table.</p>
                          </div>
                          <button
                            type="button"
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
                            onClick={() => setColumnsPopoverOpen(false)}
                            aria-label="Close"
                          >
                            <i className="ri-close-line text-2xl" />
                          </button>
                        </div>

                        <div className="max-h-[52vh] overflow-auto pr-1 space-y-2">
                          {activeTab === 'items' &&
                            ITEMS_COLUMNS.map((col) => (
                              <label key={col.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                                <input
                                  type="checkbox"
                                  checked={!!visibleColumnsItems[col.id]}
                                  onChange={() =>
                                    setVisibleColumnsItems((prev) => ({ ...prev, [col.id]: !prev[col.id] }))
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                                />
                                <span className="text-sm font-medium text-slate-800">{col.label}</span>
                              </label>
                            ))}
                          {activeTab === 'tasks' &&
                            TASKS_COLUMNS.map((col) => (
                              <label key={col.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                                <input
                                  type="checkbox"
                                  checked={!!visibleColumnsTasks[col.id]}
                                  onChange={() =>
                                    setVisibleColumnsTasks((prev) => ({ ...prev, [col.id]: !prev[col.id] }))
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                                />
                                <span className="text-sm font-medium text-slate-800">{col.label}</span>
                              </label>
                            ))}
                        </div>

                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => setColumnsPopoverOpen(false)}
                            className="w-full min-h-[48px] rounded-xl bg-brand-blue text-white text-sm font-semibold hover:opacity-90 touch-manipulation"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
                </div>
              </div>
            </div>
            </div>

            {/* Status / step chips row (replicates ContractsMyItemsPro layout) */}
            {activeTab === 'items' ? (
              <>
                {/* Mobile: 2-col grid */}
                <div className="grid grid-cols-2 gap-2.5 sm:hidden min-w-0">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        setStatusFilter(status)
                        setItemsPage(1)
                      }}
                      className={`min-h-[44px] w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 touch-manipulation border-2 text-left inline-flex flex-row items-center justify-between gap-2 ${
                        statusFilter === status
                          ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                          : 'border-slate-300/80 bg-white/80 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate leading-snug">{status}</span>
                      {statusCounts[status] != null && (
                        <span
                          className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ${
                            statusFilter === status ? 'bg-brand-blue/15 text-brand-blue' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {(statusCounts[status] || 0)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Tablet/Desktop: single horizontal row */}
                <div className="hidden sm:flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        setStatusFilter(status)
                        setItemsPage(1)
                      }}
                      className={`min-h-[36px] shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 touch-manipulation border-2 inline-flex items-center gap-2 ${
                        statusFilter === status
                          ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                          : 'border-slate-300/80 bg-white/80 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <span className="truncate max-w-[12rem]">{status}</span>
                      <span
                        className={`shrink-0 rounded-lg px-1.5 py-0 text-[11px] font-bold tabular-nums ${
                          statusFilter === status ? 'bg-brand-blue/15 text-brand-blue' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {(statusCounts[status] || 0)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Mobile: 2-col grid */}
                <div className="grid grid-cols-2 gap-2.5 sm:hidden min-w-0">
                  {(activityTabs || []).map((activity) => {
                    const isActive = currentActivityId === activity._id
                    const count = activity.Count ?? 0
                    return (
                      <button
                        key={activity._id}
                        type="button"
                        onClick={() => {
                          setCurrentActivityId(activity._id)
                          setCurrentStepName(activity.StepName || 'Review Lead Details')
                          setTotalTasksCount(count)
                          setTasksPage(1)
                        }}
                        className={`min-h-[44px] w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 touch-manipulation border-2 text-left inline-flex flex-row items-center justify-between gap-2 ${
                          isActive
                            ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                            : 'border-slate-300/80 bg-white/80 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate leading-snug">{activity.StepName || 'Activity'}</span>
                        <span
                          className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ${
                            isActive ? 'bg-brand-blue/15 text-brand-blue' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Tablet/Desktop: single horizontal row */}
                <div className="hidden sm:flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {(activityTabs || []).map((activity) => {
                    const isActive = currentActivityId === activity._id
                    const count = activity.Count ?? 0
                    return (
                      <button
                        key={activity._id}
                        type="button"
                        onClick={() => {
                          setCurrentActivityId(activity._id)
                          setCurrentStepName(activity.StepName || 'Review Lead Details')
                          setTotalTasksCount(count)
                          setTasksPage(1)
                        }}
                        className={`min-h-[36px] shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 touch-manipulation border-2 inline-flex items-center gap-2 ${
                          isActive
                            ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                            : 'border-slate-300/80 bg-white/80 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <span className="truncate max-w-[16rem]">{activity.StepName || 'Activity'}</span>
                        <span
                          className={`shrink-0 rounded-lg px-1.5 py-0 text-[11px] font-bold tabular-nums ${
                            isActive ? 'bg-brand-blue/15 text-brand-blue' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {/* Table - z-0 so toolbar dropdowns (z-[100]) render on top */}
            <div className="relative z-0 glass rounded-none md:rounded-3xl bg-transparent md:bg-gradient-to-br md:from-white/80 md:to-indigo-50/30 border border-slate-300/70 shadow-none md:shadow-xl md:shadow-slate-200/30 overflow-visible md:overflow-hidden glass-hover" data-aos="fade-up">
              <div className="overflow-x-auto">
                {activeTab === 'items' && isMdUp && (
                  <table className="w-full bg-white/60 border border-slate-300/70">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-200/80 via-slate-100/80 to-indigo-100/60 backdrop-blur-xl border-b border-slate-300/70">
                        {showItemBulkCheckboxes && (
                          <th className="px-2 sm:px-3 py-3 sm:py-4 w-10 sm:w-12">
                            <input
                              type="checkbox"
                              checked={
                                itemsPaginated.length > 0 && itemsPaginated.every((i) => selectedItemIds.has(i.id))
                              }
                              onChange={(e) => selectAllItems(e.target.checked)}
                              className="rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                            />
                          </th>
                        )}
                        <th className="px-2 sm:px-3 py-3 sm:py-4 w-10 text-center" aria-label="Expand row">
                          <span className="text-xs font-bold text-slate-500 uppercase"> </span>
                        </th>
                        {ITEMS_COLUMNS.map((col) => (
                          <th
                            key={col.id}
                            className={`px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider ${visibleColumnsItems[col.id] ? '' : 'hidden'}`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="relative">
                      {itemsLoading && itemList.length === 0 ? (
                        <tr>
                          <td
                            colSpan={itemsTableLeadingCols + ITEMS_COLUMNS.length}
                            className="px-6 py-12 text-center text-slate-500"
                          >
                            Loading…
                          </td>
                        </tr>
                      ) : itemsPaginated.length === 0 ? (
                        <tr>
                          <td
                            colSpan={itemsTableLeadingCols + ITEMS_COLUMNS.length}
                            className="px-6 py-12 text-center text-slate-500"
                          >
                            No items found.
                          </td>
                        </tr>
                      ) : (
                        itemsPaginated.map((item) => {
                          const itemView = itemDetailsById[item.id] || item
                          return (
                          <React.Fragment key={item.id}>
                            <tr
                              className={`transition-colors cursor-pointer [&>td]:border-b [&>td]:border-slate-200/80 ${expandedItemId === item.id ? 'bg-indigo-50/60' : 'hover:bg-white/60'}`}
                              onClick={() => setExpandedItemId((prev) => (prev === item.id ? null : item.id))}
                            >
                              {showItemBulkCheckboxes && (
                                <td className="px-2 sm:px-3 py-3 sm:py-4" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedItemIds.has(item.id)}
                                    onChange={() => toggleItemSelection(item.id)}
                                    className="rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                                  />
                                </td>
                              )}
                              <td className="px-2 sm:px-3 py-3 sm:py-4 text-slate-500" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => setExpandedItemId((prev) => (prev === item.id ? null : item.id))}
                                  className="p-1 rounded-lg hover:bg-white/80 transition-colors"
                                  aria-label={expandedItemId === item.id ? 'Collapse row' : 'Expand row'}
                                >
                                  <i className={`ri-arrow-down-s-line text-lg transition-transform ${expandedItemId === item.id ? 'rotate-180' : ''}`}></i>
                                </button>
                              </td>
                              {visibleColumnsItems.name && (
                                <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium text-slate-900 min-w-0 max-w-[220px] md:max-w-[320px] break-words [overflow-wrap:anywhere]">{item.name || '—'}</td>
                              )}
                              {visibleColumnsItems.createdAt && (
                                <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-slate-600">{formatDateTime(item.createdDate)}</td>
                              )}
                              {visibleColumnsItems.fullName && (
                                <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-slate-700 min-w-0 max-w-[200px] md:max-w-[260px] break-words [overflow-wrap:anywhere]">{item.fullName || '—'}</td>
                              )}
                              {visibleColumnsItems.emailId && (
                                <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-slate-700 min-w-0 max-w-[220px]">
                                  {item.emailId ? (
                                    <a
                                      href={`mailto:${item.emailId}`}
                                      className="text-brand-blue hover:underline block min-w-0 max-w-full truncate"
                                      title={String(item.emailId)}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {item.emailId}
                                    </a>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              )}
                              {visibleColumnsItems.message && (
                                <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-slate-600 max-w-[200px] truncate">{item.message || '—'}</td>
                              )}
                            </tr>
                            {expandedItemId === item.id && (
                              <tr>
                                <td
                                  colSpan={itemsTableLeadingCols + ITEMS_COLUMNS.length}
                                  className="p-0 align-top bg-gray-50/80 border-b border-gray-200"
                                >
                                  <div className="px-3 sm:px-4 py-3 sm:py-4">
                                      <div className="space-y-4">
                                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 min-w-0">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4 min-w-0">
                                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className="w-10 h-10 shrink-0 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
                                                  {(itemView.fullName || '?').charAt(0)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</p>
                                                  <p
                                                    className="text-base font-semibold text-gray-900 break-words whitespace-normal [overflow-wrap:anywhere] leading-snug"
                                                    title={itemView.fullName ? String(itemView.fullName) : undefined}
                                                  >
                                                    {itemView.fullName || '—'}
                                                  </p>
                                                  {itemView.name && String(itemView.name) !== String(itemView.fullName || '') ? (
                                                    <p className="mt-1 text-xs text-gray-500 break-words [overflow-wrap:anywhere] leading-snug" title={String(itemView.name)}>
                                                      {itemView.name}
                                                    </p>
                                                  ) : null}
                                                </div>
                                              </div>
                                              <span className={`self-start shrink-0 px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(itemView.status)}`}>
                                                {formatStatusForDisplay(itemView.status) || '—'}
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 min-w-0">
                                              <div className="min-w-0">
                                                <p className="text-xs text-gray-500 mb-1">Website</p>
                                                <p className="text-sm font-semibold text-gray-900 break-words [overflow-wrap:anywhere]" title={itemView.website ? String(itemView.website) : undefined}>
                                                  {itemView.website || '—'}
                                                </p>
                                              </div>
                                              <div className="min-w-0">
                                                <p className="text-xs text-gray-500 mb-1">Created Date</p>
                                                <p className="text-sm font-semibold text-gray-900 break-words">{formatDateTime(itemView.createdDate)}</p>
                                              </div>
                                              <div className="min-w-0">
                                                <p className="text-xs text-gray-500 mb-1">Phone</p>
                                                <p className="text-sm font-semibold text-gray-900 break-words [overflow-wrap:anywhere]">{itemView.phoneNumber || '—'}</p>
                                              </div>
                                              <div className="min-w-0">
                                                <p className="text-xs text-gray-500 mb-1">Email</p>
                                                <p className="text-sm font-semibold text-gray-900 break-words whitespace-normal [overflow-wrap:anywhere]">{itemView.emailId || '—'}</p>
                                              </div>
                                            </div>
                                            <div className="pt-4 border-t border-gray-200 min-w-0">
                                              <p className="text-xs text-gray-500 mb-1">Address</p>
                                              <p className="text-sm text-gray-800 break-words whitespace-normal [overflow-wrap:anywhere]">{itemView.address || '—'}</p>
                                            </div>
                                          </div>
                                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 mb-2">Message</p>
                                            <p className="text-sm text-gray-700 leading-relaxed break-words whitespace-normal [overflow-wrap:anywhere]">{itemView.message || '—'}</p>
                                          </div>
                                          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 mb-2">Bot Summary</p>
                                            <p className="text-sm text-gray-700 leading-relaxed break-words [overflow-wrap:anywhere]">{itemView.botsSummary || 'No summary'}</p>
                                            <div className="mt-3">
                                              <p className="text-xs text-gray-500 mb-1">Recording</p>
                                              <InlineAudioPlayer url={itemView.recordingUrl} />
                                            </div>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-2 pt-1">
                                            <button
                                              type="button"
                                              onClick={() => openLeadPopup(itemView)}
                                              className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-all flex items-center gap-2"
                                            >
                                              <i className="ri-external-link-line"></i>
                                              View Details
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setExpandedItemId(null)}
                                              className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-medium text-sm hover:bg-slate-200 transition-colors"
                                            >
                                              Close
                                            </button>
                                          </div>
                                      </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )})
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === 'items' && !isMdUp && (
                  <MobileLeadCards
                    items={itemsPaginated}
                    loading={itemsLoading && itemList.length === 0}
                    itemDetailsById={itemDetailsById}
                    expandedItemId={expandedItemId}
                    setExpandedItemId={setExpandedItemId}
                    onViewDetails={openLeadPopup}
                    formatDateTime={formatDateTime}
                    getStatusBadgeClass={getStatusBadgeClass}
                    formatStatusForDisplay={formatStatusForDisplay}
                  />
                )}

                {activeTab === 'tasks' && isMdUp && (
                  <table className="w-full bg-white/60 border border-slate-300/70">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-200/80 via-slate-100/80 to-indigo-100/60 backdrop-blur-xl border-b border-slate-300/70">
                        <th className="px-2 sm:px-3 py-3 sm:py-4 w-10 text-center" aria-label="Expand row">
                          <span className="text-xs font-bold text-slate-500 uppercase"> </span>
                        </th>
                        {TASKS_COLUMNS.map((col) => (
                          <th
                            key={col.id}
                            className={`px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider ${visibleColumnsTasks[col.id] ? '' : 'hidden'}`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="relative">
                      {tasksLoading && tasksFromApi === null ? (
                        <tr>
                          <td colSpan={tasksTableLeadingCols + TASKS_COLUMNS.length} className="px-6 py-12 text-center text-slate-500">
                            Loading…
                          </td>
                        </tr>
                      ) : tasksPaginated.length === 0 ? (
                        <tr>
                          <td colSpan={tasksTableLeadingCols + TASKS_COLUMNS.length} className="px-6 py-12 text-center text-slate-500">
                            No tasks found.
                          </td>
                        </tr>
                      ) : (
                        tasksPaginated.map((task) => {
                          const taskView = taskDetailsById[task.id] || task
                          return (
                          <React.Fragment key={task.id}>
                            <tr
                              className={`transition-colors cursor-pointer [&>td]:border-b [&>td]:border-slate-200/80 ${expandedTaskId === task.id ? 'bg-indigo-50/60' : 'hover:bg-white/60'}`}
                              onClick={() => setExpandedTaskId((prev) => (prev === task.id ? null : task.id))}
                            >
                              <td className="px-2 sm:px-3 py-3 sm:py-4 text-slate-500" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => setExpandedTaskId((prev) => (prev === task.id ? null : task.id))}
                                  className="p-1 rounded-lg hover:bg-white/80 transition-colors"
                                  aria-label={expandedTaskId === task.id ? 'Collapse row' : 'Expand row'}
                                >
                                  <i className={`ri-arrow-down-s-line text-lg transition-transform ${expandedTaskId === task.id ? 'rotate-180' : ''}`}></i>
                                </button>
                              </td>
                              {visibleColumnsTasks.name && (
                                <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium text-slate-900 min-w-0 max-w-[220px] md:max-w-[320px] break-words [overflow-wrap:anywhere]">{task.name || '—'}</td>
                              )}
                              {visibleColumnsTasks.createdAt && (
                                <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-slate-600">{formatDateTime(task.createdDate)}</td>
                              )}
                              {visibleColumnsTasks.createdBy && (
                                <td className="px-3 sm:px-6 py-3 sm:py-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange to-amber-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                      {task.createdByInitials || 'U'}
                                    </div>
                                    <span className="text-sm text-slate-700">{task.createdBy || '—'}</span>
                                  </div>
                                </td>
                              )}
                              {visibleColumnsTasks.status && (
                                <td className="px-3 sm:px-6 py-3 sm:py-4">
                                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${getStatusBadgeClass(task.status)}`}>
                                    {formatStatusForDisplay(task.status) || 'In progress'}
                                  </span>
                                </td>
                              )}
                              {visibleColumnsTasks.fullName && (
                                <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-slate-700 min-w-0 max-w-[200px] md:max-w-[260px] break-words [overflow-wrap:anywhere]">{task.fullName || '—'}</td>
                              )}
                            </tr>
                            {expandedTaskId === task.id && (
                              <tr>
                                <td colSpan={tasksTableLeadingCols + TASKS_COLUMNS.length} className="p-0 align-top bg-gray-50/80 border-b border-gray-200">
                                  <div className="px-3 sm:px-4 py-3 sm:py-4">
                                      <div className="space-y-4">
                                        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 min-w-0">
                                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4 min-w-0">
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                              <div className="w-10 h-10 shrink-0 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
                                                {(taskView.fullName || '?').charAt(0)}
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</p>
                                                <p
                                                  className="text-base font-semibold text-gray-900 break-words whitespace-normal [overflow-wrap:anywhere] leading-snug"
                                                  title={taskView.fullName ? String(taskView.fullName) : undefined}
                                                >
                                                  {taskView.fullName || '—'}
                                                </p>
                                                {taskView.name && String(taskView.name) !== String(taskView.fullName || '') ? (
                                                  <p className="mt-1 text-xs text-gray-500 break-words [overflow-wrap:anywhere] leading-snug" title={String(taskView.name)}>
                                                    {taskView.name}
                                                  </p>
                                                ) : null}
                                              </div>
                                            </div>
                                            <span className={`self-start shrink-0 px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(taskView.status)}`}>
                                              {formatStatusForDisplay(taskView.status) || '—'}
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 min-w-0">
                                            <div className="min-w-0">
                                              <p className="text-xs text-gray-500 mb-1">Website</p>
                                              <p className="text-sm font-semibold text-gray-900 break-words [overflow-wrap:anywhere]" title={taskView.website ? String(taskView.website) : undefined}>
                                                {taskView.website || '—'}
                                              </p>
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-xs text-gray-500 mb-1">Created Date</p>
                                              <p className="text-sm font-semibold text-gray-900 break-words">{formatDateTime(taskView.createdDate)}</p>
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-xs text-gray-500 mb-1">Phone</p>
                                              <p className="text-sm font-semibold text-gray-900 break-words [overflow-wrap:anywhere]">{taskView.phoneNumber || '—'}</p>
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-xs text-gray-500 mb-1">Email</p>
                                              <p className="text-sm font-semibold text-gray-900 break-words whitespace-normal [overflow-wrap:anywhere]">{taskView.emailId || '—'}</p>
                                            </div>
                                          </div>
                                          <div className="pt-4 border-t border-gray-200 min-w-0">
                                            <p className="text-xs text-gray-500 mb-1">Address</p>
                                            <p className="text-sm text-gray-800 break-words whitespace-normal [overflow-wrap:anywhere]">{taskView.address || '—'}</p>
                                          </div>
                                        </div>
                                        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 min-w-0">
                                          <p className="text-sm font-semibold text-gray-800 mb-2">Message</p>
                                          <p className="text-sm text-gray-700 leading-relaxed break-words whitespace-normal [overflow-wrap:anywhere]">{taskView.message || '—'}</p>
                                        </div>
                                        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 min-w-0">
                                          <p className="text-sm font-semibold text-gray-800 mb-2">Bot Summary</p>
                                          <p className="text-sm text-gray-700 leading-relaxed break-words [overflow-wrap:anywhere]">{taskView.botsSummary || 'No summary'}</p>
                                          <div className="mt-3">
                                            <p className="text-xs text-gray-500 mb-1">Recording</p>
                                            <InlineAudioPlayer url={taskView.recordingUrl} />
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                          <button
                                            type="button"
                                            onClick={() => openLeadPopup(task)}
                                            className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-all flex items-center gap-2"
                                          >
                                            <i className="ri-external-link-line"></i>
                                            View Details
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setExpandedTaskId(null)}
                                            className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-medium text-sm hover:bg-slate-200 transition-colors"
                                          >
                                            Close
                                          </button>
                                        </div>
                                      </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )})
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === 'tasks' && !isMdUp && (
                  <MobileTaskCards
                    tasks={tasksPaginated}
                    tasksInitialLoading={tasksLoading && tasksFromApi === null}
                    taskDetailsById={taskDetailsById}
                    expandedTaskId={expandedTaskId}
                    setExpandedTaskId={setExpandedTaskId}
                    onViewDetails={openLeadPopup}
                    formatDateTime={formatDateTime}
                    getStatusBadgeClass={getStatusBadgeClass}
                    formatStatusForDisplay={formatStatusForDisplay}
                  />
                )}
              </div>

              {/* Pagination */}
              <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-slate-200/70 via-slate-100/80 to-indigo-100/60 backdrop-blur-xl border-t border-slate-300/70 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <label htmlFor="rows-per-page-select" className="text-xs sm:text-sm text-slate-600 font-medium whitespace-nowrap">
                    Rows per page:
                  </label>
                  <select
                    id="rows-per-page-select"
                    value={Number(rowsPerPage)}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      if (val === rowsPerPage) return
                      setRowsPerPage(val)
                      setItemsPage(1)
                      setTasksPage(1)
                    }}
                    className="min-h-[44px] min-w-[72px] pl-3 pr-8 py-2 text-sm font-medium bg-white/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue cursor-pointer touch-manipulation hover:bg-white transition-colors"
                    aria-label="Rows per page"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-end">
                  <span className="text-xs sm:text-sm text-slate-600 text-center sm:text-left break-words max-w-full">
                    {activeTab === 'items'
                      ? `Showing ${(itemsPage - 1) * rowsPerPage + 1} to ${(itemsPage - 1) * rowsPerPage + itemsPaginated.length} out of ${filteredItemsAfterKpi.length} Items`
                      : `Showing ${(tasksPage - 1) * rowsPerPage + 1} to ${(tasksPage - 1) * rowsPerPage + tasksPaginated.length} out of ${filteredTasks.length} Items`}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={activeTab === 'items' ? itemsPage <= 1 : tasksPage <= 1}
                      onClick={() => (activeTab === 'items' ? setItemsPage((p) => Math.max(1, p - 1)) : setTasksPage((p) => Math.max(1, p - 1)))}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/80 border border-slate-200/80 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-all touch-manipulation text-lg font-semibold leading-none"
                      aria-label="Previous page"
                    >
                      <span className="max-md:inline md:hidden" aria-hidden>«</span>
                      <i className="ri-arrow-left-s-line text-lg max-md:hidden"></i>
                    </button>
                    <span className="md:hidden min-w-[2.5rem] text-center text-sm font-bold text-slate-800 tabular-nums px-1">
                      {activeTab === 'items' ? itemsPage : tasksPage}
                    </span>
                    <div className="hidden md:contents">
                      {activeTab === 'items' &&
                        Array.from({ length: totalItemsPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setItemsPage(p)}
                            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-sm font-bold transition-all touch-manipulation ${
                              itemsPage === p
                                ? 'bg-gradient-to-br from-brand-blue to-indigo-600 text-white shadow-lg'
                                : 'bg-white/80 border border-slate-200/80 text-slate-700 hover:bg-white'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      {activeTab === 'tasks' &&
                        Array.from({ length: totalTasksPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setTasksPage(p)}
                            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-sm font-bold transition-all touch-manipulation ${
                              tasksPage === p
                                ? 'bg-gradient-to-br from-brand-blue to-indigo-600 text-white shadow-lg'
                                : 'bg-white/80 border border-slate-200/80 text-slate-700 hover:bg-white'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                    </div>
                    <button
                      type="button"
                      disabled={activeTab === 'items' ? itemsPage >= totalItemsPages : tasksPage >= totalTasksPages}
                      onClick={() =>
                        activeTab === 'items'
                          ? setItemsPage((p) => Math.min(totalItemsPages, p + 1))
                          : setTasksPage((p) => Math.min(totalTasksPages, p + 1))
                      }
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/80 border border-slate-200/80 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-all touch-manipulation text-lg font-semibold leading-none"
                      aria-label="Next page"
                    >
                      <span className="max-md:inline md:hidden" aria-hidden>»</span>
                      <i className="ri-arrow-right-s-line text-lg max-md:hidden"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {selectedLead && (
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-y-auto"
                style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
                onClick={() => setSelectedLead(null)}
              >
                <div
                  className="backdrop-blur-xl bg-white/95 border border-white/40 rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] sm:max-h-[85vh] overflow-y-auto p-6 sm:p-8 animate-scale-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent">Lead Details</h3>
                    <button
                      type="button"
                      onClick={() => setSelectedLead(null)}
                      className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      <i className="ri-close-line text-xl text-slate-700"></i>
                    </button>
                  </div>
                  <div className="space-y-4 min-w-0">
                    <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-xl border border-blue-200/50 min-w-0">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Full Name</p>
                      <p className="text-lg font-bold text-slate-900 break-words whitespace-normal [overflow-wrap:anywhere]" title={selectedLead.fullName ? String(selectedLead.fullName) : undefined}>
                        {selectedLead.fullName || '—'}
                      </p>
                      {selectedLead.name && String(selectedLead.name) !== String(selectedLead.fullName || '') ? (
                        <p className="mt-2 text-xs text-slate-600 break-words [overflow-wrap:anywhere]" title={String(selectedLead.name)}>
                          {selectedLead.name}
                        </p>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-gradient-to-r from-teal-50/80 to-cyan-50/80 rounded-xl border border-teal-200/50 min-w-0">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Phone</p>
                        <p className="text-sm font-bold text-slate-900 break-words [overflow-wrap:anywhere]">{selectedLead.phoneNumber || '—'}</p>
                      </div>
                      <div className="p-4 bg-gradient-to-r from-purple-50/80 to-pink-50/80 rounded-xl border border-purple-200/50 min-w-0">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Website</p>
                        <p className="text-sm font-bold text-slate-900 break-words [overflow-wrap:anywhere]" title={selectedLead.website ? String(selectedLead.website) : undefined}>
                          {selectedLead.website || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-amber-50/80 to-orange-50/80 rounded-xl border border-amber-200/50 min-w-0">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Email</p>
                      <p className="text-sm font-bold text-slate-900 break-words whitespace-normal [overflow-wrap:anywhere]">{selectedLead.emailId || '—'}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-rose-50/80 to-pink-50/80 rounded-xl border border-rose-200/50 min-w-0">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Address</p>
                      <p className="text-sm font-bold text-slate-900 break-words whitespace-normal [overflow-wrap:anywhere]">{selectedLead.address || '—'}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-slate-50/80 to-gray-50/80 rounded-xl border border-slate-200/50 min-w-0">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Message</p>
                      <p className="text-sm text-slate-700 leading-relaxed break-words whitespace-normal [overflow-wrap:anywhere]">{selectedLead.message || '—'}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 rounded-xl border border-indigo-200/50 min-w-0">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Created Date</p>
                        <p className="text-sm font-bold text-slate-900 break-words">{formatDateTime(selectedLead.createdDate)}</p>
                      </div>
                      <div className="p-4 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 rounded-xl border border-emerald-200/50 min-w-0">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Status</p>
                        <p className="text-sm font-bold text-slate-900 break-words">{selectedLead.status || '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  )
}
