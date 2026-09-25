import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

// Single-file EAM Asset Master (JSX) for Kissflow-style usage inside Project Tracker.

const ASSETS = [
  { id: 'a1', assetId: 'MIPL-CHN-LAP-0001', name: 'Dell Latitude 5540', categoryName: 'Laptop', companyName: 'Meridian Infra Pvt Ltd', locationName: 'Chennai HQ', purchaseDate: '2024-01-15', value: 75000, vendorName: 'Dell Technologies', warrantyExpiry: '2026-04-10', status: 'Assigned' },
  { id: 'a2', assetId: 'MIPL-CHN-LAP-0002', name: 'HP EliteBook 840', categoryName: 'Laptop', companyName: 'Meridian Infra Pvt Ltd', locationName: 'Chennai HQ', purchaseDate: '2024-02-10', value: 82000, vendorName: 'HP Inc', warrantyExpiry: '2026-03-15', status: 'Available' },
  { id: 'a3', assetId: 'MIPL-MUM-DSK-0001', name: 'Lenovo ThinkCentre', categoryName: 'Desktop', companyName: 'Meridian Infra Pvt Ltd', locationName: 'Mumbai Branch', purchaseDate: '2023-11-20', value: 55000, vendorName: 'Lenovo India', warrantyExpiry: '2025-11-20', status: 'Maintenance' },
  { id: 'a4', assetId: 'MIPL-BLR-MON-0001', name: 'LG 27" 4K Monitor', categoryName: 'Monitor', companyName: 'Meridian Infra Pvt Ltd', locationName: 'Bangalore Office', purchaseDate: '2024-03-05', value: 32000, vendorName: 'LG Electronics', warrantyExpiry: '2026-04-05', status: 'Assigned' },
  { id: 'a5', assetId: 'TNS-DEL-LAP-0001', name: 'MacBook Pro M3', categoryName: 'Laptop', companyName: 'TechNova Solutions', locationName: 'Delhi HQ', purchaseDate: '2024-06-01', value: 185000, vendorName: 'Apple India', warrantyExpiry: '2027-06-01', status: 'Assigned' },
  { id: 'a6', assetId: 'TNS-HYD-MOB-0001', name: 'iPhone 15 Pro', categoryName: 'Mobile Phone', companyName: 'TechNova Solutions', locationName: 'Hyderabad Branch', purchaseDate: '2024-07-15', value: 135000, vendorName: 'Apple India', warrantyExpiry: '2025-07-15', status: 'Assigned' },
  { id: 'a7', assetId: 'GEC-PUN-PRN-0001', name: 'Canon LBP 6030', categoryName: 'Printer', companyName: 'GlobalEdge Corp', locationName: 'Pune Office', purchaseDate: '2023-09-10', value: 18000, vendorName: 'Canon India', warrantyExpiry: '2025-09-10', status: 'Available' },
  { id: 'a8', assetId: 'GEC-KOL-SRV-0001', name: 'Dell PowerEdge R740', categoryName: 'Server', companyName: 'GlobalEdge Corp', locationName: 'Kolkata Site', purchaseDate: '2022-05-20', value: 450000, vendorName: 'Dell Technologies', warrantyExpiry: '2026-04-02', status: 'Available' },
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
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: 'linear-gradient(135deg, #023957, #145d7c)', color: '#fff', boxShadow: '0 2px 8px rgba(2,57,87,0.3)' }}
        >
          AM
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

export default function EAMAssetMasterProject() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ASSETS
    return ASSETS.filter((a) => `${a.assetId} ${a.name} ${a.vendorName}`.toLowerCase().includes(q))
  }, [search])

  const stats = useMemo(() => {
    return {
      total: ASSETS.length,
      available: ASSETS.filter((a) => a.status === 'Available').length,
      assigned: ASSETS.filter((a) => a.status === 'Assigned').length,
      lostMaint: ASSETS.filter((a) => a.status === 'Lost' || a.status === 'Maintenance').length,
    }
  }, [])

  const statusStyle = (s) => {
    if (s === 'Available') return 'bg-green-50 text-green-700'
    if (s === 'Assigned') return 'bg-blue-50 text-blue-700'
    if (s === 'Lost') return 'bg-red-50 text-red-700'
    return 'bg-amber-50 text-amber-700'
  }

  return (
    <div className="min-h-screen" style={{ background: '#f5f7fa' }}>
      <Sidebar sidebarCollapsed={sidebarCollapsed} />
      <PageTopHeader
        title="Asset Master"
        icon="ri-server-line"
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
      />

      <main className="relative min-h-screen pt-16 transition-all duration-300 ease-in-out" style={{ marginLeft: sidebarCollapsed ? '64px' : '240px' }}>
        <div className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Asset Master</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage all enterprise assets across companies and locations</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary border border-secondary/30 rounded-lg hover:bg-secondary/5 cursor-pointer whitespace-nowrap transition-colors">
                <i className="ri-upload-2-line text-sm" aria-hidden />
                Bulk Upload
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer whitespace-nowrap hover:opacity-90 transition-opacity" style={{ background: '#023957' }}>
                <i className="ri-add-line text-sm" aria-hidden />
                Add Asset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: stats.total, color: '#023957' },
              { label: 'Available', value: stats.available, color: '#15803d' },
              { label: 'Assigned', value: stats.assigned, color: '#145d7c' },
              { label: 'Lost / Maint.', value: stats.lostMaint, color: '#dc2626' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl px-4 py-3 border border-gray-100 flex items-center gap-3">
                <span className="text-xl font-bold" style={{ color: s.color }}>{s.value}</span>
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden />
                <input
                  type="text"
                  placeholder="Search asset, ID, vendor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{filtered.length} result(s)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50">
                    {['Asset ID', 'Asset Name', 'Category', 'Company', 'Location', 'Value (₹)', 'Warranty Expiry', 'Status'].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-medium text-secondary">{asset.assetId}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800">{asset.name}</p>
                        <p className="text-xs text-gray-400">{asset.vendorName}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{asset.categoryName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{asset.companyName.split(' ').slice(0, 2).join(' ')}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{asset.locationName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-medium">₹{asset.value.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{asset.warrantyExpiry}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle(asset.status)}`}>{asset.status}</span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-sm text-gray-400">No assets found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

