/**
 * User Hub — projects page.
 * Shows projects for the login user (owner / steward / assigned tasks).
 */
import { useCallback, useMemo } from 'react';
import ProjectDashboardPage from './ProjectDashboardPage.jsx';
import { useUserHubSession } from './lib/useUserHubSession.js';
import { openUserHubProjectCreatePopup, openUserHubProjectPopup } from './lib/kfUserHubPopups.js';

export default function UserHubProjectsPage({ useLayout = false, isActive = true }) {
  const { kfInstance, scopeUser, loginEmail, firstName, greeting } = useUserHubSession();

  const handleOpenProjectRow = useCallback(
    (row) => openUserHubProjectPopup(kfInstance, row),
    [kfInstance],
  );

  const handleCreateProject = useCallback(
    () => openUserHubProjectCreatePopup(kfInstance),
    [kfInstance],
  );

  const hubWelcome = useMemo(
    () => ({
      greeting,
      firstName,
      displayRole: 'Employee',
      email: loginEmail || scopeUser?.Email,
      subtitle: 'Your projects',
    }),
    [greeting, firstName, loginEmail, scopeUser?.Email],
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff]">
      <div className="mx-auto min-w-0 max-w-[1800px] p-3 pb-6 sm:p-6">
        <ProjectDashboardPage
          useLayout={useLayout}
          scopeUser={scopeUser}
          contentView="projects"
          scopeToCurrentUser
          hideUserScopeToggle
          hideWelcomeHeader
          embeddedInHub
          hubWelcome={hubWelcome}
          onCreateProjectRecord={handleCreateProject}
          onOpenProjectRow={handleOpenProjectRow}
        />
      </div>
    </div>
  );
}
