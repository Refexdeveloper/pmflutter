import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

// Single-file EAM Warranty Tracking (JSX)

const ASSETS = [
  { id: 'a1', assetId: 'MIPL-CHN-LAP-0001', name: 'Dell Latitude 5540', categoryName: 'Laptop', locationName: 'Chennai HQ', vendorName: 'Dell Technologies', warrantyExpiry: '2026-04-10' },
  { id: 'a2', assetId: 'MIPL-CHN-LAP-0002', name: 'HP EliteBook 840', categoryName: 'Laptop', locationName: 'Chennai HQ', vendorName: 'HP Inc', warrantyExpiry: '2026-03-15' },
  { id: 'a8', assetId: 'GEC-KOL-SRV-0001', name: 'Dell PowerEdge R740', categoryName: 'Server', locationName: 'Kolkata Site', vendorName: 'Dell Technologies', warrantyExpiry: '2026-04-02' },
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

export default function EAMWarrantyProject() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const today = useMemo(() => new Date('2026-03-31'), [])
  const [filter, setFilter] = useState('30') // 7 / 30 / 90 / expired

  const getDaysLeft = (d) => Math.ceil((new Date(d).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  const filtered = useMemo(() => {
    return ASSETS.filter((a) => {
      const days = getDaysLeft(a.warrantyExpiry)
      if (filter === '7') return days >= 0 && days <= 7
      if (filter === '30') return days >= 0 && days <= 30
      if (filter === '90') return days >= 0 && days <= 90
      if (filter === 'expired') return days < 0
      return true
    }).sort((a, b) => new Date(a.warrantyExpiry).getTime() - new Date(b.warrantyExpiry).getTime())
  }, [filter, today])

  const counts = useMemo(() => {
    const critical7 = ASSETS.filter((a) => { const d = getDaysLeft(a.warrantyExpiry); return d >= 0 && d <= 7 }).length
    const warning30 = ASSETS.filter((a) => { const d = getDaysLeft(a.warrantyExpiry); return d >= 0 && d <= 30 }).length
    const notice90 = ASSETS.filter((a) => { const d = getDaysLeft(a.warrantyExpiry); return d >= 0 && d <= 90 }).length
    const expired = ASSETS.filter((a) => getDaysLeft(a.warrantyExpiry) < 0).length
    return { critical7, warning30, notice90, expired }
  }, [today])

  const badge = (exp) => {
    const days = getDaysLeft(exp)
    if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, cls: 'bg-gray-100 text-gray-600' }
    if (days <= 7) return { label: `${days}d left`, cls: 'bg-red-50 text-red-700' }
    if (days <= 30) return { label: `${days}d left`, cls: 'bg-amber-50 text-amber-700' }
    return { label: `${days}d left`, cls: 'bg-green-50 text-green-700' }
  }

  return (
    <div className="min-h-screen" style={{ background: '#f5f7fa' }}>
      <Sidebar sidebarCollapsed={sidebarCollapsed} />
      <TopHeader
        title="Warranty Tracking"
        icon="ri-shield-check-line"
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
      />
      <main className="relative min-h-screen pt-16 transition-all duration-300 ease-in-out" style={{ marginLeft: sidebarCollapsed ? '64px' : '240px' }}>
        <div className="p-6 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Warranty Tracking</h1>
            <p className="text-sm text-gray-500 mt-0.5">Monitor asset warranty expiry and take proactive action</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
              <p className="text-2xl font-bold text-red-600">{counts.critical7}</p>
              <p className="text-xs text-red-500 mt-0.5">Expiring in 7 days</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <p className="text-2xl font-bold text-amber-600">{counts.warning30}</p>
              <p className="text-xs text-amber-500 mt-0.5">Expiring in 30 days</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-2xl font-bold text-blue-600">{counts.notice90}</p>
              <p className="text-xs text-blue-500 mt-0.5">Expiring in 90 days</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-2xl font-bold text-gray-600">{counts.expired}</p>
              <p className="text-xs text-gray-500 mt-0.5">Already expired</p>
            </div>
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {[
              { id: '7', label: 'Critical (7d)' },
              { id: '30', label: 'Warning (30d)' },
              { id: '90', label: 'Notice (90d)' },
              { id: 'expired', label: 'Expired' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  filter === t.id ? 'bg-white text-gray-800' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <i className="ri-shield-check-line text-4xl text-green-200" aria-hidden />
                <p className="text-sm text-gray-400 mt-2">No assets in this category</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50">
                      {['Asset ID', 'Asset Name', 'Category', 'Location', 'Vendor', 'Warranty Expiry', 'Days Left'].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((a) => {
                      const b = badge(a.warrantyExpiry)
                      return (
                        <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-xs font-mono text-secondary font-medium">{a.assetId}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-800">{a.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{a.categoryName}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{a.locationName}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{a.vendorName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{a.warrantyExpiry}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${b.cls}`}>{b.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

