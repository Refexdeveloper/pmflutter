import AppLayout from '../../components/feature/AppLayout'
import PtSelect from '../../components/PtSelect.jsx'
import TablePaginationBar, { PT_TABLE_PAGE_SIZE } from '../../components/TablePaginationBar.jsx'
import {
  TableColumnHeader,
  distinctFilterOptions,
  toggleSortState,
  compareText,
  compareNumber,
} from '../../components/TableColumnHeaders.jsx'
import { useContext, useEffect, useMemo, useState, useRef, useCallback, forwardRef } from 'react'
import { ProjectTrackerEmbedContext } from '@/contexts/ProjectTrackerEmbedContext.jsx'
import { KissflowSDKContext, kf } from '@/sdk/index.js'
import { fetchProjectDashboardData } from '@/lib/kfProjectDashboard'
import { motion } from 'framer-motion'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const OWNER_PERF_COLUMNS = [
  { key: 'owner', label: 'Owner', filter: 'owner' },
  { key: 'projects', label: 'Projects' },
  { key: 'avg', label: 'Avg %' },
  { key: 'red', label: 'Red' },
  { key: 'onTimePct', label: 'On Time%' },
  { key: 'avgDelay', label: 'Avg Delay' },
]

const DEPT_PERF_COLUMNS = [
  { key: 'department', label: 'Department', filter: 'department' },
  { key: 'count', label: 'Count' },
  { key: 'avg', label: 'Avg %' },
  { key: 'ragScore', label: 'RAG Score' },
  { key: 'budget', label: 'Budget Util' },
]

const ALL_PROJECTS_COLUMNS = [
  { key: 'name', label: 'Project', filter: 'project' },
  { key: 'entity', label: 'Entity', filter: 'entity' },
  { key: 'department', label: 'Department', filter: 'department' },
  { key: 'owner', label: 'Owner', filter: 'owner' },
  { key: 'rag', label: 'RAG', filter: 'rag' },
  { key: 'progress', label: 'Progress' },
  { key: 'delayDays', label: 'Delay' },
  { key: 'status', label: 'Status', filter: 'status' },
]

const RAG_FILTER_OPTIONS = [
  { value: 'all', label: 'All RAG' },
  { value: 'Green', label: 'Green' },
  { value: 'Amber', label: 'Amber' },
  { value: 'Red', label: 'Red' },
]

const RAG = {
  Green: '#43A047',
  Amber: '#FB8C00',
  Red: '#E53935',
}

const BRAND = '#1E88E5'

function round(v) {
  return Math.round(Number(v) || 0)
}

