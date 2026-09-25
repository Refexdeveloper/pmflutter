import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const JELLY_IN = {
  type: 'spring',
  stiffness: 200,
  damping: 14,
  mass: 0.85,
};
const JELLY_OUT = {
  type: 'spring',
  stiffness: 260,
  damping: 22,
  mass: 0.8,
};

function StatusBadge({ status }) {
  const map = {
    Completed: 'bg-green-50 text-[#43A047]',
    'In Progress': 'bg-blue-50 text-[#1E88E5]',
    Pending: 'bg-gray-100 text-[#7F8C8D]',
    Overdue: 'bg-red-50 text-[#E53935]',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default function ProjectDrillDownModal({ project, onClose }) {
  const [displayProject, setDisplayProject] = useState(null);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const closeCommittedRef = useRef(false);

  useEffect(() => {
    if (project) {
      closeCommittedRef.current = false;
      setDisplayProject(project);
      setOpen(true);
      setActiveTab('overview');
    }
  }, [project]);

  useEffect(() => {
    if (!project && displayProject) {
      setOpen(false);
    }
  }, [project, displayProject]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const finishClose = useCallback(() => {
    if (closeCommittedRef.current) return;
    closeCommittedRef.current = true;
    setDisplayProject(null);
    onClose?.();
  }, [onClose]);

  const requestClose = useCallback(() => {
    setOpen(false);
  }, []);

  if (!displayProject && !open) return null;
  if (open && !displayProject) return null;

  const p = displayProject;
  const tasks = Array.isArray(p.subtasks) ? p.subtasks : [];
  const revisionHistory = Array.isArray(p.revisionHistory) ? p.revisionHistory : [];
  const revisedCount = p.revisedCount ?? revisionHistory.length;

  const progressColor = p.progress >= 70 ? '#43A047' : p.progress >= 40 ? '#FB8C00' : '#E53935';
  const ragConfig = {
    Red: { bg: 'bg-red-50', text: 'text-[#E53935]', border: 'border-[#E53935]', label: '🔴 Delayed' },
    Amber: { bg: 'bg-orange-50', text: 'text-[#FB8C00]', border: 'border-[#FB8C00]', label: '🟡 At Risk' },
    Green: { bg: 'bg-green-50', text: 'text-[#43A047]', border: 'border-[#43A047]', label: '🟢 On Track' },
  }[p.rag];

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { key: 'subtasks', label: `Subtasks (${tasks.length})`, icon: 'ri-list-check-3' },
    { key: 'revisions', label: `Revisions (${revisedCount})`, icon: 'ri-history-line' },
  ];

  return (
    <AnimatePresence mode="sync" onExitComplete={finishClose}>
      {open && p ? (
        <motion.div
          key={`${p.id}-overlay`}
          className="fixed inset-0 z-[200] overflow-hidden bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          onClick={requestClose}
        >
          <div className="flex min-h-full items-center justify-center p-3 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <motion.div
              role="dialog"
              aria-modal="true"
              className="flex w-full max-w-[58rem] flex-col overflow-hidden rounded-2xl bg-white"
              initial={{ opacity: 0, scale: 0.84, y: 32 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{
                opacity: 0,
                scale: 0.9,
                y: 22,
                transition: JELLY_OUT,
              }}
              transition={JELLY_IN}
              style={{
                transformOrigin: 'center center',
                boxShadow: '0 20px 60px rgba(31, 41, 55, 0.28)',
              }}
            >
              {/* Header */}
              <div className="flex shrink-0 items-start justify-between border-b border-gray-100 bg-[#F5F7FA] px-6 py-5">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-[#7F8C8D]">
                      {p.id}
                    </span>
                    {ragConfig ? (
                      <span className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold ${ragConfig.bg} ${ragConfig.text}`}>
                        {ragConfig.label}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="truncate text-lg font-bold text-[#2C3E50]">{p.name}</h2>
                  <p className="mt-0.5 text-xs text-[#7F8C8D]">
                    {p.lineOfBusiness} · Owner: {p.owner}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={requestClose}
                  className="ml-4 flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#7F8C8D] transition-all hover:bg-gray-200 hover:text-[#2C3E50]"
                >
                  <i className="ri-close-line text-lg" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex shrink-0 border-b border-gray-100 bg-white px-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-all ${
                      activeTab === tab.key
                        ? 'border-[#1E88E5] text-[#1E88E5]'
                        : 'border-transparent text-[#7F8C8D] hover:text-[#2C3E50]'
                    }`}
                  >
                    <i className={tab.icon} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Body */}
              <div className="max-h-[90vh] overflow-y-auto p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-5">
                    <div className="rounded-xl bg-[#F5F7FA] p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#2C3E50]">Overall Progress</span>
                        <span className="text-2xl font-bold" style={{ color: progressColor }}>
                          {p.progress}%
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${p.progress}%`, backgroundColor: progressColor }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-[#7F8C8D]">
                          {p.completedTasks} of {p.totalTasks} tasks completed
                        </span>
                        <span className="text-xs text-[#7F8C8D]">{p.totalTasks - p.completedTasks} remaining</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      {[
                        { label: 'Start Date', value: p.startDate, icon: 'ri-calendar-line', color: 'text-[#1E88E5]' },
                        { label: 'Original End Date', value: p.originalEndDate, icon: 'ri-calendar-check-line', color: 'text-[#43A047]' },
                        {
                          label: 'Revised End Date',
                          value: p.revisedEndDate ?? 'No revision',
                          icon: 'ri-calendar-2-line',
                          color: p.revisedEndDate ? 'text-[#FB8C00]' : 'text-[#7F8C8D]',
                        },
                        {
                          label: 'Priority',
                          value: p.priority,
                          icon: 'ri-flag-line',
                          color: p.priority === 'High' ? 'text-[#E53935]' : p.priority === 'Medium' ? 'text-[#FB8C00]' : 'text-[#43A047]',
                        },
                        {
                          label: 'Delay Days',
                          value: p.delayDays > 0 ? `+${p.delayDays} days` : 'On schedule',
                          icon: 'ri-time-line',
                          color: p.delayDays > 0 ? 'text-[#E53935]' : 'text-[#43A047]',
                        },
                        {
                          label: 'Revisions',
                          value: `${revisedCount} revision${revisedCount !== 1 ? 's' : ''}`,
                          icon: 'ri-refresh-line',
                          color: revisedCount > 0 ? 'text-[#FB8C00]' : 'text-[#7F8C8D]',
                        },
                      ].map((item) => (
                        <div key={item.label} className="rounded-xl border border-gray-100 bg-white p-3">
                          <div className="mb-1 flex items-center gap-1.5">
                            <i className={`${item.icon} text-sm ${item.color}`} />
                            <span className="text-xs text-[#7F8C8D]">{item.label}</span>
                          </div>
                          <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <p className="text-xs text-[#7F8C8D]">Risk</p>
                        <p className="text-sm font-semibold text-[#2C3E50]">{p.risk || 'N/A'}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <p className="text-xs text-[#7F8C8D]">Entity</p>
                        <p className="text-sm font-semibold text-[#2C3E50]">{p.entity || 'N/A'}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <p className="text-xs text-[#7F8C8D]">Governance</p>
                        <p className="text-sm font-semibold text-[#2C3E50]">{p.governanceFrequency || 'N/A'}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <p className="text-xs text-[#7F8C8D]">AI Usage</p>
                        <p className={`text-sm font-semibold ${p.aiUsage ? 'text-[#43A047]' : 'text-[#7F8C8D]'}`}>
                          {p.aiUsage ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'subtasks' && (
                  <div className="space-y-2">
                    {tasks.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10">
                        <i className="ri-task-line text-3xl text-gray-300" />
                        <p className="text-sm text-[#7F8C8D]">No subtasks found</p>
                      </div>
                    ) : (
                      tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex cursor-pointer items-center gap-4 rounded-xl border border-gray-100 p-4 transition-all hover:border-[#1E88E5]/30 hover:bg-blue-50/20"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#2C3E50]">{task.taskName}</p>
                            <div className="mt-1 flex items-center gap-3">
                              <span className="text-xs text-[#7F8C8D]">{task.id}</span>
                              <span className="text-xs text-[#7F8C8D]">·</span>
                              <span className="text-xs text-[#7F8C8D]">{task.assignedTo}</span>
                              <span className="text-xs text-[#7F8C8D]">·</span>
                              <span className="text-xs text-[#7F8C8D]">Due: {task.endDate}</span>
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-3">
                            {task.delayDays > 0 ? (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-[#E53935]">
                                +{task.delayDays}d
                              </span>
                            ) : null}
                            <StatusBadge status={task.status} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'revisions' && (
                  <div>
                    {revisionHistory.length === 0 && (!p.activityHistory || p.activityHistory.length === 0) ? (
                      <div className="flex flex-col items-center gap-2 py-10">
                        <i className="ri-history-line text-3xl text-gray-300" />
                        <p className="text-sm text-[#7F8C8D]">No revisions recorded</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute bottom-0 left-5 top-0 w-px bg-gray-200" />
                        <div className="space-y-4">
                          {revisionHistory.map((rev, idx) => (
                            <div key={rev.key ?? idx} className="relative pl-12">
                              <div
                                className="absolute left-3.5 top-3 h-3 w-3 rounded-full border-2 border-white bg-[#FB8C00]"
                                style={{ boxShadow: '0 0 0 2px #FB8C00' }}
                              />
                              <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4">
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-[#FB8C00]">Revision #{idx + 1}</span>
                                  <span className="text-xs text-[#7F8C8D]">{rev.date}</span>
                                </div>
                                <div className="mb-2 flex items-center gap-2">
                                  <span className="text-xs text-[#7F8C8D] line-through">{rev.previousEndDate}</span>
                                  <i className="ri-arrow-right-line text-xs text-[#FB8C00]" />
                                  <span className="text-xs font-semibold text-[#FB8C00]">{rev.newEndDate}</span>
                                </div>
                                <p className="text-sm text-[#2C3E50]">{rev.reason}</p>
                                <p className="mt-1 text-xs text-[#7F8C8D]">Revised by: {rev.revisedBy}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(p.activityHistory) && p.activityHistory.length > 0 ? (
                      <div className="mt-6">
                        <h4 className="mb-3 text-sm font-semibold text-[#2C3E50]">Activity History</h4>
                        <div className="space-y-3">
                          {p.activityHistory.map((act) => (
                            <div key={act.key} className="rounded-xl border border-gray-100 bg-white p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-[#2C3E50]">
                                  {act.eventType} - {act.field}
                                </p>
                                <span className="text-xs text-[#7F8C8D]">{act.date || 'N/A'}</span>
                              </div>
                              <p className="mt-1 text-xs text-[#7F8C8D]">
                                By: {act.by}
                                {act.status ? ` | Status: ${act.status}` : ''}
                              </p>
                              {(act.oldValue || act.newValue) && (
                                <p className="mt-1 text-xs text-[#2C3E50]">
                                  {act.oldValue ? String(act.oldValue) : 'N/A'} → {act.newValue ? String(act.newValue) : 'N/A'}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
