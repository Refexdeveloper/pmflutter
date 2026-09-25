/* eslint-disable max-lines -- Kissflow IT Manager dashboard */
import { useState, useContext, useEffect, useMemo, useCallback, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Send, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { KissflowSDKContext } from './sdk/index.js';
import {
  IT_THEME,
  IT_KPI_CARDS,
  IT_ROLE_CONFIG,
  CRITICALITY_STYLE,
  ITKpiCard,
  ITDashboardBackground,
  ITDashboardHeader,
  ITTableSectionHeader,
  ITTabButton,
  Ticket,
} from './components/it/ITDashboardUI.jsx';
import {
  fetchITManagerTasks,
  fetchManagerKpiFromVariables,
  fetchITServiceReport,
  extractItemsFromResponse,
  mapReportRow,
  computeManagerKpisFromReportItems,
  MANAGER_STATUS_TABS,
  applyManagerFilters,
  matchesManagerStatusTab,
  IT_MANAGER_STEP,
  IT_AGENT_STEP,
  isITManagerStep,
  countAgentPendingTasks,
  submitITManagerWork,
} from './lib/kfITServiceDashboard.js';
import { MOCK_IT_MANAGER_TASKS, MOCK_IT_MANAGER_USER } from './mocks/itManagerTasks.js';

function emptyFormFromRow(row) {
  return {
    managerComments: row?.managerComments && row.managerComments !== '—' ? row.managerComments : '',
  };
}

function canEditManagerRow(row, activeTab) {
  return activeTab === 'PendingTask' && isITManagerStep(row);
}

function ManagerExpandPanel({
  row,
  form,
  canEdit,
  activeTab,
  submitting,
  submitError,
  onChange,
  onSubmit,
}) {
  const panelTitle = activeTab === 'AgentPending'
    ? 'Agent Queue'
    : activeTab === 'Completed'
      ? 'Completed Request'
      : 'Manager Review';

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
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{panelTitle}</p>
              <p className="text-sm font-semibold text-slate-800">{row.summary}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white/80 px-3 py-1 font-medium text-slate-600 ring-1 ring-indigo-100">
              {row.ticketType}
            </span>
            <span className="rounded-full bg-white/80 px-3 py-1 font-medium text-slate-600 ring-1 ring-indigo-100">
              {row.currentStep}
            </span>
          </div>
        </div>

        {canEdit ? (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="h-full rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Manager Comments
                  <span className="ml-2 text-xs font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={form.managerComments}
                  onChange={(e) => onChange({ ...form, managerComments: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  rows={5}
                  placeholder="Add manager comments or approval notes..."
                  className="w-full resize-none rounded-xl border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/20 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/15"
                />
              </div>
            </div>

            <div className="flex flex-col justify-end gap-3 lg:col-span-4">
              {submitError && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {submitError}
                </p>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={(e) => {
                  e.stopPropagation();
                  onSubmit();
                }}
                className={IT_THEME.primaryBtn}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Item Status</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{row.itemStatus}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Current Step</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{row.currentStep}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Agent Solution</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 break-words">{row.solution}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Manager Comments</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 break-words">
                {row.managerComments !== '—' ? row.managerComments : '—'}
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ITManagerDashboardContent() {
  const { kf: kfFromContext, sdkReady } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null);

  const previewUser = MOCK_IT_MANAGER_USER;
  const user = kfInstance?.user || previewUser;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [connected, setConnected] = useState(false);
  const [userName, setUserName] = useState(previewUser.Name);
  const [allRows, setAllRows] = useState([]);
  const [kpis, setKpis] = useState({
    totalRecords: 0,
    openTickets: 0,
    completedRecords: 0,
    pendingTasks: 0,
    agentPendingTasks: 0,
  });
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('PendingTask');
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [fromMyTasksApi, setFromMyTasksApi] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [rowForms, setRowForms] = useState({});
  const [submitErrors, setSubmitErrors] = useState({});

  const tableHeaders = useMemo(() => {
    const base = ['', 'Request ID', 'Summary', 'Requester', 'Ticket Type', 'Criticality'];
    if (activeTab !== 'Completed') base.push('Current Step');
    base.push('Item Status', 'Requested');
    return base;
  }, [activeTab]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      let items = [];
      let usedMyTasksApi = false;

      if (kfInstance?.api) {
        const result = await fetchITManagerTasks(kfInstance);
        items = result.items || [];
        usedMyTasksApi = result.fromMyTasksApi;
        setConnected(true);
      } else {
        items = MOCK_IT_MANAGER_TASKS.Data || [];
        setConnected(false);
      }

      setFromMyTasksApi(usedMyTasksApi);
      const rows = items.map(mapReportRow);
      setAllRows(rows);

      const agentPendingCount = countAgentPendingTasks(items);

      const kpiFromVars = await fetchManagerKpiFromVariables(kfInstance);
      if (kpiFromVars) {
        setUserName(kpiFromVars.userName || user.Name || 'User');
        setKpis({ ...kpiFromVars, agentPendingTasks: agentPendingCount });
      } else {
        let kpiSource = MOCK_IT_MANAGER_TASKS.Data || [];
        if (kfInstance?.api) {
          try {
            const report = await fetchITServiceReport(kfInstance);
            kpiSource = extractItemsFromResponse(report);
          } catch {
            // keep preview / partial data
          }
        }
        setUserName(user?.Name || previewUser.Name);
        const computed = computeManagerKpisFromReportItems(kpiSource);
        setKpis({ ...computed, agentPendingTasks: countAgentPendingTasks(kpiSource) });
      }
    } catch (e) {
      setAllRows([]);
      setLoadError(e?.message || 'Failed to load IT manager tasks');
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

  const tabCounts = useMemo(() => {
    const counts = {};
    MANAGER_STATUS_TABS.forEach((tab) => {
      counts[tab.key] = allRows.filter((row) => matchesManagerStatusTab(row, tab.key)).length;
    });
    return counts;
  }, [allRows]);

  const agentPendingCount = tabCounts.AgentPending ?? 0;

  const filteredTasks = useMemo(
    () => applyManagerFilters(allRows, { search, statusTab: activeTab }),
    [allRows, search, activeTab],
  );

  const toggleRow = (row) => {
    if (expandedRowId === row.id) {
      setExpandedRowId(null);
      return;
    }
    setExpandedRowId(row.id);
    setRowForms((prev) => ({
      ...prev,
      [row.id]: prev[row.id] || emptyFormFromRow(row),
    }));
    setSubmitErrors((prev) => ({ ...prev, [row.id]: '' }));
  };

  const handleSubmit = async (row) => {
    if (!canEditManagerRow(row, activeTab)) return;
    const form = rowForms[row.id] || emptyFormFromRow(row);

    setSubmittingId(row.id);
    setSubmitErrors((prev) => ({ ...prev, [row.id]: '' }));
    try {
      await submitITManagerWork(kfInstance, row, form);
      setExpandedRowId(null);
      setRefreshTick((n) => n + 1);
    } catch (e) {
      setSubmitErrors((prev) => ({ ...prev, [row.id]: e?.message || 'Submit failed' }));
    } finally {
      setSubmittingId(null);
    }
  };

  const emptyTabLabel = activeTab === 'PendingTask'
    ? 'pending manager tasks'
    : activeTab === 'AgentPending'
      ? 'agent pending tasks'
      : 'completed tasks';

  return (
    <div className={IT_THEME.page}>
      <ITDashboardBackground />

      <ITDashboardHeader
        roleKey="manager"
        userName={userName}
        subtitle={`${IT_MANAGER_STEP} oversight · ${IT_AGENT_STEP} queue`}
        connected={connected}
        loading={loading}
        loadError={loadError}
        onRefresh={() => setRefreshTick((n) => n + 1)}
      />

      <main className="relative mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <ITKpiCard delay={0} title="Total Records" value={kpis.totalRecords} icon={IT_KPI_CARDS.total.icon} gradient={IT_KPI_CARDS.total.gradient} glow={IT_KPI_CARDS.total.glow} />
          <ITKpiCard delay={0.05} title="Open Tickets" value={kpis.openTickets} icon={IT_KPI_CARDS.open.icon} gradient={IT_KPI_CARDS.open.gradient} glow={IT_KPI_CARDS.open.glow} />
          <ITKpiCard delay={0.1} title="Completed Tickets" value={kpis.completedRecords} icon={IT_KPI_CARDS.completed.icon} gradient={IT_KPI_CARDS.completed.gradient} glow={IT_KPI_CARDS.completed.glow} />
          <ITKpiCard delay={0.15} title="Pending Tasks" value={kpis.pendingTasks} icon={IT_KPI_CARDS.pending.icon} gradient={IT_KPI_CARDS.pending.gradient} glow={IT_KPI_CARDS.pending.glow} />
          <ITKpiCard delay={0.2} title="Agent Pending Tasks" value={agentPendingCount} icon={IT_KPI_CARDS.agentQueue.icon} gradient={IT_KPI_CARDS.agentQueue.gradient} glow={IT_KPI_CARDS.agentQueue.glow} />
        </section>

        <section className={IT_THEME.section}>
          <ITTableSectionHeader
            roleKey="manager"
            subtitle={`Manager queue · ${IT_MANAGER_STEP} & ${IT_AGENT_STEP}`}
            search={{ value: search, onChange: (e) => setSearch(e.target.value) }}
            tabs={MANAGER_STATUS_TABS.map((tab) => (
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
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className={IT_THEME.tableHead}>
                <tr>
                  {tableHeaders.map((h) => (
                    <th key={h || 'expand'} className="whitespace-nowrap px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={tableHeaders.length} className="px-4 py-4">
                        <div className="h-4 animate-pulse rounded-lg bg-indigo-100" />
                      </td>
                    </tr>
                  ))
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={tableHeaders.length} className="px-6 py-16 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-indigo-100 text-indigo-500">
                        <Ticket className="h-7 w-7" />
                      </div>
                      <p className="mt-4 font-semibold text-slate-600">No {emptyTabLabel}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {connected ? 'No matching records in this tab' : 'Preview shows mock manager tasks'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((row) => {
                    const isExpanded = expandedRowId === row.id;
                    const form = rowForms[row.id] || emptyFormFromRow(row);
                    const editable = canEditManagerRow(row, activeTab);
                    return (
                      <Fragment key={row.id}>
                        <tr
                          onClick={() => toggleRow(row)}
                          className={`cursor-pointer border-t border-indigo-50/80 transition-all ${
                            isExpanded ? IT_THEME.rowExpanded : IT_THEME.rowHover
                          }`}
                        >
                          <td className={`px-3 py-3 ${IT_THEME.chevron}`}>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </td>
                          <td className="px-4 py-3">
                            <p className={IT_THEME.requestId}>{row.requestId !== '—' ? row.requestId : row.id.slice(-8)}</p>
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-3 font-medium text-slate-800">{row.summary}</td>
                          <td className="px-4 py-3 text-slate-600">{row.requesterName}</td>
                          <td className="px-4 py-3 text-slate-600">{row.ticketType}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${CRITICALITY_STYLE[row.criticality] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                              {row.criticality}
                            </span>
                          </td>
                          {activeTab !== 'Completed' && (
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                                {row.currentStep}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <span className={IT_THEME.itemStatusBadge}>
                              {row.itemStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{row.requestedDate}</td>
                        </tr>
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <tr>
                              <td colSpan={tableHeaders.length} className="p-0">
                                <ManagerExpandPanel
                                  row={row}
                                  form={form}
                                  canEdit={editable}
                                  activeTab={activeTab}
                                  submitting={submittingId === row.id}
                                  submitError={submitErrors[row.id]}
                                  onChange={(next) => setRowForms((prev) => ({ ...prev, [row.id]: next }))}
                                  onSubmit={() => handleSubmit(row)}
                                />
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
                {filteredTasks.length} record{filteredTasks.length === 1 ? '' : 's'} · {allRows.length} total loaded
                {fromMyTasksApi ? ' · live queue' : ''}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function ITManagerDashboardProject() {
  return <ITManagerDashboardContent />;
}
