import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

// Single-file EAM Assign Asset (JSX)

const ASSETS = [
  { id: 'a1', assetId: 'MIPL-CHN-LAP-0001', name: 'Dell Latitude 5540', status: 'Assigned' },
  { id: 'a2', assetId: 'MIPL-CHN-LAP-0002', name: 'HP EliteBook 840', status: 'Available' },
  { id: 'a3', assetId: 'MIPL-MUM-DSK-0001', name: 'Lenovo ThinkCentre', status: 'Maintenance' },
  { id: 'a7', assetId: 'GEC-PUN-PRN-0001', name: 'Canon LBP 6030', status: 'Available' },
  { id: 'a8', assetId: 'GEC-KOL-SRV-0001', name: 'Dell PowerEdge R740', status: 'Available' },
]

const EMPLOYEES = [
  { id: 'e1', name: 'Arjun Mehta', department: 'Engineering', status: 'Active' },
  { id: 'e2', name: 'Priya Sharma', department: 'HR', status: 'Active' },
  { id: 'e4', name: 'Neha Singh', department: 'Marketing', status: 'Active' },
  { id: 'e7', name: 'Aditya Patel', department: 'Sales', status: 'Active' },
]

const ASSIGNMENTS = [
  { id: 'asgn1', assetName: 'Dell Latitude 5540', assetIdCode: 'MIPL-CHN-LAP-0001', employeeName: 'Arjun Mehta', department: 'Engineering', assignDate: '2025-09-01', expectedReturn: '2026-08-31', status: 'Active' },
  { id: 'asgn2', assetName: 'HP EliteBook 840', assetIdCode: 'MIPL-CHN-LAP-0002', employeeName: 'Rohan Kapoor', department: 'Finance', assignDate: '2025-07-01', expectedReturn: '2026-01-01', status: 'Overdue' },
]

