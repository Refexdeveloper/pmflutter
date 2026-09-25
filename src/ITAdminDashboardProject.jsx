/* eslint-disable max-lines -- Kissflow IT Admin dashboard */
import { useState, useContext, useEffect, useMemo, useCallback, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, Sparkles,
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
  Ticket,
} from './components/it/ITDashboardUI.jsx';
import {
  fetchITAdminReportItems,
  fetchAdminKpiFromVariables,
  mapReportRow,
  computeAdminKpisFromReportItems,
  ADMIN_STATUS_TABS,
  applyAdminFilters,
  matchesAdminStatusTab,
  getWorkflowStepIndex,
  WORKFLOW_STEPS,
  IT_AGENT_STEP,
  IT_MANAGER_STEP,
} from './lib/kfITServiceDashboard.js';
import { MOCK_IT_ADMIN_REPORT, MOCK_IT_ADMIN_USER } from './mocks/itAdminTasks.js';

function StepTimeline({ currentStep, lastCompletedStep }) {
  const activeIdx = getWorkflowStepIndex(currentStep);
  return (
    <div className="flex flex-wrap gap-2">
      {WORKFLOW_STEPS.map((step, idx) => {
        const done = idx < activeIdx
          || (lastCompletedStep && step.toLowerCase() === String(lastCompletedStep).toLowerCase());
        const active = idx === activeIdx;
        return (
          <div
            key={step}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              active
                ? IT_THEME.tabActive
                : done
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            {step}
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

function AdminExpandPanel({ row }) {
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
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Full Request Details</p>
              <p className="text-sm font-semibold text-slate-800">{row.summary}</p>
            </div>
          </div>
          <StepTimeline currentStep={row.currentStep} lastCompletedStep={row.lastCompletedStep} />
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ITDetailTile label="Request ID" value={row.requestId} />
          <ITDetailTile label="Ticket Type" value={row.ticketType} />
          <ITDetailTile label="Category" value={row.category} />
          <ITDetailTile label="Sub-Category" value={row.subCategory} />
          <ITDetailTile label="Criticality" value={row.criticality} />
          <ITDetailTile label="SLA (Minutes)" value={row.slaMinutes} />
          <ITDetailTile label="Current Step" value={row.currentStep} />
          <ITDetailTile label="Last Completed Step" value={row.lastCompletedStep} />
          <ITDetailTile label="Item Status" value={row.itemStatus} />
          <ITDetailTile label="Workflow Status" value={row.statusLabel} />
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
          <ITDetailTile label="Manager Comments" value={row.managerComments} />
          <ITDetailTile label="Requester Name" value={row.requesterName} />
          <ITDetailTile label="Requester Email" value={row.requesterEmail} />
          <ITDetailTile label="Requested Date" value={row.requestedDate} />
          <ITDetailTile label="Requested Date & Time" value={row.requestedDateTime} />
          <ITDetailTile label="Created By" value={row.createdBy} />
          <ITDetailTile label="Created At" value={row.createdAt} />
          <ITDetailTile label="Modified At" value={row.modifiedAt} />
          <ITDetailTile label="Supporting Documents" value={formatAttachments(row.attachments)} />
        </div>
      </div>
    </motion.div>
  );
}

function ITAdminDashboardContent() {
  const { kf: kfFromContext, sdkReady } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null);

  const previewUser = MOCK_IT_ADMIN_USER;
  const user = kfInstance?.user || previewUser;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [connected, setConnected] = useState(false);
  const [userName, setUserName] = useState(previewUser.Name);
  const [allRows, setAllRows] = useState([]);
  const [kpis, setKpis] = useState({
    totalRecords: 0,
    openRecords: 0,
    completedRecords: 0,
    pendingRecords: 0,
  });
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const tableHeaders = useMemo(() => {
    const base = ['', 'Request ID', 'Summary', 'Requester', 'Ticket Type', 'Category', 'Criticality', 'Item Status'];
    if (activeTab !== 'Completed') base.push('Current Step');
    base.push('Workflow Status', 'Requested');
    return base;
  }, [activeTab]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      let items = [];

      if (kfInstance?.api) {
        const result = await fetchITAdminReportItems(kfInstance);
        items = result.items || [];
        setConnected(true);
      } else {
        items = MOCK_IT_ADMIN_REPORT.Data || [];
        setConnected(false);
      }

      const rows = items.map(mapReportRow);
      setAllRows(rows);

      const computed = computeAdminKpisFromReportItems(items);
      const kpiFromVars = await fetchAdminKpiFromVariables(kfInstance);

      if (kpiFromVars) {
        setUserName(kpiFromVars.userName || user.Name || 'User');
        setKpis({ ...kpiFromVars, ...computed });
      } else {
        setUserName(user?.Name || previewUser.Name);
        setKpis(computed);
      }
    } catch (e) {
      setAllRows([]);
      setLoadError(e?.message || 'Failed to load IT admin report');
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
    ADMIN_STATUS_TABS.forEach((tab) => {
      counts[tab.key] = allRows.filter((row) => matchesAdminStatusTab(row, tab.key)).length;
    });
    return counts;
  }, [allRows]);

  const filteredTasks = useMemo(
    () => applyAdminFilters(allRows, { search, statusTab: activeTab }),
    [allRows, search, activeTab],
  );

  const toggleRow = (row) => {
    setExpandedRowId((prev) => (prev === row.id ? null : row.id));
  };

  const emptyTabLabel = {
    All: 'records',
    ITAgent: 'IT Agent tickets',
    ITManager: 'IT Manager tickets',
    Completed: 'completed tickets',
  }[activeTab] || 'records';

  return (
    <div className={IT_THEME.page}>
      <ITDashboardBackground />

      <ITDashboardHeader
        roleKey="admin"
        userName={userName}
        connected={connected}
        loading={loading}
        loadError={loadError}
        onRefresh={() => setRefreshTick((n) => n + 1)}
      />

      <main className="relative mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ITKpiCard delay={0} title="Total Records" value={kpis.totalRecords} icon={IT_KPI_CARDS.total.icon} gradient={IT_KPI_CARDS.total.gradient} glow={IT_KPI_CARDS.total.glow} />
          <ITKpiCard delay={0.06} title="Open Records" value={kpis.openRecords} icon={IT_KPI_CARDS.open.icon} gradient={IT_KPI_CARDS.open.gradient} glow={IT_KPI_CARDS.open.glow} />
          <ITKpiCard delay={0.12} title="Completed Records" value={kpis.completedRecords} icon={IT_KPI_CARDS.completed.icon} gradient={IT_KPI_CARDS.completed.gradient} glow={IT_KPI_CARDS.completed.glow} />
          <ITKpiCard delay={0.18} title="Pending" value={kpis.pendingRecords} icon={IT_KPI_CARDS.pending.icon} gradient={IT_KPI_CARDS.pending.gradient} glow={IT_KPI_CARDS.pending.glow} />
        </section>

        <section className={IT_THEME.section}>
          <ITTableSectionHeader
            roleKey="admin"
            subtitle={`All items · ${IT_AGENT_STEP} · ${IT_MANAGER_STEP}`}
            search={{ value: search, onChange: (e) => setSearch(e.target.value) }}
            tabs={ADMIN_STATUS_TABS.map((tab) => (
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
            <table className="w-full min-w-[1100px] text-left text-sm">
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
                        {connected ? 'No matching records in this tab' : 'Preview shows mock admin data'}
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
                          <td className="max-w-[180px] truncate px-4 py-3 font-medium text-slate-800" title={row.summary}>
                            {row.summary}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.requesterName}</td>
                          <td className="px-4 py-3 text-slate-600">{row.ticketType}</td>
                          <td className="px-4 py-3 text-slate-600">{row.category}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${CRITICALITY_STYLE[row.criticality] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                              {row.criticality}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${itemStatusClass(row.itemStatusRaw)}`}>
                              {row.itemStatus}
                            </span>
                          </td>
                          {activeTab !== 'Completed' && (
                            <td className="px-4 py-3">
                              <span className={IT_THEME.stepBadge}>
                                {row.currentStep}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                              {row.statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{row.requestedDate}</td>
                        </tr>
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <tr>
                              <td colSpan={tableHeaders.length} className="p-0">
                                <AdminExpandPanel row={row} />
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
                {connected ? ' · live report' : ''}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function ITAdminDashboardProject() {
  return <ITAdminDashboardContent />;
}
