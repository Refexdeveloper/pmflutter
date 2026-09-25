import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

// Single-file EAM Requests (JSX)

const REQUESTS_SEED = [
  { id: 'req1', requestNo: 'REQ-2026-001', employeeId: 'e1', employeeName: 'Arjun Mehta', department: 'Engineering', assetType: 'Laptop', reason: 'Need upgrade for better performance.', priority: 'High', status: 'Pending', requestDate: '2026-03-28' },
  { id: 'req2', requestNo: 'REQ-2026-002', employeeId: 'e2', employeeName: 'Priya Sharma', department: 'HR', assetType: 'Mobile Phone', reason: 'Need a mobile phone for coordination.', priority: 'Medium', status: 'Approved', requestDate: '2026-03-20', reviewDate: '2026-03-22', reviewerNote: 'Approved.' },
  { id: 'req3', requestNo: 'REQ-2026-003', employeeId: 'e4', employeeName: 'Neha Singh', department: 'Marketing', assetType: 'Projector', reason: 'Need projector for presentations.', priority: 'Medium', status: 'Rejected', requestDate: '2026-03-15', reviewDate: '2026-03-17', reviewerNote: 'Use shared projector.' },
]

const STATUS_STYLES = {
  Pending: 'bg-amber-50 text-amber-700',
  Approved: 'bg-green-50 text-green-700',
  Rejected: 'bg-red-50 text-red-700',
}

const PRIORITY_STYLES = {
  High: 'bg-red-50 text-red-700',
  Medium: 'bg-amber-50 text-amber-700',
  Low: 'bg-green-50 text-green-700',
}

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

export default function EAMRequestsProject() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [requests, setRequests] = useState(REQUESTS_SEED)
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [assetType, setAssetType] = useState('')
  const [reason, setReason] = useState('')
  const [priority, setPriority] = useState('Medium')

  const display = useMemo(() => {
    return requests.filter((r) => (!filterStatus ? true : r.status === filterStatus))
  }, [requests, filterStatus])

  const submit = (e) => {
    e.preventDefault()
    const newReq = {
      id: `req${Date.now()}`,
      requestNo: `REQ-2026-${String(requests.length + 1).padStart(3, '0')}`,
      employeeId: 'e1',
      employeeName: 'Arjun Mehta',
      department: 'Engineering',
      assetType,
      reason,
      priority,
      status: 'Pending',
      requestDate: '2026-03-31',
    }
    setRequests((prev) => [newReq, ...prev])
    setShowForm(false)
    setAssetType('')
    setReason('')
    setPriority('Medium')
  }

  const counts = useMemo(() => {
    return {
      Pending: requests.filter((r) => r.status === 'Pending').length,
      Approved: requests.filter((r) => r.status === 'Approved').length,
      Rejected: requests.filter((r) => r.status === 'Rejected').length,
    }
  }, [requests])

  return (
    <div className="min-h-screen" style={{ background: '#f5f7fa' }}>
      <Sidebar sidebarCollapsed={sidebarCollapsed} />
      <TopHeader
        title="Asset Requests"
        icon="ri-file-list-3-line"
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
      />
      <main className="relative min-h-screen pt-16 transition-all duration-300 ease-in-out" style={{ marginLeft: sidebarCollapsed ? '64px' : '240px' }}>
        <div className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Asset Requests</h1>
              <p className="text-sm text-gray-500 mt-0.5">Review and track employee asset requests</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer whitespace-nowrap hover:opacity-90 transition-opacity self-start"
              style={{ background: '#023957' }}
            >
              <i className="ri-add-line text-sm" aria-hidden />
              New Request
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {['', 'Pending', 'Approved', 'Rejected'].map((s) => (
              <button
                key={s || 'all'}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  filterStatus === s ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {s || 'All'} {s ? `(${counts[s] || 0})` : ''}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50">
                    {['Request No', 'Employee', 'Asset Type', 'Priority', 'Reason', 'Date', 'Status'].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {display.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-sm text-gray-400">
                        No requests found.
                      </td>
                    </tr>
                  ) : (
                    display.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-secondary font-medium">{req.requestNo}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{req.employeeName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{req.assetType}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${PRIORITY_STYLES[req.priority] || 'bg-slate-50 text-slate-600'}`}>
                            {req.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{req.reason}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{req.requestDate}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[req.status] || 'bg-slate-50 text-slate-600'}`}>
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showForm ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100" style={{ background: '#023957' }}>
                  <h2 className="text-sm font-semibold text-white">New Asset Request</h2>
                  <button type="button" onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer">
                    <i className="ri-close-line text-base" aria-hidden />
                  </button>
                </div>
                <form onSubmit={submit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Asset Type *</label>
                    <input
                      required
                      value={assetType}
                      onChange={(e) => setAssetType(e.target.value)}
                      placeholder="e.g. Laptop"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Reason *</label>
                    <textarea
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Explain why this asset is needed..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                      Cancel
                    </button>
                    <button type="submit" className="px-5 py-2 text-sm font-medium text-white rounded-lg cursor-pointer whitespace-nowrap hover:opacity-90" style={{ background: '#023957' }}>
                      Submit
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

