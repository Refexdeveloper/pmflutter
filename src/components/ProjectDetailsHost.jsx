import { useContext, useEffect, useState } from 'react'
import { KissflowSDKContext } from '../sdk/context.jsx'
import { PM_OPEN_PROJECT_DETAILS } from '../lib/pmProjectDetails.js'
import ProjectDetailsForm from './ProjectDetailsForm.jsx'

export default function ProjectDetailsHost() {
  const { kf } = useContext(KissflowSDKContext)
  const [session, setSession] = useState(null)

  useEffect(() => {
    const onOpen = (event) => {
      setSession({
        key: Date.now(),
        defaults: event?.detail && typeof event.detail === 'object' ? event.detail : {},
      })
    }
    window.addEventListener(PM_OPEN_PROJECT_DETAILS, onOpen)
    return () => window.removeEventListener(PM_OPEN_PROJECT_DETAILS, onOpen)
  }, [])

  if (!session) return null
  return (
    <ProjectDetailsForm
      key={session.key}
      kf={kf}
      defaults={session.defaults}
      onClose={() => setSession(null)}
    />
  )
}
