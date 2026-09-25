/* eslint-disable max-lines -- Kissflow Lead Management dashboard */
import { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Target, Trophy, Search, X,
  ExternalLink, Loader2, Phone, Mail, User, DollarSign, XCircle, Calendar,
} from 'lucide-react';
import AppLayout from './components/feature/AppLayout.jsx';
import { KissflowSDKContext } from './sdk/index.js';
import {
  fetchAllLeads,
  fetchLeadStatusCounts,
  fetchLeadFullDetail,
  applyLeadFilters,
  countUpcomingMeetings,
  WORKFLOW_STEPS,
  getWorkflowStepIndex,
  LEAD_POPUP_ID,
} from './lib/kfLeadDashboard.js';
import { resolveRoleName, getGreetingText } from './lib/kfProjectDashboard.js';

const STATUS_TABS = [
  { key: 'All', label: 'All', gradient: 'from-indigo-600 to-violet-700' },
  { key: 'Draft', label: 'Draft', gradient: 'from-slate-500 to-slate-700' },
  { key: 'In progress', label: 'In Progress', gradient: 'from-indigo-500 to-violet-600' },
  { key: 'Completed', label: 'Completed', gradient: 'from-emerald-500 to-teal-600' },
];

const PRIORITY_STYLE = {
  High: 'bg-rose-100 text-rose-700',
  Medium: 'bg-amber-100 text-amber-800',
  Low: 'bg-emerald-100 text-emerald-700',
};

const REQUIRED_FIELDS_BY_STEP = {
  'Document Sharing': ['Customer Name', 'Lead Source', 'Region', 'Product', 'Contact Person', 'Phone', 'Email'],
  'Initial Meeting': ['Meeting Date', 'Meeting Notes', 'Next Follow-up Date'],
  'Requirement Assessment': ['Requirements Summary', 'Solution Fit', 'Indicative Deal Value'],
  'Customer DD / Visits': ['Visit Date', 'Visit Outcome / Notes', 'Stakeholders'],
  'Commercial Discussion': ['Commercial Status', 'Indicative Deal Value', 'Win Probability', 'Expected Closure Date'],
  'Term Sheet Finalization': ['Term Sheet Uploaded', 'Commercial Notes', 'Expected Closure Date'],
  'Closed Won / Closed Lost': ['Closed Status (Won/Lost)', 'Final Deal Value', 'Closure Notes'],
  'Sales Head Approval': ['Approval Comment / Notes'],
};

function formatCurrency(n) {
  const v = Number(n) || 0;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return v > 0 ? `₹${v.toLocaleString('en-IN')}` : '—';
}

function KpiCard({ title, value, icon: Icon, gradient, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 320, damping: 28 }}
      className={`rounded-2xl bg-gradient-to-br ${gradient} p-4 text-white shadow-lg sm:p-5`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80 sm:text-xs">{title}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 sm:h-11 sm:w-11">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </div>
    </motion.div>
  );
}

function MetricCard({ title, value, subtitle, icon: Icon, gradient, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 320, damping: 28 }}
      className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/85 p-4 shadow-lg backdrop-blur-sm transition-shadow hover:shadow-xl sm:p-5"
    >
      <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${gradient} opacity-25 blur-2xl`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md transition-transform group-hover:scale-105`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}

