/* eslint-disable max-lines -- Kissflow IT Agent dashboard */
import { useState, useContext, useEffect, useMemo, useCallback, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Send, ChevronDown, ChevronUp, Sparkles, PauseCircle,
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
  fetchITAgentMyTasks,
  fetchAgentKpiFromVariables,
  fetchITServiceReport,
  extractItemsFromResponse,
  mapReportRow,
  computeAgentKpisFromReportItems,
  AGENT_STATUS_TABS,
  applyAgentFilters,
  matchesAgentStatusTab,
  ITEM_STATUS_OPTIONS,
  IT_AGENT_STEP,
  isITAgentStep,
  getRawItemStatus,
  submitITAgentWork,
} from './lib/kfITServiceDashboard.js';
import { MOCK_IT_AGENT_TASKS, MOCK_IT_AGENT_USER } from './mocks/itAgentTasks.js';
import { MOCK_IT_REPORT } from './mocks/itServiceRequests.js';

const TABLE_HEADERS = ['', 'Request ID', 'Summary', 'Requester', 'Ticket Type', 'Criticality', 'Item Status', 'Requested', 'SLA'];

function emptyFormFromRow(row) {
  const rawStatus = row?.itemStatusRaw || '';
  return {
    itemStatus: rawStatus && rawStatus !== '—' ? rawStatus : '',
    solution: row?.solution !== '—' ? row.solution : '',
    holdReason: row?.holdReason !== '—' ? row.holdReason : '',
  };
}

function canEditRow(row, activeTab) {
  return activeTab === 'PendingTask'
    && isITAgentStep(row)
    && getRawItemStatus(row).toLowerCase() !== 'completed';
}

