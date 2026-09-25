import { useContext, useMemo } from 'react'
import { KissflowSDKContext } from './sdk/context.jsx'
import { resolvePmRoleKey } from './lib/pmRoles.js'
import UserDashboardProject from './UserDashboardProject.jsx'
import UserSpecificPT from './UserSpecificPT.jsx'
import EmployeeDashboardProject from './EmployeeDashboardProject.jsx'

/**
 * Inside Kissflow each page already embeds one role component.
 * Hosted outside Kissflow, pick the same UI from the person's role.
 */
export default function PmRoleShell({ embeddedFallback = null }) {
  const { kf, sdkFailed, identityReady } = useContext(KissflowSDKContext)

  const view = useMemo(() => {
    if (!sdkFailed) return 'embedded'
    return resolvePmRoleKey(kf?.user, 'employee')
  }, [sdkFailed, kf])

  if (!identityReady) {
    return embeddedFallback
  }

  if (view === 'embedded') {
    return embeddedFallback || <UserDashboardProject />
  }
  if (view === 'pm') return <UserSpecificPT useLayout={false} />
  return <EmployeeDashboardProject useLayout={false} />
}
