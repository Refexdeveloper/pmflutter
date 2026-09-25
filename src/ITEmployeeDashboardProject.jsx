/* eslint-disable max-lines -- Kissflow IT Service Management employee dashboard */
import { useState, useContext, useEffect, useMemo, useCallback, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket, ChevronDown, ChevronUp, Sparkles, Clock, AlertTriangle, User, Calendar,
} from 'lucide-react';
import { KissflowSDKContext } from './sdk/index.js';
import {
  IT_THEME,
  IT_KPI_CARDS,
  IT_ROLE_CONFIG,
  CRITICALITY_STYLE,
  itemStatusClass,
  ITKpiCard,
  ITDashboardBackground,
  ITDashboardHeader,
  ITTableSectionHeader,
  ITTabButton,
  ITDetailTile,
} from './components/it/ITDashboardUI.jsx';
import {
  fetchITMyItems,
  fetchKpiFromVariables,
  mapReportRow,
  isMyItem,
  computeKpisFromRows,
  getWorkflowStepIndex,
  WORKFLOW_STEPS,
  STATUS_TABS,
  applyITFilters,
  matchesStatusTab,
  ITEM_STATUS_WAITING_LABEL,
} from './lib/kfITServiceDashboard.js';
import { MOCK_IT_REPORT, MOCK_IT_USER } from './mocks/itServiceRequests.js';

const TABLE_COLUMNS = [
  '',
  'Request ID',
  'Summary',
  'Ticket Type',
  'Category',
  'Sub-Category',
  'Criticality',
  'Item Status',
  'Current Step',
  'Requested',
  'Assigned To',
];

const COMPLETED_TAB_HIDDEN_COLUMNS = new Set(['Current Step', 'Assigned To']);

function getTableColumns(activeTab) {
  if (activeTab === 'Completed') {
    return TABLE_COLUMNS.filter((col) => !COMPLETED_TAB_HIDDEN_COLUMNS.has(col));
  }
  return TABLE_COLUMNS;
}

