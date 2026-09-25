import { assets } from '@eam/mocks/assets'

interface KPI {
  label: string
  sublabel: string
  value: number
  icon: string
  gradient: string
  iconBg: string
  iconColor: string
  textColor: string
  trend?: { val: string; up: boolean }
}

export const DashboardKPIs = () => {
  const today = new Date('2026-03-31')
  const in30Days = new Date(today)
  in30Days.setDate(in30Days.getDate() + 30)

  const total = assets.length
  const available = assets.filter((a) => a.status === 'Available').length
  const assigned = assets.filter((a) => a.status === 'Assigned').length
  const lost = assets.filter((a) => a.status === 'Lost').length
  const warrantyExpiring = assets.filter((a) => {
    const exp = new Date(a.warrantyExpiry)
    return exp >= today && exp <= in30Days
  }).length

  const kpis: KPI[] = [
    {
      label: 'Total Assets',
      sublabel: 'All registered assets',
      value: total,
      icon: 'ri-server-line',
      gradient: 'linear-gradient(135deg, #023957 0%, #145d7c 100%)',
      iconBg: 'rgba(255,255,255,0.15)',
      iconColor: '#fff',
      textColor: '#fff',
      trend: { val: '+4 this month', up: true },
    },
    {
      label: 'Available',
      sublabel: 'Ready to assign',
      value: available,
      icon: 'ri-checkbox-circle-line',
      gradient: 'linear-gradient(135deg, #166534 0%, #15803d 100%)',
      iconBg: 'rgba(255,255,255,0.15)',
      iconColor: '#fff',
      textColor: '#fff',
      trend: { val: `${Math.round((available / total) * 100)}% of total`, up: true },
    },
    {
      label: 'Assigned',
      sublabel: 'Currently in use',
      value: assigned,
      icon: 'ri-user-shared-line',
      gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)',
      iconBg: 'rgba(255,255,255,0.15)',
      iconColor: '#fff',
      textColor: '#fff',
      trend: { val: `${Math.round((assigned / total) * 100)}% utilization`, up: true },
    },
    {
      label: 'Lost / Missing',
      sublabel: 'Needs attention',
      value: lost,
      icon: 'ri-error-warning-line',
      gradient: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)',
      iconBg: 'rgba(255,255,255,0.15)',
      iconColor: '#fff',
      textColor: '#fff',
      trend: { val: 'Action required', up: false },
    },
    {
      label: 'Warranty Expiring',
      sublabel: 'Next 30 days',
      value: warrantyExpiring,
      icon: 'ri-shield-check-line',
      gradient: 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
      iconBg: 'rgba(255,255,255,0.15)',
      iconColor: '#fff',
      textColor: '#fff',
      trend: { val: 'Review now', up: false },
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi, i) => (
        <div
          key={kpi.label}
          className={`kpi-card relative overflow-hidden rounded-2xl p-5 animate-fade-up stagger-${i + 1}`}
          style={{ background: kpi.gradient }}
        >
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10" style={{ background: '#fff' }} />
          <div className="absolute -right-2 top-8 h-12 w-12 rounded-full opacity-5" style={{ background: '#fff' }} />

          <div className="relative z-10 flex items-start justify-between">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: kpi.iconBg }}>
              <i className={`${kpi.icon} text-base`} style={{ color: kpi.iconColor }} />
            </div>
            <div
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            >
              <i className={`${kpi.trend?.up ? 'ri-arrow-up-line' : 'ri-alert-line'} text-[10px]`} />
            </div>
          </div>

          <div className="relative z-10 mt-4">
            <p className="font-display animate-count-up text-3xl font-extrabold leading-none" style={{ color: kpi.textColor }}>
              {kpi.value}
            </p>
            <p className="mt-1.5 text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {kpi.label}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {kpi.sublabel}
            </p>
          </div>

          <div className="relative z-10 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <p className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
              <i className={`${kpi.trend?.up ? 'ri-arrow-right-up-line' : 'ri-arrow-right-line'} mr-1 text-[11px]`} />
              {kpi.trend?.val}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

