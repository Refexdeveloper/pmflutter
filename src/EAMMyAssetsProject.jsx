import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

// Single-file EAM My Assets (JSX)

const MY_ASSIGNMENTS = [
  { id: 'asgn1', employeeId: 'e1', status: 'Active', assignDate: '2025-09-01', expectedReturn: '2026-08-31', asset: { name: 'Dell Latitude 5540', assetId: 'MIPL-CHN-LAP-0001', categoryName: 'Laptop', vendorName: 'Dell Technologies' } },
  { id: 'asgn2', employeeId: 'e1', status: 'Active', assignDate: '2025-10-15', expectedReturn: '2026-10-14', asset: { name: 'LG 27" 4K Monitor', assetId: 'MIPL-BLR-MON-0001', categoryName: 'Monitor', vendorName: 'LG Electronics' } },
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
        EM
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

export default function EAMMyAssetsProject() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const myAssets = useMemo(() => MY_ASSIGNMENTS.filter((a) => a.employeeId === 'e1' && a.status === 'Active'), [])

  return (
    <div className="min-h-screen" style={{ background: '#f5f7fa' }}>
      <Sidebar sidebarCollapsed={sidebarCollapsed} />
      <TopHeader
        title="My Assets"
        icon="ri-briefcase-line"
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
      />
      <main className="relative min-h-screen pt-16 transition-all duration-300 ease-in-out" style={{ marginLeft: sidebarCollapsed ? '64px' : '240px' }}>
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">My Assets</h1>
              <p className="text-sm text-gray-500 mt-0.5">Assets currently assigned to you</p>
            </div>
            <Link to="/eam/requests" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer whitespace-nowrap hover:opacity-90 transition-opacity" style={{ background: '#023957' }}>
              <i className="ri-add-line" aria-hidden />
              Request Asset
            </Link>
          </div>

          {myAssets.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 py-20 text-center">
              <i className="ri-inbox-line text-5xl text-gray-200" aria-hidden />
              <p className="text-sm text-gray-500 mt-3">No assets assigned to you</p>
              <Link to="/eam/requests" className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer" style={{ background: '#023957' }}>
                Request an Asset
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myAssets.map((row) => (
                <div key={row.id} className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#e6eef3' }}>
                      <i className="ri-computer-line text-primary text-base" aria-hidden />
                    </div>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">Assigned</span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800">{row.asset?.name}</h3>
                  <p className="text-xs font-mono text-secondary mt-0.5">{row.asset?.assetId}</p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Category</span>
                      <span className="text-gray-700">{row.asset?.categoryName}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Assigned</span>
                      <span className="text-gray-700">{row.assignDate}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Return by</span>
                      <span className="text-gray-700">{row.expectedReturn}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Vendor</span>
                      <span className="text-gray-700">{row.asset?.vendorName}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

