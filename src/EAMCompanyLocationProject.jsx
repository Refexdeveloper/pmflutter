import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

// Single-file EAM Company & Locations (JSX)

const COMPANIES = [
  { id: 'c1', name: 'Meridian Infra Pvt Ltd', code: 'MIPL' },
  { id: 'c2', name: 'TechNova Solutions', code: 'TNS' },
  { id: 'c3', name: 'GlobalEdge Corp', code: 'GEC' },
]

const LOCATIONS = [
  { id: 'l1', name: 'Chennai HQ', code: 'CHN', companyId: 'c1' },
  { id: 'l2', name: 'Mumbai Branch', code: 'MUM', companyId: 'c1' },
  { id: 'l3', name: 'Bangalore Office', code: 'BLR', companyId: 'c1' },
  { id: 'l4', name: 'Delhi HQ', code: 'DEL', companyId: 'c2' },
  { id: 'l5', name: 'Hyderabad Branch', code: 'HYD', companyId: 'c2' },
  { id: 'l6', name: 'Pune Office', code: 'PUN', companyId: 'c3' },
  { id: 'l7', name: 'Kolkata Site', code: 'KOL', companyId: 'c3' },
]

const CATEGORIES = [
  { id: 'cat1', name: 'Laptop', code: 'LAP' },
  { id: 'cat2', name: 'Desktop', code: 'DSK' },
  { id: 'cat3', name: 'Printer', code: 'PRN' },
  { id: 'cat4', name: 'Monitor', code: 'MON' },
  { id: 'cat5', name: 'Mobile Phone', code: 'MOB' },
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

export default function EAMCompanyLocationProject() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('companies')

  const tabMeta = useMemo(() => {
    return [
      { id: 'companies', label: 'Companies', icon: 'ri-building-2-line', count: COMPANIES.length },
      { id: 'locations', label: 'Locations', icon: 'ri-map-pin-line', count: LOCATIONS.length },
      { id: 'categories', label: 'Categories', icon: 'ri-price-tag-3-line', count: CATEGORIES.length },
    ]
  }, [])

  return (
    <div className="min-h-screen" style={{ background: '#f5f7fa' }}>
      <Sidebar sidebarCollapsed={sidebarCollapsed} />
      <TopHeader
        title="Company & Locations"
        icon="ri-building-2-line"
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
      />
      <main className="relative min-h-screen pt-16 transition-all duration-300 ease-in-out" style={{ marginLeft: sidebarCollapsed ? '64px' : '240px' }}>
        <div className="p-6 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Company &amp; Location Structure</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage companies, branches, and asset categories</p>
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {tabMeta.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === t.id ? 'bg-white text-primary' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <i className={t.icon} aria-hidden />
                {t.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {activeTab === 'companies' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {COMPANIES.map((comp) => {
                const compLocs = LOCATIONS.filter((l) => l.companyId === comp.id)
                return (
                  <div key={comp.id} className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ background: '#023957' }}>
                        {comp.code.slice(0, 2)}
                      </div>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{comp.code}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800">{comp.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">{compLocs.length} location(s)</p>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {compLocs.map((l) => (
                        <span key={l.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                          {l.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          {activeTab === 'locations' ? (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    {['Code', 'Location Name', 'Company'].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-5 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {LOCATIONS.map((loc) => {
                    const comp = COMPANIES.find((c) => c.id === loc.companyId)
                    return (
                      <tr key={loc.id} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3 text-xs font-mono font-semibold text-secondary">{loc.code}</td>
                        <td className="px-5 py-3 text-sm font-medium text-gray-800">{loc.name}</td>
                        <td className="px-5 py-3 text-sm text-gray-500">{comp?.name}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === 'categories' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {CATEGORIES.map((cat) => (
                <div key={cat.id} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: '#e6eef3' }}>
                    <i className="ri-price-tag-3-line text-primary text-base" aria-hidden />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{cat.name}</p>
                  <p className="text-xs font-mono text-secondary mt-0.5">{cat.code}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}