function TopHeader({ title, icon, sidebarCollapsed, onToggleSidebar }) {
  return (
    <header
      className="fixed right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 px-5"
      style={{
        left: sidebarCollapsed ? '64px' : '240px',
        transition: 'left 0.3s ease',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600"
        >
          <i className={`${sidebarCollapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'} text-base`} aria-hidden />
        </button>
        <span className="h-5 w-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: '#e6eef3' }}>
            <i className={`${icon} text-sm`} style={{ color: '#023957' }} aria-hidden />
          </div>
          <div>
            <h2 className="font-display leading-none text-sm font-semibold text-gray-800">{title}</h2>
            <p className="mt-0.5 text-[10px] text-gray-400">Meridian Infra Pvt Ltd · 31 Mar 2026</p>
          </div>
        </div>
      </div>
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
        style={{ background: 'linear-gradient(135deg, #023957, #145d7c)', color: '#fff', boxShadow: '0 2px 8px rgba(2,57,87,0.3)' }}
      >
        AM
      </div>
    </header>
  )
}

function Sidebar({ sidebarCollapsed }) {
  const { pathname } = useLocation()
  const items = [
    { label: 'Dashboard', icon: 'ri-dashboard-3-line', path: '/eam' },
    { label: 'Asset Master', icon: 'ri-server-line', path: '/eam/assets' },
    { label: 'Assign Asset', icon: 'ri-user-add-line', path: '/eam/assign' },
    { label: 'Requests', icon: 'ri-file-list-3-line', path: '/eam/requests' },
    { label: 'Warranty', icon: 'ri-shield-check-line', path: '/eam/warranty' },
    { label: 'QR Codes', icon: 'ri-qr-code-line', path: '/eam/qr-codes' },
    { label: 'Company & Locations', icon: 'ri-building-2-line', path: '/eam/company-location' },
    { label: 'My Assets', icon: 'ri-briefcase-line', path: '/eam/my-assets' },
  ]
  return (
    <aside
      className={`fixed left-0 top-0 z-30 flex h-screen flex-col transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-[64px]' : 'w-[240px]'}`}
      style={{ background: 'linear-gradient(180deg, #023957 0%, #012d46 100%)' }}
    >
      <div className="flex min-h-[64px] items-center gap-3 border-b px-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: '#fcc40f' }}>
          <i className="ri-building-4-line text-sm" style={{ color: '#023957' }} aria-hidden />
        </div>
        {!sidebarCollapsed ? (
          <div className="animate-fade-in overflow-hidden">
            <p className="font-display whitespace-nowrap text-sm font-bold leading-tight text-white">EAM Suite</p>
            <p className="whitespace-nowrap text-[10px] text-white/40">Enterprise Asset Mgmt</p>
          </div>
        ) : null}
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {items.map((item) => {
          const active = pathname === item.path
          return (
            <div key={item.path} className="px-2">
              <Link
                to={item.path}
                className={`mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                  active ? 'text-white' : 'text-white/55 hover:bg-white/8 hover:text-white'
                }`}
                style={
                  active
                    ? {
                        background: 'linear-gradient(90deg, rgba(252,196,15,0.18) 0%, rgba(255,255,255,0.07) 100%)',
                        borderLeft: '3px solid #fcc40f',
                      }
                    : {}
                }
              >
                <i className={`${item.icon} text-[15px]`} style={active ? { color: '#fcc40f' } : {}} aria-hidden />
                {!sidebarCollapsed ? <span className="text-[13px] font-medium">{item.label}</span> : null}
              </Link>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

export default function EAMAssignAssetProject() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [department, setDepartment] = useState('')
  const [assignDate, setAssignDate] = useState('2026-03-31')
  const [returnDate, setReturnDate] = useState('')

  const availableAssets = useMemo(() => ASSETS.filter((a) => a.status === 'Available'), [])
  const activeEmployees = useMemo(() => EMPLOYEES.filter((e) => e.status === 'Active'), [])

  const stats = useMemo(() => {
    return {
      active: ASSIGNMENTS.filter((a) => a.status === 'Active').length,
      overdue: ASSIGNMENTS.filter((a) => a.status === 'Overdue').length,
      available: availableAssets.length,
    }
  }, [availableAssets.length])

  const submit = (e) => {
    e.preventDefault()
    setShowForm(false)
    setSelectedAsset('')
    setSelectedEmployee('')
    setDepartment('')
    setReturnDate('')
  }

  const STATUS_STYLES = {
    Active: 'bg-blue-50 text-blue-700',
    Returned: 'bg-green-50 text-green-700',
    Overdue: 'bg-red-50 text-red-700',
  }

  return (
    <div className="min-h-screen" style={{ background: '#f5f7fa' }}>
      <Sidebar sidebarCollapsed={sidebarCollapsed} />
      <TopHeader
        title="Assign Asset"
        icon="ri-user-add-line"
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
      />

      <main className="relative min-h-screen pt-16 transition-all duration-300 ease-in-out" style={{ marginLeft: sidebarCollapsed ? '64px' : '240px' }}>
        <div className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Asset Assignment</h1>
              <p className="text-sm text-gray-500 mt-0.5">Assign available assets to employees and track assignment history</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer whitespace-nowrap hover:opacity-90 transition-opacity self-start"
              style={{ background: '#023957' }}
            >
              <i className="ri-user-add-line text-sm" aria-hidden />
              Assign Asset
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Active Assignments', value: stats.active, color: '#145d7c' },
              { label: 'Overdue Returns', value: stats.overdue, color: '#dc2626' },
              { label: 'Available for Assignment', value: stats.available, color: '#15803d' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl px-4 py-3 border border-gray-100 flex items-center gap-3">
                <span className="text-xl font-bold" style={{ color: s.color }}>
                  {s.value}
                </span>
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Assignment History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50">
                    {['Asset', 'Asset ID', 'Employee', 'Department', 'Assign Date', 'Expected Return', 'Status'].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ASSIGNMENTS.map((asgn) => (
                    <tr key={asgn.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{asgn.assetName}</td>
                      <td className="px-4 py-3 text-xs font-mono text-secondary">{asgn.assetIdCode}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{asgn.employeeName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{asgn.department}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{asgn.assignDate}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{asgn.expectedReturn}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[asgn.status] || 'bg-slate-50 text-slate-600'}`}>
                          {asgn.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {showForm ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100" style={{ background: '#023957' }}>
                  <h2 className="text-sm font-semibold text-white">Assign Asset to Employee</h2>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  >
                    <i className="ri-close-line text-base" aria-hidden />
                  </button>
                </div>
                <form onSubmit={submit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Select Asset (Available Only) *</label>
                    <select
                      required
                      value={selectedAsset}
                      onChange={(e) => setSelectedAsset(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      <option value="">Choose an asset...</option>
                      {availableAssets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.assetId})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Select Employee *</label>
                    <select
                      required
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      <option value="">Choose employee...</option>
                      {activeEmployees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                      <input
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g. Engineering"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Assign Date</label>
                      <input
                        type="date"
                        value={assignDate}
                        onChange={(e) => setAssignDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Expected Return Date</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="px-5 py-2 text-sm font-medium text-white rounded-lg cursor-pointer whitespace-nowrap hover:opacity-90" style={{ background: '#023957' }}>
                      Assign
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}