function monthLabel(d) {
  if (!d || d === '—') return ''
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return ''
  return x.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function normalizeRag(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (s.includes('red') || s.includes('critical')) return 'Red'
  if (s.includes('amber') || s.includes('yellow') || s.includes('risk')) return 'Amber'
  if (s.includes('green') || s.includes('track')) return 'Green'
  return 'Green'
}

const SectionCard = forwardRef(function SectionCard({ children, className = '' }, ref) {
  return (
    <div
      ref={ref}
      className={`overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl ${className}`}
    >
      {children}
    </div>
  )
})

function SectionHead({ title, subtitle, action = null }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/40 px-3 py-3 sm:px-5 sm:py-4">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-800 sm:text-base">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

function EmptyChart({ label = 'No data yet' }) {
  return (
    <div className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-2 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <i className="ri-bar-chart-2-line text-lg" aria-hidden />
      </span>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  )
}

function KpiCard({ title, value, sub, tone, icon, index = 0, active = false, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 320, damping: 28 }}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`group relative w-full overflow-hidden rounded-2xl border bg-gradient-to-br from-white via-white to-slate-50/80 p-3.5 text-left shadow-md shadow-slate-200/40 sm:p-4 ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      } ${active ? 'border-[#1E88E5] ring-2 ring-[#1E88E5]/35' : 'border-slate-200/88'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1E88E5]/10 text-[#1E88E5]">
          <i className={`${icon} text-sm`} aria-hidden />
        </span>
      </div>
      <p className={`mt-2 text-2xl font-bold leading-none sm:text-3xl ${tone}`}>{value}</p>
      <p className="mt-1.5 text-[11px] font-medium text-slate-500 sm:text-xs">{sub}</p>
      {onClick ? (
        <p className="mt-1.5 text-[10px] font-semibold text-[#1E88E5] opacity-0 transition-opacity group-hover:opacity-100">
          Click to view →
        </p>
      ) : null}
    </motion.button>
  )
}

const REPORTS_KPI_FOCUS = {
  total: { rag: 'all', delayOnly: false },
  'on-track': { rag: 'Green', delayOnly: false },
  'at-risk': { rag: 'Amber', delayOnly: false },
  critical: { rag: 'Red', delayOnly: false },
  delayed: { rag: 'all', delayOnly: true },
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-[11px] font-semibold text-slate-700">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-[11px] font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  )
}

function RagBadge({ rag }) {
  const color = RAG[rag] || RAG.Green
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {rag}
    </span>
  )
}

export default function ReportsPage({ useLayout = true }) {
  const { embed } = useContext(ProjectTrackerEmbedContext)
  const useChromeLayout = useLayout && !embed
  const { kf: kfFromContext } = useContext(KissflowSDKContext)
  const kfInstance =
    kfFromContext ??
    (typeof window !== 'undefined' ? window.kf : null) ??
    (typeof kf !== 'undefined' ? kf : null)

  const [apiRows, setApiRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [search, setSearch] = useState('')
  const [entity, setEntity] = useState('All Entities')
  const [department, setDepartment] = useState('All Departments')
  const [owner, setOwner] = useState('All Owners')
  const [entityFocus, setEntityFocus] = useState('All')
  const [tablePage, setTablePage] = useState(1)
  const [ragFocus, setRagFocus] = useState('all')
  const [delayOnly, setDelayOnly] = useState(false)
  const [insightFocus, setInsightFocus] = useState(null)
  const [projectNameFilter, setProjectNameFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ownerSortKey, setOwnerSortKey] = useState('projects')
  const [ownerSortDir, setOwnerSortDir] = useState('desc')
  const [deptSortKey, setDeptSortKey] = useState('count')
  const [deptSortDir, setDeptSortDir] = useState('desc')
  const [projSortKey, setProjSortKey] = useState('name')
  const [projSortDir, setProjSortDir] = useState('asc')
  const tableSectionRef = useRef(null)
  const insightPulseTimerRef = useRef(null)

  const handleEntityBarClick = (barState) => {
    const key = barState?.payload?.entity || barState?.entity || null
    if (key) setEntityFocus(key)
  }

  useEffect(() => {
    let cancelled = false
    let retryTimer = null
    const run = async (attempt = 0) => {
      try {
        const liveKf =
          kfInstance ??
          (typeof window !== 'undefined' ? window.kf : null) ??
          (typeof kf !== 'undefined' ? kf : null)
        if (!liveKf?.api && attempt < 6) {
          retryTimer = setTimeout(() => {
            if (!cancelled) run(attempt + 1)
          }, 700)
          return
        }
        setLoading(true)
        setFetchError('')
        const { rows } = await fetchProjectDashboardData(liveKf)
        if (!cancelled) {
          setApiRows(rows || [])
          if (!rows || rows.length === 0) setFetchError('No rows returned from API')
        }
      } catch (error) {
        if (!cancelled) {
          setApiRows([])
          setFetchError(error?.message || 'Failed to fetch report data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [kfInstance])

  const PROJECTS = useMemo(
    () =>
      (apiRows || []).map((row) => ({
        id: row.displayId || row.id,
        name: row.name,
        entity: row.entity && row.entity !== 'N/A' ? row.entity : row.lineOfBusiness || 'Unspecified',
        department:
          row.department && row.department !== 'N/A' ? row.department : row.lineOfBusiness || 'Unspecified',
        owner: row.owner || 'Unassigned',
        ownerAvatar: row.ownerAvatar || 'NA',
        rag: normalizeRag(row.rag),
        progress: Number(row.progress || 0),
        delayDays: Number(row.delayDays || 0),
        budget: '—',
        budgetUtil: 0,
        status: row.status || 'Active',
        start: row.startDate || '—',
        end: row.originalEndDate || '—',
        revisedEnd: row.revisedEndDate || row.originalEndDate || '—',
      })),
    [apiRows],
  )

  const filteredProjects = useMemo(() => {
    return PROJECTS.filter((p) => {
      if (entity !== 'All Entities' && p.entity !== entity) return false
      if (department !== 'All Departments' && p.department !== department) return false
      if (owner !== 'All Owners' && p.owner !== owner) return false
      if (entityFocus !== 'All' && p.entity !== entityFocus) return false
      if (search && !`${p.name} ${p.owner} ${p.id}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [PROJECTS, entity, department, owner, entityFocus, search])

  const tableProjectsBase = useMemo(() => {
    return filteredProjects.filter((p) => {
      if (ragFocus !== 'all' && p.rag !== ragFocus) return false
      if (delayOnly && !(Number(p.delayDays) > 0)) return false
      if (projectNameFilter !== 'all' && p.name !== projectNameFilter) return false
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      return true
    })
  }, [filteredProjects, ragFocus, delayOnly, projectNameFilter, statusFilter])

  const tableProjects = useMemo(() => {
    const copy = [...tableProjectsBase]
    const dir = projSortDir === 'asc' ? 1 : -1
    copy.sort((a, b) => {
      switch (projSortKey) {
        case 'name':
          return compareText(a.name, b.name, dir)
        case 'entity':
          return compareText(a.entity, b.entity, dir)
        case 'department':
          return compareText(a.department, b.department, dir)
        case 'owner':
          return compareText(a.owner, b.owner, dir)
        case 'rag':
          return compareText(a.rag, b.rag, dir)
        case 'progress':
          return compareNumber(a.progress, b.progress, dir)
        case 'delayDays':
          return compareNumber(a.delayDays, b.delayDays, dir)
        case 'status':
          return compareText(a.status, b.status, dir)
        default:
          return 0
      }
    })
    return copy
  }, [tableProjectsBase, projSortKey, projSortDir])

  const handleKpiClick = useCallback((key) => {
    const focus = REPORTS_KPI_FOCUS[key]
    if (!focus) return
    const token = Date.now()
    setRagFocus(focus.rag)
    setDelayOnly(Boolean(focus.delayOnly))
    setTablePage(1)
    setInsightFocus({ key, token, pulse: true })
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = tableSectionRef.current
        if (!el) return
        const top = el.getBoundingClientRect().top + window.scrollY - 24
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      })
    })
    if (insightPulseTimerRef.current) clearTimeout(insightPulseTimerRef.current)
    insightPulseTimerRef.current = setTimeout(() => {
      setInsightFocus((prev) => (prev?.token === token ? { ...prev, pulse: false } : prev))
    }, 2400)
  }, [])

  useEffect(() => () => {
    if (insightPulseTimerRef.current) clearTimeout(insightPulseTimerRef.current)
  }, [])

  const total = filteredProjects.length
  const completedCount = filteredProjects.filter((p) => p.status === 'Completed').length
  const onTrack = filteredProjects.filter((p) => p.rag === 'Green').length
  const atRisk = filteredProjects.filter((p) => p.rag === 'Amber').length
  const critical = filteredProjects.filter((p) => p.rag === 'Red').length
  const avgProgress = total ? round(filteredProjects.reduce((a, b) => a + b.progress, 0) / total) : 0
  const delayedRows = filteredProjects.filter((p) => p.delayDays > 0)
  const avgDelay = delayedRows.length
    ? round(delayedRows.reduce((a, b) => a + b.delayDays, 0) / delayedRows.length)
    : 0

  const entities = useMemo(
    () => ['All Entities', ...Array.from(new Set(PROJECTS.map((p) => p.entity))).filter(Boolean)],
    [PROJECTS],
  )
  const departments = useMemo(
    () => ['All Departments', ...Array.from(new Set(PROJECTS.map((p) => p.department))).filter(Boolean)],
    [PROJECTS],
  )
  const owners = useMemo(
    () => ['All Owners', ...Array.from(new Set(PROJECTS.map((p) => p.owner))).filter(Boolean)],
    [PROJECTS],
  )

  const entityFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Entities' },
      ...entities.filter((x) => x !== 'All Entities').map((x) => ({ value: x, label: x })),
    ],
    [entities],
  )
  const departmentFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Departments' },
      ...departments.filter((x) => x !== 'All Departments').map((x) => ({ value: x, label: x })),
    ],
    [departments],
  )
  const ownerFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Owners' },
      ...owners.filter((x) => x !== 'All Owners').map((x) => ({ value: x, label: x })),
    ],
    [owners],
  )
  const projectNameOptions = useMemo(
    () => distinctFilterOptions(filteredProjects, (p) => p.name, { allLabel: 'All Projects' }),
    [filteredProjects],
  )
  const statusFilterOptions = useMemo(
    () => distinctFilterOptions(filteredProjects, (p) => p.status, { allLabel: 'All Status' }),
    [filteredProjects],
  )

  const handleOwnerSort = useCallback((key) => {
    const next = toggleSortState(ownerSortKey, ownerSortDir, key)
    setOwnerSortKey(next.sortKey)
    setOwnerSortDir(next.sortDir)
  }, [ownerSortKey, ownerSortDir])

  const handleDeptSort = useCallback((key) => {
    const next = toggleSortState(deptSortKey, deptSortDir, key)
    setDeptSortKey(next.sortKey)
    setDeptSortDir(next.sortDir)
  }, [deptSortKey, deptSortDir])

  const handleProjSort = useCallback((key) => {
    const next = toggleSortState(projSortKey, projSortDir, key)
    setProjSortKey(next.sortKey)
    setProjSortDir(next.sortDir)
  }, [projSortKey, projSortDir])

  const syncEntityFilter = useCallback((v) => {
    setEntity(v === 'all' ? 'All Entities' : v)
    setEntityFocus('All')
  }, [])
  const syncDepartmentFilter = useCallback((v) => {
    setDepartment(v === 'all' ? 'All Departments' : v)
  }, [])
  const syncOwnerFilter = useCallback((v) => {
    setOwner(v === 'all' ? 'All Owners' : v)
  }, [])

  // IMPORTANT: depend on filteredProjects so charts/tables refresh after API load + filters
  const entityData = useMemo(() => {
    const map = {}
    filteredProjects.forEach((p) => {
      if (!map[p.entity]) map[p.entity] = { entity: p.entity, Green: 0, Amber: 0, Red: 0, count: 0 }
      map[p.entity][p.rag] += 1
      map[p.entity].count += 1
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [filteredProjects])

  const deptDataRaw = useMemo(() => {
    const map = {}
    filteredProjects.forEach((p) => {
      if (!map[p.department]) {
        map[p.department] = { department: p.department, Green: 0, Amber: 0, Red: 0, count: 0, avg: 0, budget: 0 }
      }
      map[p.department][p.rag] += 1
      map[p.department].count += 1
      map[p.department].avg += p.progress
      map[p.department].budget += p.budgetUtil
    })
    return Object.values(map).map((d) => ({
      ...d,
      avg: round(d.avg / d.count),
      budget: round(d.budget / d.count),
      ragScore: d.Red * 100 + d.Amber * 10,
    }))
  }, [filteredProjects])

  const deptData = useMemo(() => {
    const copy = [...deptDataRaw]
    const dir = deptSortDir === 'asc' ? 1 : -1
    copy.sort((a, b) => {
      switch (deptSortKey) {
        case 'department':
          return compareText(a.department, b.department, dir)
        case 'count':
          return compareNumber(a.count, b.count, dir)
        case 'avg':
          return compareNumber(a.avg, b.avg, dir)
        case 'ragScore':
          return compareNumber(a.ragScore, b.ragScore, dir)
        case 'budget':
          return compareNumber(a.budget, b.budget, dir)
        default:
          return 0
      }
    })
    return copy
  }, [deptDataRaw, deptSortKey, deptSortDir])

  const ownerDataRaw = useMemo(() => {
    const map = {}
    filteredProjects.forEach((p) => {
      if (!map[p.owner]) {
        map[p.owner] = { owner: p.owner, avatar: p.ownerAvatar, projects: 0, avg: 0, red: 0, onTime: 0, delay: 0 }
      }
      map[p.owner].projects += 1
      map[p.owner].avg += p.progress
      map[p.owner].red += p.rag === 'Red' ? 1 : 0
      map[p.owner].onTime += p.delayDays === 0 ? 1 : 0
      map[p.owner].delay += p.delayDays
    })
    return Object.values(map).map((o) => ({
      ...o,
      avg: round(o.avg / o.projects),
      onTimePct: round((o.onTime / o.projects) * 100),
      avgDelay: round(o.delay / o.projects),
    }))
  }, [filteredProjects])

  const ownerData = useMemo(() => {
    const copy = [...ownerDataRaw]
    const dir = ownerSortDir === 'asc' ? 1 : -1
    copy.sort((a, b) => {
      switch (ownerSortKey) {
        case 'owner':
          return compareText(a.owner, b.owner, dir)
        case 'projects':
          return compareNumber(a.projects, b.projects, dir)
        case 'avg':
          return compareNumber(a.avg, b.avg, dir)
        case 'red':
          return compareNumber(a.red, b.red, dir)
        case 'onTimePct':
          return compareNumber(a.onTimePct, b.onTimePct, dir)
        case 'avgDelay':
          return compareNumber(a.avgDelay, b.avgDelay, dir)
        default:
          return 0
      }
    })
    return copy
  }, [ownerDataRaw, ownerSortKey, ownerSortDir])

  const TREND = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1)
      const m = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      return { m, Started: 0, Completed: 0, OnTime: 0 }
    })
    const byKey = Object.fromEntries(months.map((m) => [m.m, m]))
    filteredProjects.forEach((p) => {
      const sm = monthLabel(p.start)
      const em = monthLabel(p.revisedEnd || p.end)
      if (sm && byKey[sm]) byKey[sm].Started += 1
      if (p.status === 'Completed' && em && byKey[em]) {
        byKey[em].Completed += 1
        if (p.delayDays === 0) byKey[em].OnTime += 1
      }
    })
    return months
  }, [filteredProjects])

  const topDelayed = useMemo(
    () => [...filteredProjects].filter((p) => p.delayDays > 0).sort((a, b) => b.delayDays - a.delayDays).slice(0, 8),
    [filteredProjects],
  )
  const gantt = useMemo(
    () => [...filteredProjects].sort((a, b) => b.delayDays - a.delayDays).slice(0, 10),
    [filteredProjects],
  )
  const tableTotalPages = Math.max(1, Math.ceil(tableProjects.length / PT_TABLE_PAGE_SIZE))
  const safeTablePage = Math.min(tablePage, tableTotalPages)
  const pageRows = tableProjects.slice(
    (safeTablePage - 1) * PT_TABLE_PAGE_SIZE,
    safeTablePage * PT_TABLE_PAGE_SIZE,
  )

  useEffect(() => {
    setTablePage(1)
  }, [entity, department, owner, entityFocus, search, ragFocus, delayOnly, projectNameFilter, statusFilter])

  useEffect(() => {
    if (tablePage > tableTotalPages) setTablePage(tableTotalPages)
  }, [tablePage, tableTotalPages])

  const ownerColumnFilterProps = {
    owner: {
      filterValue: owner === 'All Owners' ? 'all' : owner,
      onFilterChange: syncOwnerFilter,
      filterOptions: ownerFilterOptions,
    },
  }

  const deptColumnFilterProps = {
    department: {
      filterValue: department === 'All Departments' ? 'all' : department,
      onFilterChange: syncDepartmentFilter,
      filterOptions: departmentFilterOptions,
    },
  }

  const projectColumnFilterProps = {
    project: {
      filterValue: projectNameFilter,
      onFilterChange: setProjectNameFilter,
      filterOptions: projectNameOptions,
    },
    entity: {
      filterValue: entity === 'All Entities' ? 'all' : entity,
      onFilterChange: syncEntityFilter,
      filterOptions: entityFilterOptions,
    },
    department: {
      filterValue: department === 'All Departments' ? 'all' : department,
      onFilterChange: syncDepartmentFilter,
      filterOptions: departmentFilterOptions,
    },
    owner: {
      filterValue: owner === 'All Owners' ? 'all' : owner,
      onFilterChange: syncOwnerFilter,
      filterOptions: ownerFilterOptions,
    },
    rag: {
      filterValue: ragFocus,
      onFilterChange: setRagFocus,
      filterOptions: RAG_FILTER_OPTIONS,
    },
    status: {
      filterValue: statusFilter,
      onFilterChange: setStatusFilter,
      filterOptions: statusFilterOptions,
    },
  }

  const ragPct = (n) => (total ? round((n / total) * 100) : 0)

  const content = (
    <div className="min-h-screen bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff]">
      <div className="mx-auto max-w-[1800px] space-y-3 p-2 pb-6 sm:space-y-5 sm:p-6">
        {loading ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
            <span className="inline-flex items-center gap-2">
              <i className="ri-loader-4-line animate-spin text-[#1E88E5]" aria-hidden />
              Loading analytics from Kissflow…
            </span>
          </div>
        ) : null}

        {!loading && fetchError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm font-semibold text-amber-900 shadow-sm">
            <span className="inline-flex items-center gap-2">
              <i className="ri-error-warning-line text-amber-600" aria-hidden />
              {fetchError}
            </span>
          </div>
        ) : null}

        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-30 -mx-2 rounded-2xl border border-white/70 bg-white/80 p-3.5 shadow-lg shadow-slate-200/30 backdrop-blur-md sm:-mx-6 sm:rounded-3xl sm:p-5 lg:static lg:mx-0"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#1E88E5]">Reports</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Analytics Overview
              </h1>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                {total} projects in view · click entity bars to filter
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                <i className="ri-calendar-line text-[#1E88E5]" aria-hidden />
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live API
              </span>
            </div>
          </div>
        </motion.header>

        <SectionCard>
          <SectionHead title="Portfolio filters" subtitle="Narrow the analytics by entity, department, or owner" />
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Entity</span>
              <PtSelect
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                className="w-full"
                aria-label="Filter by entity"
                options={entities.map((x) => ({ value: x, label: x }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Department</span>
              <PtSelect
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full"
                aria-label="Filter by department"
                options={departments.map((x) => ({ value: x, label: x }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Owner</span>
              <PtSelect
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full"
                aria-label="Filter by owner"
                options={owners.map((x) => ({ value: x, label: x }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Search</span>
              <div className="relative">
                <i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Projects, owners…"
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 shadow-sm outline-none focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/15"
                />
              </div>
            </label>
          </div>
          {entityFocus !== 'All' ? (
            <div className="border-t border-slate-100 px-4 py-2.5">
              <button
                type="button"
                onClick={() => setEntityFocus('All')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-blue-50"
              >
                <i className="ri-close-circle-line text-[#1E88E5]" aria-hidden />
                Clear entity focus: {entityFocus}
              </button>
            </div>
          ) : null}
        </SectionCard>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-5">
          <KpiCard
            index={0}
            title="Total Projects"
            value={total}
            sub={`${completedCount} completed · ${avgProgress}% avg progress`}
            tone="text-[#1E88E5]"
            icon="ri-folder-3-line"
            active={insightFocus?.key === 'total'}
            onClick={() => handleKpiClick('total')}
          />
          <KpiCard
            index={1}
            title="On Track"
            value={onTrack}
            sub={`${ragPct(onTrack)}% of portfolio`}
            tone="text-[#43A047]"
            icon="ri-checkbox-circle-line"
            active={insightFocus?.key === 'on-track'}
            onClick={() => handleKpiClick('on-track')}
          />
          <KpiCard
            index={2}
            title="At Risk"
            value={atRisk}
            sub={`${ragPct(atRisk)}% need attention`}
            tone="text-[#FB8C00]"
            icon="ri-error-warning-line"
            active={insightFocus?.key === 'at-risk'}
            onClick={() => handleKpiClick('at-risk')}
          />
          <KpiCard
            index={3}
            title="Critical"
            value={critical}
            sub={avgDelay ? `Avg delay ${avgDelay}d` : 'No current delays'}
            tone="text-[#E53935]"
            icon="ri-alarm-warning-line"
            active={insightFocus?.key === 'critical'}
            onClick={() => handleKpiClick('critical')}
          />
          <KpiCard
            index={4}
            title="Delayed"
            value={delayedRows.length}
            sub={`${ragPct(delayedRows.length)}% behind schedule`}
            tone="text-slate-800"
            icon="ri-time-line"
            active={insightFocus?.key === 'delayed'}
            onClick={() => handleKpiClick('delayed')}
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <SectionCard>
              <SectionHead title="Entity Distribution" subtitle="Projects by business entity · stacked RAG · click a bar to filter" />
              <div className="h-56 p-3 sm:h-64 sm:p-4">
                {entityData.length === 0 ? (
                  <EmptyChart label="No entity data for the current filters" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={entityData} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="entity" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(30,136,229,0.06)' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Green" name="On Track" stackId="a" fill={RAG.Green} onClick={handleEntityBarClick} cursor="pointer" />
                      <Bar dataKey="Amber" name="At Risk" stackId="a" fill={RAG.Amber} onClick={handleEntityBarClick} cursor="pointer" />
                      <Bar dataKey="Red" name="Critical" stackId="a" fill={RAG.Red} radius={[4, 4, 0, 0]} onClick={handleEntityBarClick} cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </SectionCard>

            <SectionCard>
              <SectionHead
                title="Entity Portfolio Share"
                subtitle="Share of projects, progress, and risk mix by entity"
              />
              <div className="space-y-3 p-3 sm:p-4">
                {entityData.length === 0 ? (
                  <EmptyChart label="No entity breakdown available" />
                ) : (
                  entityData.map((row) => {
                    const share = total ? Math.round((row.count / total) * 100) : 0
                    const greenPct = row.count ? Math.round((row.Green / row.count) * 100) : 0
                    const amberPct = row.count ? Math.round((row.Amber / row.count) * 100) : 0
                    const redPct = row.count ? Math.round((row.Red / row.count) * 100) : 0
                    const isFocused = entityFocus === row.entity
                    return (
                      <button
                        key={row.entity}
                        type="button"
                        onClick={() => setEntityFocus(isFocused ? 'All' : row.entity)}
                        className={`w-full rounded-2xl border p-3 text-left transition hover:border-[#1E88E5]/35 hover:bg-blue-50/50 ${
                          isFocused
                            ? 'border-[#1E88E5]/45 bg-blue-50/70 shadow-sm'
                            : 'border-slate-100 bg-slate-50/60'
                        }`}
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-800 sm:text-sm">{row.entity}</p>
                            <p className="text-[11px] text-slate-500">
                              {row.count} project{row.count === 1 ? '' : 's'} · {share}% of view
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-bold">
                            <span style={{ color: RAG.Green }}>{row.Green} G</span>
                            <span style={{ color: RAG.Amber }}>{row.Amber} A</span>
                            <span style={{ color: RAG.Red }}>{row.Red} R</span>
                          </div>
                        </div>
                        <div className="mb-1.5 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
                          <div className="flex h-full w-full">
                            <div style={{ width: `${greenPct}%`, backgroundColor: RAG.Green }} />
                            <div style={{ width: `${amberPct}%`, backgroundColor: RAG.Amber }} />
                            <div style={{ width: `${redPct}%`, backgroundColor: RAG.Red }} />
                          </div>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                          <div
                            className="h-full rounded-full bg-[#1E88E5] transition-all"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-4">
            <SectionCard>
              <SectionHead title="RAG Status" subtitle="Portfolio health overview" />
              <div className="space-y-3 p-3 sm:p-4">
                {[
                  { name: 'On Track', value: onTrack, color: RAG.Green },
                  { name: 'At Risk', value: atRisk, color: RAG.Amber },
                  { name: 'Critical', value: critical, color: RAG.Red },
                ].map((item) => (
                  <div key={item.name}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600">{item.name}</span>
                      <span className="text-sm font-bold" style={{ color: item.color }}>
                        {item.value}
                        <span className="ml-1 text-[10px] font-semibold text-slate-400">{ragPct(item.value)}%</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${ragPct(item.value)}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard>
              <SectionHead title="Department Performance" subtitle="Stacked by RAG status" />
              <div className="h-44 p-3 sm:p-4">
                {deptData.length === 0 ? (
                  <EmptyChart label="No department data" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptData.slice(0, 8)} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="department" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="Green" stackId="a" fill={RAG.Green} />
                      <Bar dataKey="Amber" stackId="a" fill={RAG.Amber} />
                      <Bar dataKey="Red" stackId="a" fill={RAG.Red} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </SectionCard>

            <SectionCard>
              <SectionHead title="Completion Trend" subtitle="Monthly project activity" />
              <div className="h-40 p-3 sm:p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={TREND} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="Completed" stroke={RAG.Green} strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="OnTime" stroke={BRAND} strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Started" stroke={RAG.Amber} strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SectionCard>
            <SectionHead
              title="Project Owner Performance"
              subtitle={`${ownerData.length} active owners`}
            />
            <div className="overflow-x-auto">
              {ownerData.length === 0 ? (
                <div className="p-8">
                  <EmptyChart label="No owners for the current filters" />
                </div>
              ) : (
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr className="bg-slate-50/90">
                      {OWNER_PERF_COLUMNS.map((col) => {
                        const filterCfg = col.filter ? ownerColumnFilterProps[col.filter] : null
                        return (
                          <TableColumnHeader
                            key={col.key}
                            col={col}
                            sortKey={ownerSortKey}
                            sortDir={ownerSortDir}
                            onSort={handleOwnerSort}
                            filterValue={filterCfg?.filterValue}
                            filterOptions={filterCfg?.filterOptions}
                            onFilterChange={filterCfg?.onFilterChange}
                            className="px-3 py-2.5 sm:px-4"
                          />
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {ownerData.map((o) => (
                      <tr key={o.owner} className="border-t border-slate-100 hover:bg-blue-50/40">
                        <td className="px-3 py-2.5 sm:px-4">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E88E5]/12 text-[10px] font-bold text-[#1E88E5]">
                              {String(o.avatar || o.owner || '?').slice(0, 2).toUpperCase()}
                            </span>
                            <span className="text-xs font-semibold text-slate-800">{o.owner}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-medium text-slate-700 sm:px-4">{o.projects}</td>
                        <td className="px-3 py-2.5 text-xs font-bold text-slate-800 sm:px-4">{o.avg}%</td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-red-600 sm:px-4">{o.red || '—'}</td>
                        <td className="px-3 py-2.5 text-xs font-medium text-slate-700 sm:px-4">{o.onTimePct}%</td>
                        <td className="px-3 py-2.5 text-xs font-medium text-slate-700 sm:px-4">
                          {o.avgDelay ? `+${o.avgDelay}d` : 'On time'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </SectionCard>

          <SectionCard>
            <SectionHead
              title="Department Performance"
              subtitle={`${deptData.length} departments tracked`}
            />
            <div className="overflow-x-auto">
              {deptData.length === 0 ? (
                <div className="p-8">
                  <EmptyChart label="No departments for the current filters" />
                </div>
              ) : (
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="bg-slate-50/90">
                      {DEPT_PERF_COLUMNS.map((col) => {
                        const filterCfg = col.filter ? deptColumnFilterProps[col.filter] : null
                        return (
                          <TableColumnHeader
                            key={col.key}
                            col={col}
                            sortKey={deptSortKey}
                            sortDir={deptSortDir}
                            onSort={handleDeptSort}
                            filterValue={filterCfg?.filterValue}
                            filterOptions={filterCfg?.filterOptions}
                            onFilterChange={filterCfg?.onFilterChange}
                            className="px-3 py-2.5 sm:px-4"
                          />
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {deptData.map((d) => (
                      <tr key={d.department} className="border-t border-slate-100 hover:bg-blue-50/40">
                        <td className="px-3 py-2.5 text-xs font-semibold text-slate-800 sm:px-4">{d.department}</td>
                        <td className="px-3 py-2.5 text-xs font-medium text-slate-700 sm:px-4">{d.count}</td>
                        <td className="px-3 py-2.5 text-xs font-bold text-slate-800 sm:px-4">{d.avg}%</td>
                        <td className="px-3 py-2.5 text-xs font-medium sm:px-4">
                          {d.Red ? (
                            <span className="text-red-600">{d.Red} Red</span>
                          ) : d.Amber ? (
                            <span className="text-amber-600">{d.Amber} Amber</span>
                          ) : (
                            <span className="text-emerald-600">All Green</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-medium text-slate-500 sm:px-4">
                          {d.budget ? `${d.budget}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </SectionCard>
        </div>

        <SectionCard>
          <SectionHead title="Project Timeline" subtitle="Top 10 by delay · progress bars" />
          <div className="space-y-2.5 p-3 sm:p-4">
            {gantt.length === 0 ? (
              <EmptyChart label="No projects to show on the timeline" />
            ) : (
              gantt.map((p) => (
                <div key={p.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,220px)_1fr_56px] sm:gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{p.name}</p>
                    <p className="text-[10px] text-slate-500">{p.id}</p>
                  </div>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all"
                      style={{
                        width: `${Math.max(8, Math.min(100, p.progress))}%`,
                        backgroundColor: RAG[p.rag] || BRAND,
                      }}
                    />
                  </div>
                  <div className="text-right text-xs font-bold text-slate-700">
                    {p.delayDays ? `+${p.delayDays}d` : '✓'}
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHead title="Top Delayed Projects" subtitle={`${topDelayed.length} projects behind schedule`} />
          <div className="grid gap-2.5 p-3 sm:grid-cols-2 sm:p-4">
            {topDelayed.length === 0 ? (
              <div className="sm:col-span-2">
                <EmptyChart label="No delayed projects in the current view" />
              </div>
            ) : (
              topDelayed.map((p, i) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/80 to-white p-3.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-lg bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                      #{i + 1}
                    </span>
                    <RagBadge rag={p.rag} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{p.name}</p>
                  <p className="mt-1 text-xs font-semibold text-rose-600">+{p.delayDays} days</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {p.end} → {p.revisedEnd}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {p.owner} · {p.department} · {p.progress}% done
                  </p>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          ref={tableSectionRef}
          className={`transition-[box-shadow,ring] duration-500 ${
            insightFocus?.pulse
              ? 'ring-2 ring-[#1E88E5] ring-offset-2 ring-offset-[#edf1ff] shadow-[0_0_0_6px_rgba(30,136,229,0.12)]'
              : ''
          }`}
        >
          <SectionHead
            title="All Projects"
            subtitle={`${tableProjects.length} projects${tableTotalPages > 1 ? ` · ${PT_TABLE_PAGE_SIZE} per page` : ''}`}
          />
          <div className="overflow-x-auto">
            {pageRows.length === 0 ? (
              <div className="p-8">
                <EmptyChart label="No projects match the current filters" />
              </div>
            ) : (
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50/90">
                    {ALL_PROJECTS_COLUMNS.map((col) => {
                      const filterCfg = col.filter ? projectColumnFilterProps[col.filter] : null
                      return (
                        <TableColumnHeader
                          key={col.key}
                          col={col}
                          sortKey={projSortKey}
                          sortDir={projSortDir}
                          onSort={handleProjSort}
                          filterValue={filterCfg?.filterValue}
                          filterOptions={filterCfg?.filterOptions}
                          onFilterChange={filterCfg?.onFilterChange}
                          className="px-3 py-2.5 sm:px-4"
                        />
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 hover:bg-blue-50/40">
                      <td className="px-3 py-2.5 sm:px-4">
                        <p className="text-xs font-semibold text-slate-800">{p.name}</p>
                        <p className="text-[10px] text-slate-500">{p.id}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-700 sm:px-4">{p.entity}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-700 sm:px-4">{p.department}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-700 sm:px-4">{p.owner}</td>
                      <td className="px-3 py-2.5 sm:px-4">
                        <RagBadge rag={p.rag} />
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold text-slate-800 sm:px-4">{p.progress}%</td>
                      <td className="px-3 py-2.5 text-xs text-slate-700 sm:px-4">
                        {p.delayDays ? `+${p.delayDays}d` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-700 sm:px-4">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <TablePaginationBar total={tableProjects.length} page={safeTablePage} onPageChange={setTablePage} />
        </SectionCard>
      </div>
    </div>
  )

  if (!useChromeLayout) return content
  return <AppLayout>{content}</AppLayout>
}
