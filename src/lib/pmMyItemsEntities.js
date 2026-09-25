/**
 * Entity configs for PM My Items Pro — Project Tracker dashboards theme + APIs.
 */

export const DEFAULT_ACCOUNT_ID = 'AcCMptp3yqcn'

const BASE_COLUMNS = [
  { id: 'vendor', label: 'Owner', width: 'min-w-[180px]' },
  { id: 'contractCategory', label: 'Priority', width: 'min-w-[100px]' },
  { id: 'createdAt', label: 'Date Created', width: 'min-w-[140px]' },
  { id: 'valueDisplay', label: 'Progress', width: 'min-w-[120px]' },
  { id: 'status', label: 'Status', width: 'min-w-[100px]' },
  { id: 'sla', label: 'Due / SLA', width: 'min-w-[110px]' },
  { id: 'endDate', label: 'End Date', width: 'min-w-[100px]' },
]

function makeLabels(entitySingular, entityPlural, icon) {
  return {
    entitySingular,
    entityPlural,
    newButton: `New ${entitySingular}`,
    searchPlaceholder: `Search ${entityPlural.toLowerCase()}…`,
    myItemsEmpty: `No ${entityPlural.toLowerCase()} found`,
    myTasksEmpty: 'No open items assigned to you',
    reviewStepFallback: `Review ${entitySingular.toLowerCase()}`,
    totalKpi: `Total ${entityPlural}`,
    activeKpi: `Active ${entityPlural}`,
    dueSoonKpi: 'Due Soon',
    overdueKpi: 'Overdue',
    unassignedKpi: 'Unassigned',
    delayedKpi: 'Delayed',
    highPriorityKpi: 'High Priority',
    peopleKpi: 'Unique Owners',
    footnotePct: `% of ${entityPlural.toLowerCase()}`,
    pageTitle: entityPlural,
    icon,
  }
}

/** Projects — same API as ProjectDashboardPage (Project_Management_A01) */
export const PROJECTS_ENTITY = {
  key: 'projects',
  kind: 'case',
  usePtDashboardApis: true,
  accountFallback: DEFAULT_ACCOUNT_ID,
  caseId: 'Project_Management_A01',
  popupId: 'Popup_RWeNJp0JqJ',
  popupEnvKey: 'VITE_KF_PROJECT_POPUP_ID',
  statusOptions: ['Active', 'Planning', 'Completed', 'On Hold', 'Overdue'],
  statusToSegment: {},
  columns: BASE_COLUMNS.map((c) =>
    c.id === 'contractCategory' ? { ...c, label: 'Department' } : c,
  ),
  labels: makeLabels('Project', 'Projects', 'ri-folder-3-line'),
  applicationIdFallback: 'Project_Management_A01',
  fieldKeys: {},
}

/** Kissflow process myitems status tabs (same shape as ContractsMyItemsPro). */
const PROCESS_MYITEMS_STATUS_OPTIONS = ['Draft', 'In progress', 'Completed', 'Withdrawn', 'Rejected']
const PROCESS_MYITEMS_STATUS_TO_SEGMENT = {
  Draft: 'draft',
  'In progress': 'inprogress',
  Completed: 'completed',
  Withdrawn: 'withdrawn',
  Rejected: 'rejected',
}

/**
 * Tasks — ContractsMyItemsPro API pattern with:
 * App: Project_Management_A01 · Process: Project_Sub_Task_A01
 * Create: POST draft → open Popup_bEJJgrdutd with InstanceID + ActivityInstanceID
 */
export const TASKS_ENTITY = {
  key: 'tasks',
  kind: 'process',
  usePtDashboardApis: false,
  accountFallback: DEFAULT_ACCOUNT_ID,
  processId: 'Project_Sub_Task_A01',
  popupId: 'Popup_bEJJgrdutd',
  popupEnvKey: 'VITE_KF_TASK_POPUP_ID',
  /** Popup param names required by Popup_bEJJgrdutd */
  popupParamKeys: {
    instanceId: 'InstanceID',
    activityInstanceId: 'ActivityInstanceID',
  },
  /** New Task: create process draft first, then open popup with the returned ids */
  createDraftOnNew: true,
  createDraftBody: {},
  statusOptions: PROCESS_MYITEMS_STATUS_OPTIONS,
  statusToSegment: PROCESS_MYITEMS_STATUS_TO_SEGMENT,
  columns: BASE_COLUMNS.map((c) =>
    c.id === 'vendor'
      ? { ...c, label: 'Assignee' }
      : c.id === 'contractCategory'
        ? { ...c, label: 'Project' }
        : c,
  ),
  labels: makeLabels('Task', 'Tasks', 'ri-task-line'),
  applicationIdFallback: 'Project_Management_A01',
  fieldKeys: {},
}

/**
 * Subtasks — ContractsMyItemsPro API pattern with:
 * App: Project_Management_A01 · Process: Sub_Task_Process_A00
 * Create: POST draft → open Popup_QTJQAyhxOR with InstanceID + ActivityInstanceID
 */
export const SUBTASKS_ENTITY = {
  key: 'subtasks',
  kind: 'process',
  usePtDashboardApis: false,
  accountFallback: DEFAULT_ACCOUNT_ID,
  processId: 'Sub_Task_Process_A00',
  popupId: 'Popup_QTJQAyhxOR',
  popupEnvKey: 'VITE_KF_SUBTASK_POPUP_ID',
  /** Popup param names required by Popup_QTJQAyhxOR */
  popupParamKeys: {
    instanceId: 'InstanceID',
    activityInstanceId: 'ActivityInstanceID',
  },
  /** New Subtask: create process draft first, then open popup with the returned ids */
  createDraftOnNew: true,
  createDraftBody: {},
  statusOptions: PROCESS_MYITEMS_STATUS_OPTIONS,
  statusToSegment: PROCESS_MYITEMS_STATUS_TO_SEGMENT,
  columns: BASE_COLUMNS.map((c) =>
    c.id === 'vendor'
      ? { ...c, label: 'Assignee' }
      : c.id === 'contractCategory'
        ? { ...c, label: 'Parent Task' }
        : c,
  ),
  labels: makeLabels('Subtask', 'Subtasks', 'ri-node-tree'),
  applicationIdFallback: 'Project_Management_A01',
  fieldKeys: {},
}

/** Change Requests — same API as CRDashboard (Change_Request_A01) */
export const CR_ENTITY = {
  key: 'changeRequests',
  kind: 'process',
  usePtDashboardApis: true,
  accountFallback: DEFAULT_ACCOUNT_ID,
  processId: 'Change_Request_A01',
  popupId: 'Popup_mS9FovL2TO',
  popupEnvKey: 'VITE_KF_CR_POPUP_ID',
  statusOptions: ['Open', 'In Progress', 'Completed', 'Overdue'],
  statusToSegment: {},
  columns: BASE_COLUMNS.map((c) =>
    c.id === 'vendor'
      ? { ...c, label: 'Owner' }
      : c.id === 'contractCategory'
        ? { ...c, label: 'Project' }
        : c.id === 'valueDisplay'
          ? { ...c, label: 'Priority' }
          : c,
  ),
  labels: {
    ...makeLabels('Change Request', 'Change Requests', 'ri-git-pull-request-line'),
    newButton: 'New Change Request',
    reviewStepFallback: 'Review change request',
  },
  applicationIdFallback: 'Project_Management_A01',
  fieldKeys: {},
}
