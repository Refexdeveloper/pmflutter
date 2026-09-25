import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

// Single-file EAM Dashboard (JSX) for Kissflow-style usage inside Project Tracker.

const ASSETS = [
  { id: 'a1', assetId: 'MIPL-CHN-LAP-0001', name: 'Dell Latitude 5540', companyId: 'c1', locationName: 'Chennai HQ', vendorName: 'Dell Technologies', warrantyExpiry: '2026-04-10', status: 'Assigned' },
  { id: 'a2', assetId: 'MIPL-CHN-LAP-0002', name: 'HP EliteBook 840', companyId: 'c1', locationName: 'Chennai HQ', vendorName: 'HP Inc', warrantyExpiry: '2026-03-15', status: 'Available' },
  { id: 'a3', assetId: 'MIPL-MUM-DSK-0001', name: 'Lenovo ThinkCentre', companyId: 'c1', locationName: 'Mumbai Branch', vendorName: 'Lenovo India', warrantyExpiry: '2025-11-20', status: 'Maintenance' },
  { id: 'a4', assetId: 'MIPL-BLR-MON-0001', name: 'LG 27" 4K Monitor', companyId: 'c1', locationName: 'Bangalore Office', vendorName: 'LG Electronics', warrantyExpiry: '2026-04-05', status: 'Assigned' },
  { id: 'a5', assetId: 'TNS-DEL-LAP-0001', name: 'MacBook Pro M3', companyId: 'c2', locationName: 'Delhi HQ', vendorName: 'Apple India', warrantyExpiry: '2027-06-01', status: 'Assigned' },
  { id: 'a6', assetId: 'TNS-HYD-MOB-0001', name: 'iPhone 15 Pro', companyId: 'c2', locationName: 'Hyderabad Branch', vendorName: 'Apple India', warrantyExpiry: '2025-07-15', status: 'Assigned' },
  { id: 'a7', assetId: 'GEC-PUN-PRN-0001', name: 'Canon LBP 6030', companyId: 'c3', locationName: 'Pune Office', vendorName: 'Canon India', warrantyExpiry: '2025-09-10', status: 'Available' },
  { id: 'a8', assetId: 'GEC-KOL-SRV-0001', name: 'Dell PowerEdge R740', companyId: 'c3', locationName: 'Kolkata Site', vendorName: 'Dell Technologies', warrantyExpiry: '2026-04-02', status: 'Available' },
  { id: 'a9', assetId: 'MIPL-CHN-LAP-0003', name: 'Asus ProArt Studiobook', companyId: 'c1', locationName: 'Chennai HQ', vendorName: 'Asus India', warrantyExpiry: '2027-08-20', status: 'Lost' },
  { id: 'a10', assetId: 'TNS-DEL-NSW-0001', name: 'Cisco Catalyst 2960', companyId: 'c2', locationName: 'Delhi HQ', vendorName: 'Cisco Systems', warrantyExpiry: '2026-01-10', status: 'Available' },
  { id: 'a11', assetId: 'MIPL-MUM-UPS-0001', name: 'APC Smart-UPS 1500', companyId: 'c1', locationName: 'Mumbai Branch', vendorName: 'APC by Schneider', warrantyExpiry: '2025-06-05', status: 'Available' },
  { id: 'a12', assetId: 'GEC-PUN-PRJ-0001', name: 'Epson EB-X51 Projector', companyId: 'c3', locationName: 'Pune Office', vendorName: 'Epson India', warrantyExpiry: '2026-12-01', status: 'Assigned' },
]

const COMPANIES = [
  { id: 'c1', name: 'Meridian Infra Pvt Ltd', code: 'MIPL' },
  { id: 'c2', name: 'TechNova Solutions', code: 'TNS' },
  { id: 'c3', name: 'GlobalEdge Corp', code: 'GEC' },
]

function PageTopHeader({ title, icon, sidebarCollapsed, onToggleSidebar }) {
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

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-1.5">
          <i className="ri-search-line text-sm text-gray-400" aria-hidden />
          <input placeholder="Search assets..." className="w-40 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400" />
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
            style={{ background: 'linear-gradient(135deg, #023957, #145d7c)', color: '#fff', boxShadow: '0 2px 8px rgba(2,57,87,0.3)' }}
          >
            AM
          </div>
        </div>
      </div>
    </header>
  )
}

