import UserDashboardProject from './UserDashboardProject.jsx'
import PmRoleShell from './PmRoleShell.jsx'
import PmTrackerChrome from './PmTrackerChrome.jsx'

function App() {
  return (
    <div className="rootDiv">
      <PmTrackerChrome>
        <PmRoleShell embeddedFallback={<UserDashboardProject />} />
      </PmTrackerChrome>
    </div>
  )
}

export default App