function StepTimeline({ currentStep, lastCompletedStep }) {
  const activeIdx = getWorkflowStepIndex(currentStep);
  return (
    <div className="space-y-0">
      {WORKFLOW_STEPS.map((step, idx) => {
        const done = idx < activeIdx || (lastCompletedStep && step.toLowerCase() === String(lastCompletedStep).toLowerCase());
        const active = idx === activeIdx;
        return (
          <div key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  done ? 'bg-emerald-500 text-white' : active ? 'bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 text-white ring-4 ring-indigo-100' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {done && !active ? '✓' : idx + 1}
              </div>
              {idx < WORKFLOW_STEPS.length - 1 && (
                <div className={`my-1 w-0.5 min-h-[24px] flex-1 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
              )}
            </div>
            <div className={`pb-5 pt-1 ${active ? 'font-semibold text-indigo-700' : done ? 'text-emerald-700' : 'text-slate-500'}`}>
              <p className="text-sm">{step}</p>
              {active && <p className="text-[11px] text-indigo-500">Current step</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatAttachments(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return '—';
  return attachments.map((a) => a?.name || 'file').join(', ');
}

function EmployeeExpandPanel({ row }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className={`${IT_THEME.expandPanel} px-4 py-5 sm:px-6`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={IT_THEME.expandIcon}>
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Request Details</p>
              <p className="text-sm font-semibold text-slate-800">{row.summary}</p>
            </div>
          </div>
          <span className={IT_THEME.stepBadge}>{row.currentStep}</span>
        </div>

        <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Workflow Steps</h3>
          <StepTimeline currentStep={row.currentStep} lastCompletedStep={row.lastCompletedStep} />
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ITDetailTile label="Request ID" value={row.requestId} />
          <ITDetailTile label="Ticket Type" value={row.ticketType} />
          <ITDetailTile label="Category" value={row.category} />
          <ITDetailTile label="Sub-Category" value={row.subCategory} />
          <ITDetailTile label="Criticality" value={row.criticality} />
          <ITDetailTile label="SLA (Minutes)" value={row.slaMinutes} />
          <ITDetailTile label="Item Status" value={row.itemStatus} />
          <ITDetailTile label="Workflow Status" value={row.statusLabel} />
          <ITDetailTile label="Current Step" value={row.currentStep} />
          <ITDetailTile label="Last Completed Step" value={row.lastCompletedStep} />
          <ITDetailTile label="Assigned To" value={row.assignedTo} />
          <ITDetailTile label="Flow Name" value={row.flowName} />
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Description</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{row.description || '—'}</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Solution</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{row.solution}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ITDetailTile label="Reason for Hold" value={row.holdReason} />
          <ITDetailTile label="Requester Name" value={row.requesterName} />
          <ITDetailTile label="Requester Email" value={row.requesterEmail} />
          <ITDetailTile label="Requested Date" value={row.requestedDate} />
          <ITDetailTile label="Requested Date & Time" value={row.requestedDateTime} />
          <ITDetailTile label="Created By" value={row.createdBy} />
          <ITDetailTile label="Created At" value={row.createdAt} />
          <ITDetailTile label="Supporting Documents" value={formatAttachments(row.attachments)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white/90 px-3 py-2 text-sm">
            <User className="h-4 w-4 text-indigo-600" />
            {row.requesterName}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white/90 px-3 py-2 text-sm">
            <Calendar className="h-4 w-4 text-indigo-500" />
            {row.requestedDateTime}
          </div>
          {row.slaMinutes !== '—' && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm font-medium text-amber-800">
              <Clock className="h-4 w-4 text-amber-600" />
              SLA: {row.slaMinutes} min
            </div>
          )}
          {row.criticality === 'Critical' && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2 text-sm font-medium text-rose-800">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              Critical priority
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ITEmployeeDashboardContent() {
  const { kf: kfFromContext, sdkReady } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null);

  const previewUser = MOCK_IT_USER;
  const liveUser = kfInstance?.user;
  const user = liveUser || previewUser;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [connected, setConnected] = useState(false);
  const [userName, setUserName] = useState(previewUser.Name);
  const [allRows, setAllRows] = useState([]);
  const [kpis, setKpis] = useState({
    totalRecords: 0,
    openTickets: 0,
    completedRecords: 0,
    slaBreached: 0,
  });
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('InProgress');
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [fromMyItemsApi, setFromMyItemsApi] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      let items = [];
      let usedMyItemsApi = false;

      if (kfInstance?.api || kfInstance?.app?.getProcess) {
        const result = await fetchITMyItems(kfInstance);
        items = result.items || [];
        usedMyItemsApi = result.fromMyItemsApi;
        setConnected(true);
      } else {
        items = MOCK_IT_REPORT.Data || [];
        setConnected(false);
      }

      setFromMyItemsApi(usedMyItemsApi);

      const mapped = items
        .map(mapReportRow)
        .filter((row) => isMyItem(row, user, { fromMyItemsApi: usedMyItemsApi }));

      setAllRows(mapped);

      const kpiFromVars = await fetchKpiFromVariables(kfInstance);
      if (kpiFromVars) {
        setUserName(kpiFromVars.userName || user.Name || 'User');
        setKpis({
          totalRecords: kpiFromVars.totalRecords,
          openTickets: kpiFromVars.openTickets,
          completedRecords: kpiFromVars.completedRecords,
          slaBreached: kpiFromVars.slaBreached,
        });
      } else {
        const email = user?.Email || previewUser.Email;
        const computed = computeKpisFromRows(mapped, email);
        setUserName(user?.Name || previewUser.Name);
        setKpis(computed);
      }
    } catch (e) {
      setAllRows([]);
      setLoadError(e?.message || 'Failed to load IT service requests');
    } finally {
      setLoading(false);
    }
  }, [kfInstance, user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, sdkReady, refreshTick]);

  useEffect(() => {
    if (!kfInstance?.context?.watchParams) return undefined;
    return kfInstance.context.watchParams(() => setRefreshTick((n) => n + 1));
  }, [kfInstance]);

  useEffect(() => {
    setExpandedRowId(null);
  }, [activeTab]);

  const myItems = useMemo(() => allRows, [allRows]);

  const tabCounts = useMemo(() => {
    const counts = {};
    STATUS_TABS.forEach((tab) => {
      counts[tab.key] = myItems.filter((row) => matchesStatusTab(row, tab.key)).length;
    });
    return counts;
  }, [myItems]);

  const filteredTasks = useMemo(
    () => applyITFilters(myItems, { search, statusTab: activeTab }),
    [myItems, search, activeTab],
  );

  const tableColumns = useMemo(() => getTableColumns(activeTab), [activeTab]);
  const showWorkflowColumns = activeTab !== 'Completed';

  const toggleRow = (row) => {
    setExpandedRowId((prev) => (prev === row.id ? null : row.id));
  };

  return (
    <div className={IT_THEME.page}>
      <ITDashboardBackground />

      <ITDashboardHeader
        roleKey="employee"
        userName={userName}
        connected={connected}
        loading={loading}
        loadError={loadError}
        onRefresh={() => setRefreshTick((n) => n + 1)}
      />

      <main className="relative mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ITKpiCard delay={0} title="Total Records" value={kpis.totalRecords} icon={IT_KPI_CARDS.total.icon} gradient={IT_KPI_CARDS.total.gradient} glow={IT_KPI_CARDS.total.glow} />
          <ITKpiCard delay={0.06} title="Open Tickets" value={kpis.openTickets} icon={IT_KPI_CARDS.open.icon} gradient={IT_KPI_CARDS.open.gradient} glow={IT_KPI_CARDS.open.glow} />
          <ITKpiCard delay={0.12} title="Completed Tickets" value={kpis.completedRecords} icon={IT_KPI_CARDS.completed.icon} gradient={IT_KPI_CARDS.completed.gradient} glow={IT_KPI_CARDS.completed.glow} />
          <ITKpiCard delay={0.18} title="SLA Breached" value={kpis.slaBreached} icon={IT_KPI_CARDS.sla.icon} gradient={IT_KPI_CARDS.sla.gradient} glow={IT_KPI_CARDS.sla.glow} />
        </section>

        <section className={IT_THEME.section}>
          <ITTableSectionHeader
            roleKey="employee"
            subtitle={IT_ROLE_CONFIG.employee.subtitle}
            search={{ value: search, onChange: (e) => setSearch(e.target.value) }}
            tabs={STATUS_TABS.map((tab) => (
              <ITTabButton
                key={tab.key}
                active={activeTab === tab.key}
                label={tab.label}
                count={tabCounts[tab.key] ?? 0}
                onClick={() => setActiveTab(tab.key)}
              />
            ))}
          />

          <div className="overflow-x-auto">
            <table className={`w-full text-left text-sm ${showWorkflowColumns ? 'min-w-[1200px]' : 'min-w-[1000px]'}`}>
              <thead className={IT_THEME.tableHead}>
                <tr>
                  {tableColumns.map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={tableColumns.length} className="px-4 py-4">
                        <div className="h-4 animate-pulse rounded-lg bg-slate-100" />
                      </td>
                    </tr>
                  ))
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumns.length} className="px-6 py-16 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Ticket className="h-7 w-7" />
                      </div>
                      <p className="mt-4 font-semibold text-slate-600">
                        No {activeTab === 'InProgress' ? 'in progress' : 'completed'} items
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {connected
                          ? `No ${activeTab === 'InProgress' ? 'in progress' : 'completed'} tickets in My items`
                          : 'Preview shows mock data when SDK is unavailable'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((row) => {
                    const isExpanded = expandedRowId === row.id;
                    return (
                      <Fragment key={row.id}>
                        <tr
                          onClick={() => toggleRow(row)}
                          className={`cursor-pointer border-t border-slate-50 transition-all ${
                            isExpanded ? IT_THEME.rowExpanded : IT_THEME.rowHover
                          }`}
                        >
                          <td className={`px-3 py-3 ${IT_THEME.chevron}`}>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </td>
                          <td className="px-4 py-3">
                            <p className={`font-semibold ${IT_THEME.requestId}`}>{row.requestId !== '—' ? row.requestId : row.id.slice(-8)}</p>
                            <p className="max-w-[180px] truncate text-[11px] text-slate-400">{row.name}</p>
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-3 font-medium text-slate-800" title={row.summary}>
                            {row.summary}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.ticketType}</td>
                          <td className="px-4 py-3 text-slate-600">{row.category}</td>
                          <td className="px-4 py-3 text-slate-600">{row.subCategory}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${CRITICALITY_STYLE[row.criticality] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                              {row.criticality}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex max-w-[180px] truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${itemStatusClass(row.itemStatus)}`} title={row.itemStatus}>
                              {row.itemStatus}
                            </span>
                          </td>
                          {showWorkflowColumns && (
                            <td className="px-4 py-3">
                              <span className={IT_THEME.stepBadge}>{row.currentStep}</span>
                            </td>
                          )}
                          <td className="px-4 py-3 text-xs text-slate-500">{row.requestedDate}</td>
                          {showWorkflowColumns && (
                            <td className="max-w-[140px] truncate px-4 py-3 text-xs text-slate-600">{row.assignedTo}</td>
                          )}
                        </tr>
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <tr>
                              <td colSpan={tableColumns.length} className="p-0">
                                <EmployeeExpandPanel row={row} />
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && filteredTasks.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-3 sm:px-6">
              <p className="text-xs text-slate-500">
                {filteredTasks.length} record{filteredTasks.length === 1 ? '' : 's'} · {myItems.length} total in My items
                {fromMyItemsApi ? ' · live' : ''}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function ITEmployeeDashboardProject() {
  return <ITEmployeeDashboardContent />;
}
