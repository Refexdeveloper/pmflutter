import { Link, useLocation } from 'react-router-dom'
import { useAppContext } from '@eam/context/AppContext'

interface NavItem {
  label: string
  icon: string
  path: string
  managerOnly?: boolean
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'ri-dashboard-3-line', path: '/' },
  { label: 'Asset Master', icon: 'ri-server-line', path: '/assets', managerOnly: true },
  { label: 'Assign Asset', icon: 'ri-user-add-line', path: '/assign', managerOnly: true },
  { label: 'My Assets', icon: 'ri-briefcase-line', path: '/my-assets' },
  { label: 'Asset Requests', icon: 'ri-file-list-3-line', path: '/requests', badge: 3 },
  { label: 'Warranty Tracking', icon: 'ri-shield-check-line', path: '/warranty', managerOnly: true },
  { label: 'Asset QR', icon: 'ri-qr-code-line', path: '/qr-codes', managerOnly: true },
  { label: 'Company & Locations', icon: 'ri-building-2-line', path: '/company-location', managerOnly: true },
]

const NAV_GROUPS = [
  { label: 'Overview', paths: ['/'] },
  { label: 'Assets', paths: ['/assets', '/assign', '/my-assets', '/qr-codes'] },
  { label: 'Requests', paths: ['/requests'] },
  { label: 'Monitoring', paths: ['/warranty'] },
  { label: 'Configuration', paths: ['/company-location'] },
]

export const Sidebar = () => {
  const { role, sidebarCollapsed } = useAppContext()
  const { pathname } = useLocation()

  const visibleItems = NAV_ITEMS.filter((item) => !item.managerOnly || role === 'manager')

  const getGroup = (path: string) => {
    for (const g of NAV_GROUPS) {
      if (g.paths.some((p) => p === path)) return g.label
    }
    return null
  }

  const renderedGroups = new Set<string>()

  return (
    <aside
      className={`fixed left-0 top-0 z-30 flex h-screen flex-col transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? 'w-[64px]' : 'w-[240px]'
      }`}
      style={{ background: 'linear-gradient(180deg, #023957 0%, #012d46 100%)' }}
    >
      <div
        className="flex min-h-[64px] flex-shrink-0 items-center gap-3 border-b px-4"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg"
          style={{ background: '#fcc40f' }}
        >
          <i className="ri-building-4-line text-sm" style={{ color: '#023957' }} />
        </div>
        {!sidebarCollapsed ? (
          <div className="animate-fade-in overflow-hidden">
            <p className="font-display whitespace-nowrap text-sm font-bold leading-tight text-white">EAM Suite</p>
            <p className="whitespace-nowrap text-[10px] text-white/40">Enterprise Asset Mgmt</p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        {visibleItems.map((item) => {
          const active = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path))
          const group = getGroup(item.path)
          const showGroup = Boolean(group && !renderedGroups.has(group))
          if (showGroup && group) renderedGroups.add(group)

          return (
            <div key={item.path}>
              {showGroup && group && !sidebarCollapsed ? (
                <p
                  className="select-none px-5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  {group}
                </p>
              ) : null}

              <div className="group relative mx-0 px-2">
                <Link
                  to={item.path}
                  className={`relative mb-0.5 flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 transition-all duration-200 ${
                    active ? 'text-white' : 'text-white/55 hover:bg-white/8 hover:text-white'
                  }`}
                  style={
                    active
                      ? {
                          background:
                            'linear-gradient(90deg, rgba(252,196,15,0.18) 0%, rgba(255,255,255,0.07) 100%)',
                          borderLeft: '3px solid #fcc40f',
                        }
                      : {}
                  }
                >
                  <div
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center transition-transform duration-200 ${
                      active ? '' : 'group-hover:scale-110'
                    }`}
                  >
                    <i className={`${item.icon} text-[15px]`} style={active ? { color: '#fcc40f' } : {}} />
                  </div>

                  {!sidebarCollapsed ? (
                    <span className="flex-1 whitespace-nowrap text-[13px] font-medium">{item.label}</span>
                  ) : null}

                  {!sidebarCollapsed && item.badge && role === 'manager' ? (
                    <span
                      className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: '#fcc40f', color: '#023957' }}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>

                {sidebarCollapsed ? (
                  <div
                    className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    style={{ background: '#023957', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}
                  >
                    {item.label}
                    <span
                      className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent"
                      style={{ borderRightColor: '#023957' }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="flex-shrink-0 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-2.5 px-3 py-3">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={{ background: 'rgba(252,196,15,0.2)', color: '#fcc40f' }}
            >
              {role === 'manager' ? 'AM' : 'EM'}
            </div>
            <div className="min-w-0 animate-fade-in">
              <p className="truncate text-[12px] font-semibold text-white">
                {role === 'manager' ? 'Asset Manager' : 'Arjun Mehta'}
              </p>
              <p className="truncate text-[10px] text-white/35">v1.0.0 · EAM Suite</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
              style={{ background: 'rgba(252,196,15,0.2)', color: '#fcc40f' }}
            >
              {role === 'manager' ? 'AM' : 'EM'}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

