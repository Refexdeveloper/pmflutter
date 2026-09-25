/**
 * User dashboard — same ProjectDashboardPage UI (insights, health monitors,
 * tables with column header filters/sort, period picker, etc.).
 *
 * User mode via scopeToCurrentUser:
 * - Me → assignee/owner slice of the full portfolio
 * - My Team → manager reports My_Team_A05 / My_Team_A04 with the same L1/L2
 *   client scoping as UserSpecificPT
 */
import ProjectDashboardPage from './ProjectDashboardPage.jsx';

export default function UserDashboardPage({ useLayout = false }) {
  return <ProjectDashboardPage useLayout={useLayout} scopeToCurrentUser />;
}
