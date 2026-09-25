import UserDashboardPage from './UserDashboardPage.jsx';

/**
 * Kissflow custom component entry — pixel-identical ProjectDashboardPage UI
 * in user mode (Me / My Team). All tables, column filters, sorts, period
 * picker, insight/health cards live in ProjectDashboardPage; this file only
 * boots that page with scopeToCurrentUser.
 */
export default function UserDashboardProject() {
  return <UserDashboardPage useLayout={false} />;
}