function AgentExpandPanel({
  row,
  form,
  canEdit,
  submitting,
  submitError,
  onChange,
  onSubmit,
}) {
  const showHoldReason = form.itemStatus === 'On Hold';

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
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Agent Work</p>
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
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
                <label className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-700">
                  Item Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.itemStatus}
                  onChange={(e) => onChange({ ...form, itemStatus: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded-xl border-2 border-indigo-100 bg-gradient-to-r from-white to-indigo-50/30 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/15"
                >
                  <option value="">Select status</option>
                  {ITEM_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <AnimatePresence>
                {showHoldReason && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    className="overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm"
                  >
                    <label className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-900">
                      <PauseCircle className="h-4 w-4" />
                      Reason for Hold <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.holdReason}
                      onChange={(e) => onChange({ ...form, holdReason: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Why is this ticket on hold?"
                      className="w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/15"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="lg:col-span-5">
              <div className="h-full rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Solution <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={form.solution}
                  onChange={(e) => onChange({ ...form, solution: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  rows={5}
                  placeholder="Describe the solution or actions taken..."
                  className="w-full resize-none rounded-xl border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/20 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/15"
                />
              </div>
            </div>

            <div className="flex flex-col justify-end gap-3 lg:col-span-3">
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
                {submitting ? 'Submitting...' : 'Submit Solution'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Item Status</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{row.itemStatus}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Reason for Hold</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{row.holdReason}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm sm:col-span-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Solution</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 break-words">{row.solution}</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ITAgentDashboardContent() {
  const { kf: kfFromContext, sdkReady } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null);

  const previewUser = MOCK_IT_AGENT_USER;
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
  });
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('PendingTask');
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [fromMyTasksApi, setFromMyTasksApi] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [rowForms, setRowForms] = useState({});
  const [submitErrors, setSubmitErrors] = useState({});

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      let items = [];
      let usedMyTasksApi = false;

      if (kfInstance?.api) {
        const result = await fetchITAgentMyTasks(kfInstance);
        items = result.items || [];
        usedMyTasksApi = result.fromMyTasksApi;
        setConnected(true);
      } else {
        items = MOCK_IT_AGENT_TASKS.Data || [];
        setConnected(false);
      }

      setFromMyTasksApi(usedMyTasksApi);
      setAllRows(items.map(mapReportRow));

      const kpiFromVars = await fetchAgentKpiFromVariables(kfInstance);
      if (kpiFromVars) {
        setUserName(kpiFromVars.userName || user.Name || 'User');
        setKpis(kpiFromVars);
      } else {
        let kpiSource = MOCK_IT_REPORT.Data || [];
        if (kfInstance?.api) {
          try {
            const report = await fetchITServiceReport(kfInstance);
            kpiSource = extractItemsFromResponse(report);
          } catch {
            // keep preview / partial data
          }
        }
        setUserName(user?.Name || previewUser.Name);
        setKpis(computeAgentKpisFromReportItems(kpiSource));
      }
    } catch (e) {
      setAllRows([]);
      setLoadError(e?.message || 'Failed to load IT agent tasks');
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

  const tabCounts = useMemo(() => {
    const counts = {};
    AGENT_STATUS_TABS.forEach((tab) => {
      counts[tab.key] = allRows.filter((row) => matchesAgentStatusTab(row, tab.key)).length;
    });
    return counts;
  }, [allRows]);

  const filteredTasks = useMemo(
    () => applyAgentFilters(allRows, { search, statusTab: activeTab }),
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
    if (!canEditRow(row, activeTab)) return;
    const form = rowForms[row.id] || emptyFormFromRow(row);

    if (!form.itemStatus) {
      setSubmitErrors((prev) => ({ ...prev, [row.id]: 'Please select Item Status' }));
      return;
    }
    if (!String(form.solution || '').trim()) {
      setSubmitErrors((prev) => ({ ...prev, [row.id]: 'Solution is required' }));
      return;
    }
    if (form.itemStatus === 'On Hold' && !String(form.holdReason || '').trim()) {
      setSubmitErrors((prev) => ({ ...prev, [row.id]: 'Reason for hold is required when status is On Hold' }));
      return;
    }

    setSubmittingId(row.id);
    setSubmitErrors((prev) => ({ ...prev, [row.id]: '' }));
    try {
      await submitITAgentWork(kfInstance, row, form);
      setExpandedRowId(null);
      setRefreshTick((n) => n + 1);
    } catch (e) {
      setSubmitErrors((prev) => ({ ...prev, [row.id]: e?.message || 'Submit failed' }));
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className={IT_THEME.page}>
      <ITDashboardBackground />

      <ITDashboardHeader
        roleKey="agent"
        userName={userName}
        subtitle={`${IT_ROLE_CONFIG.agent.subtitle} · ${IT_AGENT_STEP}`}
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
          <ITKpiCard delay={0.18} title="Pending Tasks" value={kpis.pendingTasks} icon={IT_KPI_CARDS.pending.icon} gradient={IT_KPI_CARDS.pending.gradient} glow={IT_KPI_CARDS.pending.glow} />
        </section>

        <section className={IT_THEME.section}>
          <ITTableSectionHeader
            roleKey="agent"
            subtitle={`My tasks at ${IT_AGENT_STEP} step`}
            search={{ value: search, onChange: (e) => setSearch(e.target.value) }}
            tabs={AGENT_STATUS_TABS.map((tab) => (
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
                  {TABLE_HEADERS.map((h) => (
                    <th key={h || 'expand'} className="whitespace-nowrap px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={TABLE_HEADERS.length} className="px-4 py-4">
                        <div className="h-4 animate-pulse rounded-lg bg-indigo-100" />
                      </td>
                    </tr>
                  ))
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={TABLE_HEADERS.length} className="px-6 py-16 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-indigo-100 text-indigo-400">
                        <Ticket className="h-7 w-7" />
                      </div>
                      <p className="mt-4 font-semibold text-slate-600">
                        No {activeTab === 'PendingTask' ? 'pending' : 'completed'} tasks
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {connected ? `No tasks at ${IT_AGENT_STEP} in this tab` : 'Preview shows mock agent tasks'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((row) => {
                    const isExpanded = expandedRowId === row.id;
                    const form = rowForms[row.id] || emptyFormFromRow(row);
                    const editable = canEditRow(row, activeTab);
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
                            <p className="max-w-[160px] truncate text-[11px] text-slate-400">{row.currentStep}</p>
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-3 font-medium text-slate-800">{row.summary}</td>
                          <td className="px-4 py-3 text-slate-600">{row.requesterName}</td>
                          <td className="px-4 py-3 text-slate-600">{row.ticketType}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${CRITICALITY_STYLE[row.criticality] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                              {row.criticality}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={IT_THEME.itemStatusBadge}>
                              {row.itemStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{row.requestedDate}</td>
                          <td className="px-4 py-3 text-xs font-medium text-slate-600">{row.slaMinutes}</td>
                        </tr>
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <tr>
                              <td colSpan={TABLE_HEADERS.length} className="p-0">
                                <AgentExpandPanel
                                  row={row}
                                  form={form}
                                  canEdit={editable}
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
                {filteredTasks.length} record{filteredTasks.length === 1 ? '' : 's'} · {allRows.length} total at {IT_AGENT_STEP}
                {fromMyTasksApi ? ' · live' : ''}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function ITAgentDashboardProject() {
  return <ITAgentDashboardContent />;
}
