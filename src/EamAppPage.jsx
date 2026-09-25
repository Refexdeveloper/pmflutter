import { useLocation } from 'react-router-dom'
import EamShell from '@eam/EamShell'

export default function EamAppPage() {
  const location = useLocation()
  const pathname = String(location?.pathname || '')
  const subpath = pathname.startsWith('/eam') ? pathname.slice('/eam'.length) : pathname
  const initialRoute = subpath && subpath.startsWith('/') ? subpath : '/'

  return <EamShell initialRoute={initialRoute || '/'} />
}

