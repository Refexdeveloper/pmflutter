import React, { useMemo, useState, useEffect, useRef } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AOS from 'aos'
import 'aos/dist/aos.css'

// ============= Constants =============
const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  background: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  purple: '#8B5CF6',
}

const STATUS_STYLES = {
  Assigned: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Available: 'bg-blue-50 text-blue-700 border-blue-200',
  Maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
  Retired: 'bg-slate-100 text-slate-600 border-slate-200',
}

const MOCK_ASSETS = [
  {
    id: 'a-1001',
    assetId: 'IT-CHN-LAP-0001',
    name: 'Dell Latitude 5540',
    department: 'Engineering',
    category: 'Laptop',
    status: 'Assigned',
    location: 'Chennai HQ',
    assignedEmployee: 'Arjun Mehta',
    warrantyExpiry: '2026-04-20',
    createdDate: '2026-03-30',
  },
  {
    id: 'a-1002',
    assetId: 'IT-CHN-MON-0012',
    name: 'LG 27" 4K Monitor',
    department: 'Engineering',
    category: 'Monitor',
    status: 'Available',
    location: 'Chennai HQ',
    assignedEmployee: '—',
    warrantyExpiry: '2026-05-10',
    createdDate: '2026-03-28',
  },
  {
    id: 'a-1003',
    assetId: 'IT-BLR-LAP-0009',
    name: 'MacBook Pro M3',
    department: 'Design',
    category: 'Laptop',
    status: 'Assigned',
    location: 'Bangalore Office',
    assignedEmployee: 'Neha Singh',
    warrantyExpiry: '2026-04-05',
    createdDate: '2026-03-20',
  },
  {
    id: 'a-1004',
    assetId: 'IT-MUM-PRN-0003',
    name: 'HP LaserJet Pro',
    department: 'Operations',
    category: 'Printer',
    status: 'Maintenance',
    location: 'Mumbai Branch',
    assignedEmployee: '—',
    warrantyExpiry: '2026-04-12',
    createdDate: '2026-02-14',
  },
  {
    id: 'a-1005',
    assetId: 'IT-DEL-MOB-0007',
    name: 'iPhone 15 Pro',
    department: 'Sales',
    category: 'Mobile',
    status: 'Assigned',
    location: 'Delhi HQ',
    assignedEmployee: 'Aditya Patel',
    warrantyExpiry: '2026-06-18',
    createdDate: '2026-03-05',
  },
  {
    id: 'a-1006',
    assetId: 'IT-CHN-LAP-0002',
    name: 'HP EliteBook 840',
    department: 'Finance',
    category: 'Laptop',
    status: 'Retired',
    location: 'Chennai HQ',
    assignedEmployee: '—',
    warrantyExpiry: '2026-03-25',
    createdDate: '2025-12-18',
  },
  {
    id: 'a-1007',
    assetId: 'IT-HYD-NET-0004',
    name: 'Cisco Catalyst 2960',
    department: 'IT',
    category: 'Network',
    status: 'Available',
    location: 'Hyderabad Branch',
    assignedEmployee: '—',
    warrantyExpiry: '2026-04-02',
    createdDate: '2026-03-29',
  },
  {
    id: 'a-1008',
    assetId: 'IT-CHN-UPS-0006',
    name: 'APC Smart-UPS 1500',
    department: 'IT',
    category: 'UPS',
    status: 'Maintenance',
    location: 'Chennai HQ',
    assignedEmployee: '—',
    warrantyExpiry: '2026-04-28',
    createdDate: '2026-01-11',
  },
]

// ============= Helper Functions =============
function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

function parseISO(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDateShort(dateStr) {
  const d = parseISO(dateStr)
  if (!d) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function withinNextDays(dateStr, days, now = new Date()) {
  const d = parseISO(dateStr)
  if (!d) return false
  const diff = d.getTime() - now.getTime()
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000
}

// ============= Subcomponents =============
function KPIStatCard({ title, value, icon, color, delay }) {
  return (
    <div 
      data-aos="fade-up" 
      data-aos-delay={delay}
      className="bg-white rounded-lg border border-slate-200 p-5 transition-all duration-200 hover:shadow-md hover:border-slate-300"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`p-2 rounded-lg bg-${color}-50`}>
          <i className={`${icon} text-${color}-600 text-lg`} />
        </div>
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children, delay }) {
  return (
    <div 
      data-aos="fade-up" 
      data-aos-delay={delay}
      className="bg-white rounded-lg border border-slate-200 p-5 transition-all duration-200 hover:shadow-md"
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="h-64">{children}</div>
    </div>
  )
}

function TableCard({ title, subtitle, children, rightSlot, delay }) {
  return (
    <div 
      data-aos="fade-up" 
      data-aos-delay={delay}
      className="bg-white rounded-lg border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-md"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {rightSlot && <div>{rightSlot}</div>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-slate-50 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-all focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-all focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
      />
    </div>
  )
}

function Button({ children, onClick, variant = 'primary', icon }) {
  const baseStyles = "inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200"
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100",
  }
  
  return (
    <button onClick={onClick} className={`${baseStyles} ${variants[variant]}`}>
      {icon && <i className={icon} />}
      {children}
    </button>
  )
}

// Custom Tooltip for Charts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-md shadow-lg p-3">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-sm text-slate-600 mt-1">
          Count: <span className="font-semibold text-blue-600">{payload[0].value}</span>
        </p>
      </div>
    )
  }
  return null
}

