import UserHubProjectsPage from './UserHubProjectsPage.jsx';

/** @deprecated Use UserHubProjectsProject — combined hub removed; projects-only page. */
export default function UserHubProject() {
  return <UserHubProjectsPage useLayout={false} />;
}