function Sidebar({ sidebarCollapsed }) {
  const { pathname } = useLocation()
  const items = [
    { label: 'Dashboard', icon: 'ri-dashboard-3-line', path: '/eam' },
    { label: 'Asset Master', icon: 'ri-server-line', path: '/eam/assets' },
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
            <div key={item.path} className="group relative px-2">
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
                <div className="flex h-5 w-5 items-center justify-center">
                  <i className={`${item.icon} text-[15px]`} style={active ? { color: '#fcc40f' } : {}} aria-hidden />
                </div>
                {!sidebarCollapsed ? <span className="text-[13px] font-medium">{item.label}</span> : null}
              </Link>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

export default function EAMDashboardProject() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState('all')

  const companyStats = useMemo(() => {
    const all = {
      id: 'all',
      name: 'All Entities',
      code: 'ALL',
      total: ASSETS.length,
      available: ASSETS.filter((a) => a.status === 'Available').length,
      assigned: ASSETS.filter((a) => a.status === 'Assigned').length,
      lost: ASSETS.filter((a) => a.status === 'Lost').length,
      maintenance: ASSETS.filter((a) => a.status === 'Maintenance').length,
    }
    const items = COMPANIES.map((c) => {
      const compAssets = ASSETS.filter((a) => a.companyId === c.id)
      return {
        id: c.id,
        name: c.name,
        code: c.code,
        total: compAssets.length,
        available: compAssets.filter((a) => a.status === 'Available').length,
        assigned: compAssets.filter((a) => a.status === 'Assigned').length,
        lost: compAssets.filter((a) => a.status === 'Lost').length,
        maintenance: compAssets.filter((a) => a.status === 'Maintenance').length,
      }
    })
    return [all, ...items]
  }, [])

  const total = ASSETS.length
  const available = ASSETS.filter((a) => a.status === 'Available').length
  const assigned = ASSETS.filter((a) => a.status === 'Assigned').length
  const lost = ASSETS.filter((a) => a.status === 'Lost').length
  const maint = ASSETS.filter((a) => a.status === 'Maintenance').length

  return (
    <div className="min-h-screen" style={{ background: '#f5f7fa' }}>
      <Sidebar sidebarCollapsed={sidebarCollapsed} />
      <PageTopHeader
        title="EAM Dashboard"
        icon="ri-dashboard-3-line"
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
      />

      <main className="relative min-h-screen pt-16 transition-all duration-300 ease-in-out" style={{ marginLeft: sidebarCollapsed ? '64px' : '240px' }}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Asset Management Dashboard</h1>
              <p className="mt-0.5 text-sm text-gray-500">Overview of all enterprise assets · 31 March 2026</p>
            </div>
            <Link
              to="/eam/assets"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer whitespace-nowrap transition-opacity hover:opacity-90"
              style={{ background: '#023957' }}
            >
              <i className="ri-add-line" aria-hidden />
              Add Asset
            </Link>
          </div>

          <div className="rounded-2xl p-5 bg-white border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: '#e6eef3' }}>
                  <i className="ri-building-2-line text-sm" style={{ color: '#023957' }} aria-hidden />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 font-display">Entity Overview</h3>
                  <p className="text-[11px] text-gray-400">Filter dashboard by company entity</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#e6eef3', color: '#023957' }}>
                <i className="ri-filter-3-line text-[11px]" aria-hidden />
                {selectedEntity === 'all' ? 'All Entities' : (COMPANIES.find((c) => c.id === selectedEntity)?.code || 'Entity')}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {companyStats.map((entity) => {
                const isActive = selectedEntity === entity.id
                return (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => setSelectedEntity(entity.id)}
                    className="rounded-xl p-4 text-left transition-all duration-200"
                    style={{
                      background: isActive ? 'linear-gradient(135deg, #023957 0%, #145d7c 100%)' : '#fafafa',
                      border: isActive ? '1.5px solid #023957' : '1.5px solid #f1f5f9',
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: isActive ? 'rgba(255,255,255,0.2)' : '#e6eef3', color: isActive ? '#fff' : '#023957' }}>
                        {entity.code}
                      </span>
                      {isActive ? (
                        <div className="w-4 h-4 flex items-center justify-center rounded-full" style={{ background: '#fcc40f' }}>
                          <i className="ri-check-line text-[9px] font-bold" style={{ color: '#023957' }} aria-hidden />
                        </div>
                      ) : null}
                    </div>
                    <p className="text-2xl font-extrabold leading-none font-display" style={{ color: isActive ? '#fff' : '#023957' }}>
                      {entity.total}
                    </p>
                    <p className="text-[11px] font-medium mt-1" style={{ color: isActive ? 'rgba(255,255,255,0.8)' : '#64748b' }}>
                      {entity.id === 'all' ? 'Total Assets' : entity.name}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Assets', value: total, icon: 'ri-server-line', grad: 'linear-gradient(135deg, #023957 0%, #145d7c 100%)' },
              { label: 'Available', value: available, icon: 'ri-checkbox-circle-line', grad: 'linear-gradient(135deg, #166534 0%, #15803d 100%)' },
              { label: 'Assigned', value: assigned, icon: 'ri-user-shared-line', grad: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)' },
              { label: 'Lost / Missing', value: lost, icon: 'ri-error-warning-line', grad: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' },
              { label: 'Maintenance', value: maint, icon: 'ri-tools-line', grad: 'linear-gradient(135deg, #92400e 0%, #d97706 100%)' },
            ].map((k) => (
              <div key={k.label} className="relative rounded-2xl p-5 overflow-hidden kpi-card" style={{ background: k.grad }}>
                <div className="flex items-start justify-between relative z-10">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <i className={`${k.icon} text-base`} style={{ color: '#fff' }} aria-hidden />
                  </div>
                </div>
                <div className="mt-4 relative z-10">
                  <p className="text-3xl font-extrabold leading-none font-display text-white">{k.value}</p>
                  <p className="text-[13px] font-semibold mt-1.5 text-white/90">{k.label}</p>
                  <p className="text-[11px] mt-0.5 text-white/55">Live summary</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