// ============= Main Component =============
export default function AssetDashboard() {
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('All Departments')
  const [category, setCategory] = useState('All Categories')
  const [status, setStatus] = useState('All Statuses')
  const [lastRefreshAt, setLastRefreshAt] = useState(() => new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const allAssets = MOCK_ASSETS

  // Initialize AOS
  useEffect(() => {
    AOS.init({
      duration: 600,
      once: true,
      offset: 50,
      easing: 'ease-out-quad',
    })
  }, [])

  const departments = useMemo(
    () => ['All Departments', ...Array.from(new Set(allAssets.map((a) => a.department)))],
    [allAssets]
  )
  const categories = useMemo(
    () => ['All Categories', ...Array.from(new Set(allAssets.map((a) => a.category)))],
    [allAssets]
  )
  const statuses = useMemo(
    () => ['All Statuses', ...Array.from(new Set(allAssets.map((a) => a.status)))],
    [allAssets]
  )

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allAssets.filter((a) => {
      if (department !== 'All Departments' && a.department !== department) return false
      if (category !== 'All Categories' && a.category !== category) return false
      if (status !== 'All Statuses' && a.status !== status) return false
      if (q && !`${a.name} ${a.assetId}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [allAssets, search, department, category, status])

  const kpis = useMemo(() => {
    const now = new Date()
    const total = filteredAssets.length
    const assigned = filteredAssets.filter((a) => a.status === 'Assigned').length
    const available = filteredAssets.filter((a) => a.status === 'Available').length
    const maintenance = filteredAssets.filter((a) => a.status === 'Maintenance').length
    const retired = filteredAssets.filter((a) => a.status === 'Retired').length
    const expiring = filteredAssets.filter((a) => withinNextDays(a.warrantyExpiry, 30, now)).length
    return { total, assigned, available, maintenance, retired, expiring }
  }, [filteredAssets])

  const assetsByCategory = useMemo(() => {
    const map = new Map()
    filteredAssets.forEach((a) => map.set(a.category, (map.get(a.category) || 0) + 1))
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [filteredAssets])

  const assetsByDepartment = useMemo(() => {
    const map = new Map()
    filteredAssets.forEach((a) => map.set(a.department, (map.get(a.department) || 0) + 1))
    return Array.from(map.entries()).map(([department, count]) => ({ department, count }))
  }, [filteredAssets])

  const assetsByLocation = useMemo(() => {
    const map = new Map()
    filteredAssets.forEach((a) => map.set(a.location, (map.get(a.location) || 0) + 1))
    return Array.from(map.entries()).map(([location, count]) => ({ location, count }))
  }, [filteredAssets])

  const statusDistribution = useMemo(() => {
    const map = new Map()
    filteredAssets.forEach((a) => map.set(a.status, (map.get(a.status) || 0) + 1))
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [filteredAssets])

  const warrantyExpiringSoon = useMemo(() => {
    const now = new Date()
    return [...filteredAssets]
      .filter((a) => withinNextDays(a.warrantyExpiry, 30, now))
      .sort(
        (a, b) =>
          (parseISO(a.warrantyExpiry)?.getTime() || 0) -
          (parseISO(b.warrantyExpiry)?.getTime() || 0)
      )
  }, [filteredAssets])

  const recentlyAdded = useMemo(() => {
    return [...filteredAssets]
      .sort(
        (a, b) =>
          (parseISO(b.createdDate)?.getTime() || 0) - (parseISO(a.createdDate)?.getTime() || 0)
      )
      .slice(0, 8)
  }, [filteredAssets])

  const allAssetsForTable = useMemo(() => {
    return [...filteredAssets]
      .sort((a, b) => a.assetId.localeCompare(b.assetId))
      .slice(0, 25)
  }, [filteredAssets])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setLastRefreshAt(new Date())
      setIsRefreshing(false)
    }, 500)
  }

  const CHART_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#64748B', '#EF4444']

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div data-aos="fade-right">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: COLORS.textPrimary }}>
              IT Asset Management
            </h1>
            <p className="mt-1 text-sm" style={{ color: COLORS.textSecondary }}>
              Monitor and manage your IT infrastructure assets
            </p>
          </div>
          <div data-aos="fade-left" className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-slate-500">Last refreshed</p>
              <p className="text-sm font-medium text-slate-700">
                {lastRefreshAt.toLocaleTimeString()}
              </p>
            </div>
            <Button onClick={handleRefresh} icon="ri-refresh-line" disabled={isRefreshing}>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div 
          data-aos="fade-up" 
          className="mb-6 rounded-lg border border-slate-200 bg-white p-5 transition-all duration-200"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by asset name or ID..."
            />
            <Select label="Department" value={department} onChange={setDepartment} options={departments} />
            <Select label="Category" value={category} onChange={setCategory} options={categories} />
            <Select label="Status" value={status} onChange={setStatus} options={statuses} />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">
              Showing <span className="font-semibold text-slate-900">{filteredAssets.length}</span> assets
            </p>
            {(department !== 'All Departments' || category !== 'All Categories' || status !== 'All Statuses' || search) && (
              <button
                onClick={() => {
                  setDepartment('All Departments')
                  setCategory('All Categories')
                  setStatus('All Statuses')
                  setSearch('')
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* KPI Grid */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KPIStatCard title="Total Assets" value={kpis.total} icon="ri-stack-line" color="blue" delay={0} />
          <KPIStatCard title="Assigned" value={kpis.assigned} icon="ri-user-shared-line" color="emerald" delay={50} />
          <KPIStatCard title="Available" value={kpis.available} icon="ri-checkbox-circle-line" color="blue" delay={100} />
          <KPIStatCard title="Maintenance" value={kpis.maintenance} icon="ri-tools-line" color="amber" delay={150} />
          <KPIStatCard title="Retired" value={kpis.retired} icon="ri-archive-2-line" color="slate" delay={200} />
          <KPIStatCard title="Expiring Warranty" value={kpis.expiring} icon="ri-alarm-warning-line" color="red" delay={250} />
        </div>

        {/* Charts Grid */}
        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ChartCard title="Assets by Category" subtitle="Distribution across asset categories" delay={0}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={assetsByCategory}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  innerRadius={50}
                  paddingAngle={2}
                  stroke="none"
                >
                  {assetsByCategory.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Assets by Department" subtitle="Asset count per department" delay={100}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assetsByDepartment} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="department" 
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Assets by Location" subtitle="Geographic distribution" delay={50}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assetsByLocation} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="location" 
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Asset Status Distribution" subtitle="Current status breakdown" delay={150}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  innerRadius={50}
                  paddingAngle={2}
                  stroke="none"
                >
                  {statusDistribution.map((d, idx) => (
                    <Cell 
                      key={idx} 
                      fill={
                        d.name === 'Assigned' ? COLORS.success :
                        d.name === 'Available' ? COLORS.info :
                        d.name === 'Maintenance' ? COLORS.warning :
                        COLORS.textSecondary
                      }
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Tables Section */}
        <div className="space-y-6">
          <TableCard 
            title="Warranty Expiring Soon" 
            subtitle="Assets requiring attention in the next 30 days"
            delay={0}
          >
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Asset ID', 'Asset Name', 'Department', 'Assigned To', 'Expiry Date'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warrantyExpiringSoon.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                      No assets expiring within the next 30 days
                    </td>
                  </tr>
                ) : (
                  warrantyExpiringSoon.map((a, idx) => (
                    <tr 
                      key={a.id} 
                      className="transition-colors hover:bg-slate-50"
                      data-aos="fade-up"
                      data-aos-delay={idx * 20}
                    >
                      <td className="px-5 py-3 text-xs font-mono font-medium text-slate-700">{a.assetId}</td>
                      <td className="px-5 py-3 text-sm font-medium text-slate-900">{a.name}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{a.department}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{a.assignedEmployee}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600">
                          <i className="ri-calendar-warning-line text-sm" />
                          {formatDateShort(a.warrantyExpiry)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableCard>

          <TableCard 
            title="Recently Added Assets" 
            subtitle="Latest additions to inventory"
            delay={100}
          >
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Asset ID', 'Asset Name', 'Category', 'Date Added'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentlyAdded.map((a, idx) => (
                  <tr 
                    key={a.id} 
                    className="transition-colors hover:bg-slate-50"
                    data-aos="fade-up"
                    data-aos-delay={idx * 20}
                  >
                    <td className="px-5 py-3 text-xs font-mono font-medium text-slate-700">{a.assetId}</td>
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{a.name}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{a.category}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatDateShort(a.createdDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>

          <TableCard 
            title="All Assets" 
            subtitle={`Showing ${allAssetsForTable.length} of ${filteredAssets.length} assets`}
            rightSlot={
              <span className="text-xs font-medium text-slate-500">
                Sorted by Asset ID
              </span>
            }
            delay={200}
          >
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Asset ID', 'Asset Name', 'Category', 'Status', 'Location', 'Assigned To'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allAssetsForTable.map((a, idx) => (
                  <tr 
                    key={a.id} 
                    className="transition-colors hover:bg-slate-50"
                    data-aos="fade-up"
                    data-aos-delay={idx * 10}
                  >
                    <td className="px-5 py-3 text-xs font-mono font-medium text-slate-700">{a.assetId}</td>
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{a.name}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{a.category}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{a.location}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{a.assignedEmployee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>
      </div>
    </div>
  )
}