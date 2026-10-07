/**
 * User Hub — tasks page.
 * Assigned / Created follow the login email:
 * - Assigned → $assignee_email={login email} (assignee is externalemail when Assigned_To is missing)
 * - Created  → $requester_email={login email}
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import ProjectDashboardPage from './ProjectDashboardPage.jsx';
import UserHubTaskToolbar from './components/UserHubTaskToolbar.jsx';
import { useUserHubSession } from './lib/useUserHubSession.js';
import { useHubLoginScopeLists } from './lib/useHubLoginScopeLists.js';
import { fetchEmployeeTasksByScope } from './lib/kfEmployeeTasksReport.js';
import { PM_TASK_DETAILS_SAVED } from './lib/pmTaskDetails.js';
import { deleteTaskDraftRecords, resolveTaskDraftDeleteId } from './lib/kfPmTaskProcessItems.js';
import {
  openUserHubSubtaskPopup,
  openUserHubTaskCreatePopup,
  openUserHubTaskPopup,
} from './lib/kfUserHubPopups.js';

export default function UserHubTasksPage({ useLayout = false, isActive = true }) {
  const { kfInstance, scopeUser, loginEmail, firstName, greeting } = useUserHubSession();

  const [taskScope, setTaskScope] = useState('assigned');
  const [createdStatusFilter, setCreatedStatusFilter] = useState('Draft');
  const [assignedStatus, setAssignedStatus] = useState('open');
  const [selectedDraftIds, setSelectedDraftIds] = useState(() => new Set());
  const [deletingDrafts, setDeletingDrafts] = useState(false);

  const fetchByScope = useCallback(
    (kf, options) => fetchEmployeeTasksByScope(kf, options),
    [],
  );

  const {
    scopedRows: processTasks,
    assignedRows,
    createdRows,
    loading: processTasksLoading,
    statusCounts,
    scopeCounts: taskCounts,
    bumpRefresh,
    removeRowsByIds,
  } = useHubLoginScopeLists({
    kfInstance,
    loginEmail,
    fetchByScope,
    listKey: 'tasks',
    enabled: true,
    taskScope,
    assignedStatus,
    createdStatusFilter,
  });

  useEffect(() => {
    setSelectedDraftIds(new Set());
  }, [taskScope, createdStatusFilter, assignedStatus]);

  const handleTaskScopeChange = useCallback((scope) => {
    setTaskScope(scope);
    if (scope === 'assigned') setAssignedStatus('open');
    if (scope === 'created') setCreatedStatusFilter('Draft');
  }, []);

  const handleToggleRowSelect = useCallback((id) => {
    if (!id) return;
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAllRowsSelect = useCallback((checked, pageRowIds) => {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      (pageRowIds || []).forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }, []);

  const handleDeleteDrafts = useCallback(async () => {
    const ids = Array.from(selectedDraftIds).filter(Boolean);
    if (!ids.length || !kfInstance) return;
    const confirmed = window.confirm(`Delete ${ids.length} selected draft task(s)? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingDrafts(true);
    try {
      const { successIds, failed } = await deleteTaskDraftRecords(kfInstance, ids);
      if (successIds.length) {
        removeRowsByIds(successIds, resolveTaskDraftDeleteId);
        setSelectedDraftIds((prev) => {
          const next = new Set(prev);
          successIds.forEach((id) => next.delete(id));
          return next;
        });
      }
      if (failed > 0) {
        window.alert(`${successIds.length} draft(s) deleted, ${failed} failed.`);
      } else if (successIds.length) {
        window.alert(`${successIds.length} draft(s) deleted successfully.`);
      }
    } catch (e) {
      console.warn('UserHub draft delete failed:', e?.message || e);
      window.alert('Delete failed. Please try again.');
    } finally {
      setDeletingDrafts(false);
    }
  }, [kfInstance, selectedDraftIds, removeRowsByIds]);

  const showDraftBulkSelect = taskScope === 'created' && createdStatusFilter === 'Draft';

  const taskTableToolbar = useMemo(
    () => (
      <UserHubTaskToolbar
        taskScope={taskScope}
        onTaskScopeChange={handleTaskScopeChange}
        createdTotal={taskCounts.created}
        assignedTotal={taskCounts.assignedOpen + taskCounts.assignedClosed}
        createdStatusFilter={createdStatusFilter}
        onCreatedStatusChange={setCreatedStatusFilter}
        statusCounts={statusCounts}
        assignedStatus={assignedStatus}
        onAssignedStatusChange={setAssignedStatus}
        assignedOpenCount={taskCounts.assignedOpen}
        assignedClosedCount={taskCounts.assignedClosed}
        showDeleteDrafts={showDraftBulkSelect}
        selectedDraftCount={selectedDraftIds.size}
        deletingDrafts={deletingDrafts}
        onDeleteDrafts={handleDeleteDrafts}
      />
    ),
    [
      taskScope,
      handleTaskScopeChange,
      taskCounts,
      createdStatusFilter,
      statusCounts,
      assignedStatus,
      showDraftBulkSelect,
      selectedDraftIds.size,
      deletingDrafts,
      handleDeleteDrafts,
    ],
  );

  const metricsRows = useMemo(
    () => (taskScope === 'created' ? createdRows : assignedRows),
    [taskScope, createdRows, assignedRows],
  );

  const hubWelcome = useMemo(
    () => ({
      greeting,
      firstName,
      displayRole: 'Employee',
      email: loginEmail || scopeUser?.Email,
      subtitle: 'Your tasks · Employee',
    }),
    [greeting, firstName, loginEmail, scopeUser?.Email],
  );

  const scheduleRefreshAfterPopup = useCallback(() => {
    setTimeout(bumpRefresh, 300);
  }, [bumpRefresh]);

  useEffect(() => {
    const onSaved = () => scheduleRefreshAfterPopup();
    window.addEventListener(PM_TASK_DETAILS_SAVED, onSaved);
    return () => window.removeEventListener(PM_TASK_DETAILS_SAVED, onSaved);
  }, [scheduleRefreshAfterPopup]);

  const handleOpenTaskRow = useCallback(
    (row) => openUserHubTaskPopup(kfInstance, row, { onClosed: scheduleRefreshAfterPopup }),
    [kfInstance, scheduleRefreshAfterPopup],
  );

  const handleOpenSubtaskRow = useCallback(
    (row) => {
      openUserHubSubtaskPopup(kfInstance, row, { onClosed: scheduleRefreshAfterPopup });
    },
    [kfInstance, scheduleRefreshAfterPopup],
  );

  const handleCreateTask = useCallback(() => {
    openUserHubTaskCreatePopup(kfInstance, { onClosed: scheduleRefreshAfterPopup });
  }, [kfInstance, scheduleRefreshAfterPopup]);

  return (
    <div className="min-h-screen overflow-x-clip bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff]">
      <div className="mx-auto min-w-0 max-w-[1800px] p-3 pb-6 sm:p-6">
        <ProjectDashboardPage
          useLayout={useLayout}
          scopeToCurrentUser
          scopeUser={scopeUser}
          contentView="tasks"
          overrideTasks={processTasks}
          overrideTasksLoading={processTasksLoading}
          overrideTasksForMetrics={metricsRows}
          overrideTasksForMetricsLoading={processTasksLoading}
          hideUserScopeToggle
          hideWelcomeHeader
          embeddedInHub
          hideCompanyFunctionFilters
          hubWelcome={hubWelcome}
          onCreateTaskRecord={handleCreateTask}
          taskTableToolbar={taskTableToolbar}
          onOpenTaskRow={handleOpenTaskRow}
          onOpenSubtaskRow={handleOpenSubtaskRow}
          taskBulkSelectEnabled={showDraftBulkSelect}
          taskSelectedRowIds={selectedDraftIds}
          onTaskToggleRowSelect={handleToggleRowSelect}
          onTaskToggleAllRowsSelect={handleToggleAllRowsSelect}
          getTaskRowSelectId={resolveTaskDraftDeleteId}
        />
      </div>
    </div>
  );
}
