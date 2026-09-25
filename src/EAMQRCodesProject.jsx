import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import QRCode from 'qrcode'

// Single-file EAM QR Codes (JSX)

const ASSETS = [
  { id: 'a1', assetId: 'MIPL-CHN-LAP-0001', name: 'Dell Latitude 5540', locationName: 'Chennai HQ' },
  { id: 'a2', assetId: 'MIPL-CHN-LAP-0002', name: 'HP EliteBook 840', locationName: 'Chennai HQ' },
  { id: 'a8', assetId: 'GEC-KOL-SRV-0001', name: 'Dell PowerEdge R740', locationName: 'Kolkata Site' },
  { id: 'a7', assetId: 'GEC-PUN-PRN-0001', name: 'Canon LBP 6030', locationName: 'Pune Office' },
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

function QRItem({ asset }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(
      canvasRef.current,
      asset.assetId,
      { width: 120, margin: 2, color: { dark: '#023957', light: '#ffffff' } },
      () => {},
    )
  }, [asset.assetId])

  const handleDownload = () => {
    if (!canvasRef.current) return
    const url = canvasRef.current.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${asset.assetId}-qr.png`
    a.click()
  }

  const handlePrint = () => {
    if (!canvasRef.current) return
    const url = canvasRef.current.toDataURL('image/png')
    const win = window.open('')
    if (win) {
      win.document.write(
        `<html><body style="text-align:center;padding:20px;font-family:Inter,system-ui"><h3>${asset.assetId}</h3><br><img src="${url}" /><br><p>${asset.name}</p><p>${asset.locationName}</p></body></html>`,
      )
      win.print()
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col items-center gap-3">
      <canvas ref={canvasRef} className="rounded-lg" />
      <div className="text-center">
        <p className="text-xs font-mono font-semibold text-secondary">{asset.assetId}</p>
        <p className="text-xs font-medium text-gray-700 mt-0.5">{asset.name}</p>
        <p className="text-xs text-gray-400">{asset.locationName}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={handleDownload} type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary border border-secondary/30 rounded-lg hover:bg-secondary/5 cursor-pointer whitespace-nowrap transition-colors">
          <i className="ri-download-line" aria-hidden /> Download
        </button>
        <button onClick={handlePrint} type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap transition-colors">
          <i className="ri-printer-line" aria-hidden /> Print
        </button>
      </div>
    </div>
  )
}

export default function EAMQRCodesProject() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ASSETS
    return ASSETS.filter((a) => a.name.toLowerCase().includes(q) || a.assetId.toLowerCase().includes(q))
  }, [search])

  return (
    <div className="min-h-screen" style={{ background: '#f5f7fa' }}>
      <Sidebar sidebarCollapsed={sidebarCollapsed} />
      <TopHeader
        title="Asset QR Codes"
        icon="ri-qr-code-line"
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
      />
      <main className="relative min-h-screen pt-16 transition-all duration-300 ease-in-out" style={{ marginLeft: sidebarCollapsed ? '64px' : '240px' }}>
        <div className="p-6 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Asset QR Codes</h1>
            <p className="text-sm text-gray-500 mt-0.5">View, download and print QR codes for all assets</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden />
              <input
                type="text"
                placeholder="Search by name or Asset ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <span className="text-xs text-gray-400">{filtered.length} assets</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map((asset) => (
              <QRItem key={asset.id} asset={asset} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