function WorkflowTimeline({ currentStage }) {
  const activeIdx = getWorkflowStepIndex(currentStage);
  return (
    <div className="space-y-0">
      {WORKFLOW_STEPS.map((step, idx) => {
        const done = idx < activeIdx;
        const active = idx === activeIdx;
        return (
          <div key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-slate-200 text-slate-500'
              }`}>
                {done ? '✓' : idx + 1}
              </div>
              {idx < WORKFLOW_STEPS.length - 1 && (
                <div className={`my-1 w-0.5 flex-1 min-h-[20px] ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
              )}
            </div>
            <div className={`pb-4 pt-0.5 ${active ? 'font-semibold text-indigo-700' : done ? 'text-emerald-700' : 'text-slate-500'}`}>
              <p className="text-sm">{step}</p>
              {active && <p className="text-[11px] text-indigo-500">Current step</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value || '—'}</span>
    </div>
  );
}

function LeadDashboardContent({ useLayout = false }) {
  const { kf: kfFromContext, sdkReady } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [allLeads, setAllLeads] = useState([]);
  const [statusCounts, setStatusCounts] = useState({ Draft: 0, 'In progress': 0, Completed: 0, Withdrawn: 0, Rejected: 0 });
  const [loadError, setLoadError] = useState('');
  const [connected, setConnected] = useState(false);
  const [userName, setUserName] = useState('User');
  const [roleName, setRoleName] = useState('Sales');
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (kfInstance?.user) {
      const u = kfInstance.user;
      setUserName(String(u.Name || u.FirstName || 'User').trim());
      setRoleName(resolveRoleName(u.Role || u.Roles?.[0] || 'Sales'));
    }
  }, [kfInstance]);

  useEffect(() => {
    if (!kfInstance?.context?.watchParams) return;
    kfInstance.context.watchParams(() => setRefreshTick((n) => n + 1));
  }, [kfInstance]);

  const loadTabData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [leads, counts] = await Promise.all([
        fetchAllLeads(kfInstance),
        fetchLeadStatusCounts(kfInstance).catch(() => null),
      ]);
      setAllLeads(leads || []);
      if (counts) setStatusCounts(counts);
      setConnected(Boolean(kfInstance?.api || kfInstance?.user));
    } catch (e) {
      setAllLeads([]);
      setLoadError(e?.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [kfInstance]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData, sdkReady, refreshTick]);

  const filteredLeads = useMemo(() => {
    let list = allLeads;
    if (activeTab !== 'All') {
      list = list.filter((l) => l.status === activeTab);
    }
    return applyLeadFilters(list, { search, status: activeTab });
  }, [allLeads, search, activeTab]);

  const tabCounts = useMemo(() => {
    const counts = { All: allLeads.length };
    STATUS_TABS.forEach((tab) => {
      if (tab.key === 'All') return;
      counts[tab.key] = statusCounts[tab.key] ?? allLeads.filter((l) => l.status === tab.key).length;
    });
    return counts;
  }, [allLeads, statusCounts]);

  const kpis = useMemo(() => {
    const draft = statusCounts.Draft ?? 0;
    const inProgress = statusCounts['In progress'] ?? 0;
    const completed = statusCounts.Completed ?? 0;
    const lost = (statusCounts.Withdrawn ?? 0) + (statusCounts.Rejected ?? 0);
    const total = allLeads.length || draft + inProgress + completed + lost;

    const inProgressLeads = allLeads.filter((l) => l.status === 'In progress');

    const meeting = inProgressLeads.filter((l) => {
      const step = String(l?.currentStep || l?.stage || '').toLowerCase();
      return step.includes('initial meeting') || step === 'initial meeting';
    }).length;

    const upcomingMeeting = countUpcomingMeetings(allLeads);
    const amount = inProgressLeads.reduce((s, l) => s + (Number(l?.indicativeDealValue) || 0), 0);

    return { total, meeting, upcomingMeeting, completed, lost, amount };
  }, [statusCounts, allLeads]);

  const openLeadDetail = async (row) => {
    setSelectedLead(row);
    setDetailLoading(true);
    try {
      const full = await fetchLeadFullDetail(kfInstance, row);
      setSelectedLead(full || row);
    } finally {
      setDetailLoading(false);
    }
  };

  const openKissflowPopup = (row) => {
    const sdk = kfInstance;
    const instanceId = row?.id;
    const activityInstanceId = row?.activityInstanceId || '';
    const activityId = activityInstanceId || row?.activityId || '';
    if (!sdk?.app?.page?.openPopup || !instanceId || !activityId) {
      console.warn('Popup unavailable', { instanceId, activityId });
      return;
    }
    try {
      sdk.app.page.openPopup(LEAD_POPUP_ID, {
        ActivityID: String(activityId),
        InstanceId: String(instanceId),
        ActivityInstanceId: String(activityInstanceId || activityId),
        ActivityId: String(activityId),
        activityId: String(activityId),
        InstanceID: String(instanceId),
        width: 960,
        height: 720,
        popupWidth: '960px',
        popupHeight: '720px',
      });
    } catch (e) {
      console.warn('openPopup failed:', e);
    }
  };

  const openTaskForm = async (row) => {
    const sdk = kfInstance;
    const process = sdk?.getProcess?.('Vindview_Sales_Management_A00');
    const instanceId = row?.id;
    const activityInstanceId = row?.activityInstanceId;
    if (!process?.openForm || !instanceId || !activityInstanceId) {
      // Fallback to popup (still shows Submit/Discard inside Kissflow UI).
      openKissflowPopup(row);
      return;
    }
    try {
      await process.openForm({ _id: instanceId, _activity_instance_id: activityInstanceId });
    } catch (e) {
      console.warn('openForm failed, falling back to popup', e);
      openKissflowPopup(row);
    }
  };

  const content = (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-violet-50/40 to-cyan-50">
      <header className="border-b border-indigo-100/80 bg-white/75 px-4 py-5 backdrop-blur-md sm:px-8">
        <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">
          {getGreetingText()},{' '}
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text font-bold text-transparent">
            {userName}
          </span>
        </h1>
        {!connected && !loading && (
          <p className="mt-1.5 text-xs text-amber-700">Preview mode — open inside Kissflow for live data</p>
        )}
        {loadError && <p className="mt-1.5 text-xs text-rose-600">{loadError}</p>}
      </header>

      <main className="mx-auto max-w-7xl space-y-5 p-4 sm:space-y-6 sm:p-6">
        {/* KPI cards (better business view) */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard delay={0} title="Total Leads" value={kpis.total} subtitle="All statuses" icon={Users} gradient="from-indigo-500 to-indigo-700" />
          <MetricCard delay={0.04} title="In Meeting" value={kpis.meeting} subtitle="Initial Meeting stage" icon={Target} gradient="from-violet-500 to-purple-700" />
          <MetricCard delay={0.08} title="Upcoming Meeting" value={kpis.upcomingMeeting} subtitle="Scheduled today or later" icon={Calendar} gradient="from-amber-500 to-orange-600" />
          <MetricCard delay={0.12} title="Won" value={kpis.completed} subtitle="Completed" icon={Trophy} gradient="from-emerald-500 to-teal-600" />
          <MetricCard delay={0.16} title="Lost" value={kpis.lost} subtitle="Rejected + Withdrawn" icon={XCircle} gradient="from-rose-500 to-rose-700" />
          <MetricCard delay={0.2} title="Total Amount" value={formatCurrency(kpis.amount)} subtitle="Pipeline (In Progress)" icon={DollarSign} gradient="from-cyan-500 to-blue-600" />
        </section>

        {/* Status tabs + table */}
        <section className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-xl backdrop-blur-sm">
          {/* Tabs */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40 p-3 sm:p-4">
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => {
                const active = activeTab === tab.key;
                const count = tabCounts[tab.key] ?? 0;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                      active
                        ? `bg-gradient-to-r ${tab.gradient} text-white shadow-md`
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700'
                    }`}
                  >
                    {tab.label}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                      active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative mt-3 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search in this tab..."
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  {['Customer', 'Contact', 'Owner', 'Source', 'Region', 'Product', 'Workflow Step', 'Meeting Date', 'Priority', 'Created'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={10} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-slate-100" /></td></tr>
                  ))
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center">
                      <p className="font-semibold text-slate-600">No {activeTab === 'All' ? '' : activeTab.toLowerCase()} leads</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {connected ? 'Try another tab or clear search' : 'Upload to Kissflow and open while logged in'}
                      </p>
                    </td>
                  </tr>
                ) : filteredLeads.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => openLeadDetail(row)}
                    className="cursor-pointer border-t border-slate-50 transition-colors hover:bg-indigo-50/50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{row.customerName}</p>
                      <p className="text-[11px] text-indigo-500">{row.displayId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{row.contactPerson || '—'}</p>
                      <p className="text-[11px] text-slate-400">{row.email || row.phone || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.leadOwner}</td>
                    <td className="px-4 py-3 text-slate-600">{row.leadSource}</td>
                    <td className="px-4 py-3 text-slate-600">{row.region}</td>
                    <td className="px-4 py-3 text-slate-600">{row.product}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                        {row.currentStep || row.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{row.meetingDate || row.followUpDate || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_STYLE[row.priority] || PRIORITY_STYLE.Medium}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{row.createdDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && filteredLeads.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">{filteredLeads.length} record{filteredLeads.length === 1 ? '' : 's'} shown</p>
            </div>
          )}
        </section>
      </main>

      {/* Detail drawer */}
      <AnimatePresence>
        {selectedLead && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"
              onClick={() => setSelectedLead(null)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="fixed right-0 top-0 z-[100] flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
            >
              <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 py-5 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-white/70">{selectedLead.displayId}</p>
                    <h2 className="truncate text-lg font-bold">{selectedLead.customerName}</h2>
                    <p className="mt-1 text-sm text-white/80">{selectedLead.currentStep || selectedLead.stage}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedLead(null)} className="rounded-lg bg-white/20 p-2 hover:bg-white/30">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-500">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading details...
                  </div>
                ) : (
                  <>
                    <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Lead Information</h3>
                    <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <DetailRow label="Customer" value={selectedLead.customerName} />
                      <DetailRow label="Owner" value={selectedLead.leadOwner} />
                      <DetailRow label="Source" value={selectedLead.leadSource} />
                      <DetailRow label="Region" value={selectedLead.region} />
                      <DetailRow label="Product" value={selectedLead.product} />
                      <DetailRow label="Status" value={selectedLead.status} />
                      <DetailRow label="Priority" value={selectedLead.priority} />
                      <DetailRow label="Meeting Date" value={selectedLead.meetingDate || selectedLead.followUpDate} />
                    </div>

                    <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Contact</h3>
                    <div className="mb-6 space-y-2">
                      <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                        <User className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm">{selectedLead.contactPerson || '—'}</span>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                        <Phone className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm">{selectedLead.phone || '—'}</span>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                        <Mail className="h-4 w-4 text-cyan-500" />
                        <span className="text-sm">{selectedLead.email || '—'}</span>
                      </div>
                    </div>

                    <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Commercial</h3>
                    <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <DetailRow label="Indicative Value" value={formatCurrency(selectedLead.indicativeDealValue)} />
                      <DetailRow label="Expected Value" value={formatCurrency(selectedLead.expectedDealValue)} />
                      <DetailRow label="Win Probability" value={selectedLead.winProbability ? `${selectedLead.winProbability}%` : '—'} />
                      <DetailRow label="Closure Date" value={selectedLead.expectedClosureDate} />
                    </div>

                    <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Workflow Progress</h3>
                    <WorkflowTimeline currentStage={selectedLead.currentStep || selectedLead.stage} />

                    <h3 className="mt-6 mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Required fields (for this step)</h3>
                    <div className="rounded-xl border border-slate-100 bg-white p-3">
                      {(REQUIRED_FIELDS_BY_STEP[selectedLead.currentStep || selectedLead.stage] || []).length === 0 ? (
                        <p className="text-sm text-slate-500">No configured requirements for this step.</p>
                      ) : (
                        <ul className="space-y-2">
                          {(REQUIRED_FIELDS_BY_STEP[selectedLead.currentStep || selectedLead.stage] || []).map((f) => (
                            <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                              <span className="h-2 w-2 rounded-full bg-indigo-500" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-slate-100 p-4 space-y-2">
                <button
                  type="button"
                  onClick={() => openTaskForm(selectedLead)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 py-3 text-sm font-semibold text-white shadow-md hover:shadow-lg"
                >
                  <ExternalLink className="h-4 w-4" /> Open Task Form (Submit / Discard)
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );

  if (!useLayout) return content;
  return <AppLayout>{content}</AppLayout>;
}

export default function LeadDashboardPage({ useLayout = false }) {
  return <LeadDashboardContent useLayout={useLayout} />;
}
