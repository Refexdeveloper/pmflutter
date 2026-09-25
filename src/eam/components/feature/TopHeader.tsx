import { useState } from 'react'
import { useAppContext } from '@eam/context/AppContext'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES: Record<string, { title: string; icon: string }> = {
  '/': { title: 'Dashboard', icon: 'ri-dashboard-3-line' },
  '/assets': { title: 'Asset Master', icon: 'ri-server-line' },
  '/assign': { title: 'Assign Asset', icon: 'ri-user-add-line' },
  '/my-assets': { title: 'My Assets', icon: 'ri-briefcase-line' },
  '/requests': { title: 'Asset Requests', icon: 'ri-file-list-3-line' },
  '/warranty': { title: 'Warranty Tracking', icon: 'ri-shield-check-line' },
  '/qr-codes': { title: 'Asset QR Codes', icon: 'ri-qr-code-line' },
  '/company-location': { title: 'Company & Locations', icon: 'ri-building-2-line' },
}

export const TopHeader = () => {
  const { role, setRole, sidebarCollapsed, setSidebarCollapsed, addToast } = useAppContext()
  const { pathname } = useLocation()
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchVal, setSearchVal] = useState('')

  const pageInfo = PAGE_TITLES[pathname] || { title: 'EAM Suite', icon: 'ri-apps-line' }

  const handleRoleToggle = (newRole: 'manager' | 'employee') => {
    setRole(newRole)
    addToast(`Switched to ${newRole === 'manager' ? 'Asset Manager' : 'Employee'} view`, 'info')
  }

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
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="btn-press flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600"
        >
          <i className={`${sidebarCollapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'} text-base`} />
        </button>

        <span className="h-5 w-px bg-gray-200" />

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: '#e6eef3' }}>
            <i className={`${pageInfo.icon} text-sm`} style={{ color: '#023957' }} />
          </div>
          <div>
            <h2 className="font-display leading-none text-sm font-semibold text-gray-800">{pageInfo.title}</h2>
            <p className="mt-0.5 text-[10px] text-gray-400">Meridian Infra Pvt Ltd · 31 Mar 2026</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className={`hidden items-center gap-2 rounded-xl border px-3 py-1.5 transition-all duration-200 md:flex ${
            searchFocused ? 'w-52 border-primary/40 bg-white' : 'w-40 border-gray-200 bg-gray-50/80 hover:border-gray-300'
          }`}
        >
          <i className="ri-search-line flex-shrink-0 text-sm text-gray-400" />
          <input
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search assets..."
            className="w-full bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="flex items-center gap-0.5 rounded-xl p-0.5" style={{ background: '#f0f4f8' }}>
          {(['manager', 'employee'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRoleToggle(r)}
              className={`btn-press cursor-pointer whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 ${
                role === r ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
              style={role === r ? { background: '#023957' } : {}}
            >
              {r === 'manager' ? 'Asset Manager' : 'Employee'}
            </button>
          ))}
        </div>

        <span className="hidden h-5 w-px bg-gray-200 md:block" />

        <div className="group flex cursor-pointer items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold transition-transform group-hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #023957, #145d7c)',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(2,57,87,0.3)',
            }}
          >
            {role === 'manager' ? 'AM' : 'EM'}
          </div>
          <div className="hidden lg:block">
            <p className="text-[12px] font-semibold leading-none text-gray-800">
              {role === 'manager' ? 'Asset Manager' : 'Arjun Mehta'}
            </p>
            <p className="mt-0.5 text-[10px] text-gray-400">{role === 'manager' ? 'Admin Access' : 'Employee'}</p>
          </div>
          <i className="ri-arrow-down-s-line hidden text-xs text-gray-400 lg:block" />
        </div>
      </div>
    </header>
  )
}

