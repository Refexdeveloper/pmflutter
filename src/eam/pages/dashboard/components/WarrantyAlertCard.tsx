import { assets } from '@eam/mocks/assets'

export const WarrantyAlertCard = () => {
  const today = new Date('2026-03-31')
  const in30Days = new Date(today)
  in30Days.setDate(in30Days.getDate() + 30)
  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)

  const expiring = assets
    .filter((a) => {
      const exp = new Date(a.warrantyExpiry)
      return exp >= today && exp <= in30Days
    })
    .sort((a, b) => new Date(a.warrantyExpiry).getTime() - new Date(b.warrantyExpiry).getTime())

  const getDaysLeft = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const critical = expiring.filter((a) => getDaysLeft(a.warrantyExpiry) <= 7).length
  const warning = expiring.filter((a) => getDaysLeft(a.warrantyExpiry) > 7).length

  if (expiring.length === 0) return null

  return (
    <div
      className="animate-fade-up stagger-2 overflow-hidden rounded-2xl"
      style={{ background: '#fff', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{
          background: 'linear-gradient(90deg, #fffbeb 0%, #fef9ec 100%)',
          borderBottom: '1px solid #fde68a',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: '#fef3c7' }}>
            <i className="ri-alert-line text-base" style={{ color: '#d97706' }} />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-gray-800">Warranty Expiry Alerts</h3>
            <p className="mt-0.5 text-xs text-gray-500">{expiring.length} asset(s) expiring within 30 days</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {critical > 0 ? (
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <i className="ri-fire-line text-[10px]" />
              {critical} Critical
            </span>
          ) : null}
          {warning > 0 ? (
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: '#fef3c7', color: '#d97706' }}>
              {warning} Warning
            </span>
          ) : null}
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {expiring.map((asset, idx) => {
          const days = getDaysLeft(asset.warrantyExpiry)
          const isCritical = days <= 7
          const pct = Math.max(5, Math.min(100, Math.round((days / 30) * 100)))

          return (
            <div key={asset.id} className={`hover-row flex items-center justify-between px-5 py-3.5 animate-fade-up stagger-${idx + 1}`}>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: isCritical ? '#fee2e2' : '#fef3c7' }}>
                  <i className="ri-computer-line text-sm" style={{ color: isCritical ? '#dc2626' : '#d97706' }} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{asset.name}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="text-[11px] text-gray-400">{asset.assetId}</p>
                    <span className="text-gray-300">·</span>
                    <p className="text-[11px] text-gray-400">{asset.locationName}</p>
                  </div>
                  <div className="mt-1.5 w-28 progress-bar">
                    <div
                      className="progress-fill"
                      style={
                        {
                          '--progress': `${pct}%`,
                          background: isCritical
                            ? 'linear-gradient(90deg, #dc2626, #ef4444)'
                            : 'linear-gradient(90deg, #d97706, #fbbf24)',
                        } as React.CSSProperties
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="ml-4 flex-shrink-0 text-right">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{
                    background: isCritical ? '#fee2e2' : '#fef3c7',
                    color: isCritical ? '#dc2626' : '#d97706',
                  }}
                >
                  <i className={`${isCritical ? 'ri-fire-line' : 'ri-time-line'} text-[10px]`} />
                  {days}d left
                </span>
                <p className="mt-1 text-[10px] text-gray-400">{asset.warrantyExpiry}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between px-5 py-3" style={{ background: '#fafafa', borderTop: '1px solid #f3f4f6' }}>
        <p className="text-[11px] text-gray-400">Last checked: 31 Mar 2026, 09:00 AM</p>
        <button type="button" className="btn-press flex cursor-pointer items-center gap-1 text-[11px] font-semibold transition-opacity hover:opacity-80" style={{ color: '#023957' }}>
          View Warranty Tab <i className="ri-arrow-right-line text-[11px]" />
        </button>
      </div>
    </div>
  )
}

