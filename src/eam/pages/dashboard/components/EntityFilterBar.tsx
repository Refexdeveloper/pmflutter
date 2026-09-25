import { useState } from 'react'
import { assets } from '@eam/mocks/assets'
import { companies } from '@eam/mocks/companies'

interface Props {
  selectedEntity: string
  onEntityChange: (entityId: string) => void
}

export const EntityFilterBar = ({ selectedEntity, onEntityChange }: Props) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const entityStats = [
    {
      id: 'all',
      name: 'All Entities',
      code: 'ALL',
      total: assets.length,
      available: assets.filter((a) => a.status === 'Available').length,
      assigned: assets.filter((a) => a.status === 'Assigned').length,
      lost: assets.filter((a) => a.status === 'Lost').length,
      maintenance: assets.filter((a) => a.status === 'Maintenance').length,
    },
    ...companies.map((company) => {
      const compAssets = assets.filter((a) => a.companyId === company.id)
      return {
        id: company.id,
        name: company.name,
        code: company.code,
        total: compAssets.length,
        available: compAssets.filter((a) => a.status === 'Available').length,
        assigned: compAssets.filter((a) => a.status === 'Assigned').length,
        lost: compAssets.filter((a) => a.status === 'Lost').length,
        maintenance: compAssets.filter((a) => a.status === 'Maintenance').length,
      }
    }),
  ]

  return (
    <div
      className="animate-fade-up rounded-2xl p-5"
      style={{ background: '#fff', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: '#e6eef3' }}>
            <i className="ri-building-2-line text-sm" style={{ color: '#023957' }} />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-gray-800">Entity Overview</h3>
            <p className="text-[11px] text-gray-400">Filter dashboard by company entity</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: '#e6eef3', color: '#023957' }}>
          <i className="ri-filter-3-line text-[11px]" />
          {selectedEntity === 'all' ? 'All Entities' : companies.find((c) => c.id === selectedEntity)?.code}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {entityStats.map((entity) => {
          const isActive = selectedEntity === entity.id
          const isHovered = hoveredId === entity.id

          return (
            <button
              key={entity.id}
              type="button"
              onClick={() => onEntityChange(entity.id)}
              onMouseEnter={() => setHoveredId(entity.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="relative cursor-pointer whitespace-nowrap rounded-xl p-4 text-left transition-all duration-200"
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, #023957 0%, #145d7c 100%)'
                  : isHovered
                    ? '#f8fafc'
                    : '#fafafa',
                border: isActive ? '1.5px solid #023957' : '1.5px solid #f1f5f9',
                transform: isActive || isHovered ? 'translateY(-1px)' : 'none',
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span
                  className="rounded-md px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.2)' : '#e6eef3',
                    color: isActive ? '#fff' : '#023957',
                  }}
                >
                  {entity.code}
                </span>
                {isActive ? (
                  <div className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: '#fcc40f' }}>
                    <i className="ri-check-line text-[9px] font-bold" style={{ color: '#023957' }} />
                  </div>
                ) : null}
              </div>

              <p className="font-display text-2xl font-extrabold leading-none" style={{ color: isActive ? '#fff' : '#023957' }}>
                {entity.total}
              </p>
              <p className="mt-1 text-[11px] font-medium leading-tight" style={{ color: isActive ? 'rgba(255,255,255,0.8)' : '#64748b' }}>
                {entity.id === 'all'
                  ? 'Total Assets'
                  : entity.name.length > 18
                    ? `${entity.name.slice(0, 16)}…`
                    : entity.name}
              </p>

              <div className="mt-3 flex gap-1">
                {entity.available > 0 ? (
                  <div
                    className="h-1 flex-shrink-0 rounded-full"
                    style={{
                      width: `${Math.round((entity.available / entity.total) * 100)}%`,
                      background: isActive ? 'rgba(255,255,255,0.6)' : '#15803d',
                      minWidth: 4,
                    }}
                    title={`Available: ${entity.available}`}
                  />
                ) : null}
                {entity.assigned > 0 ? (
                  <div
                    className="h-1 flex-shrink-0 rounded-full"
                    style={{
                      width: `${Math.round((entity.assigned / entity.total) * 100)}%`,
                      background: isActive ? 'rgba(255,255,255,0.4)' : '#0284c7',
                      minWidth: 4,
                    }}
                    title={`Assigned: ${entity.assigned}`}
                  />
                ) : null}
                {entity.lost > 0 ? (
                  <div
                    className="h-1 flex-shrink-0 rounded-full"
                    style={{
                      width: `${Math.round((entity.lost / entity.total) * 100)}%`,
                      background: isActive ? 'rgba(255,255,255,0.3)' : '#dc2626',
                      minWidth: 4,
                    }}
                    title={`Lost: ${entity.lost}`}
                  />
                ) : null}
                {entity.maintenance > 0 ? (
                  <div
                    className="h-1 flex-shrink-0 rounded-full"
                    style={{
                      width: `${Math.round((entity.maintenance / entity.total) * 100)}%`,
                      background: isActive ? 'rgba(255,255,255,0.2)' : '#d97706',
                      minWidth: 4,
                    }}
                    title={`Maintenance: ${entity.maintenance}`}
                  />
                ) : null}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] font-medium" style={{ color: isActive ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}>
                  <span style={{ color: isActive ? '#fff' : '#15803d' }}>{entity.available}</span> avail
                </span>
                <span style={{ color: isActive ? 'rgba(255,255,255,0.3)' : '#e2e8f0' }}>·</span>
                <span className="text-[10px] font-medium" style={{ color: isActive ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}>
                  <span style={{ color: isActive ? '#fff' : '#0284c7' }}>{entity.assigned}</span> assigned
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

