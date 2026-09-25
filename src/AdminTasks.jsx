import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { KissflowSDKContext, kf } from './sdk/index.js';
import {
  fetchAdminTaskTrackerData,
  enrichTasksWithProjectCatalog,
} from './lib/kfTaskTracker.js';
import { fetchProjectDashboardData } from './lib/kfProjectDashboard.js';
import {
  fetchAdminTasksReportCount,
  fetchAdminTasksReportItemDetails,
  mergeAdminTaskRowWithReportDetails,
} from './lib/kfAdminTasksApis.js';
import { TASKS_ENTITY } from './lib/pmMyItemsEntities.js';
import { resolvePmPopupId } from './lib/kfPmMyItemsPaths.js';
import TablePaginationBar, { PT_TABLE_PAGE_SIZE } from './components/TablePaginationBar.jsx';

function resolveKfSdk(kfInstance) {
  return (
    kfInstance
    ?? (typeof kf !== 'undefined' ? kf : null)
    ?? (typeof window !== 'undefined' ? window.kf : null)
  );
}

function isEmptyProjectName(projectName) {
  const v = String(projectName ?? '').trim();
  return !v || v === '—' || v === '-' || v.toLowerCase() === 'n/a';
}

function statusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('complete') || s.includes('closed') || s.includes('done')) {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (s.includes('overdue') || s.includes('reject')) return 'bg-rose-100 text-rose-700';
  if (s.includes('progress') || s.includes('review')) return 'bg-sky-100 text-sky-700';
  if (s.includes('draft') || s.includes('withdraw')) return 'bg-slate-100 text-slate-600';
  return 'bg-violet-100 text-violet-700';
}

function resolveTaskPopupIds(row) {
  const raw = row?.raw ?? row ?? {};
  const instanceId = String(
    row?.InstanceID
      || raw?._id
      || raw?._item_id
      || row?.id
      || '',
  ).trim();
  const activityRaw =
    row?.ActivityID
    ?? raw?._activity_instance_id
    ?? raw?.activityInstanceId
    ?? '';
  const activityId = String(
    Array.isArray(activityRaw) ? (activityRaw[0] ?? '') : activityRaw,
  ).trim();
  return { instanceId, activityId };
}

function openAdminTaskPopup(sdk, row) {
  if (typeof sdk?.app?.page?.openPopup !== 'function') {
    console.warn('AdminTasks: openPopup not available');
    sdk?.client?.showInfo?.('Kissflow popup is not available on this page.');
    return false;
  }

  const { instanceId, activityId } = resolveTaskPopupIds(row);
  if (!instanceId) {
    console.warn('AdminTasks: missing InstanceID', row);
    sdk?.client?.showInfo?.('Missing task instance id for this row.');
    return false;
  }

  const popupId = resolvePmPopupId(TASKS_ENTITY) || TASKS_ENTITY.popupId;
  const params = {
    InstanceID: instanceId,
    InstanceId: instanceId,
    ...(activityId
      ? {
          ActivityInstanceID: activityId,
          ActivityInstanceId: activityId,
          ActivityID: activityId,
          ActivityId: activityId,
          activityId,
        }
      : {}),
    width: 960,
    height: 720,
  };

  try {
    const p = sdk.app.page.openPopup(popupId, params);
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('AdminTasks: openPopup failed', err));
    }
    return true;
  } catch (err) {
    console.warn('AdminTasks: openPopup threw', err);
    return false;
  }
}

/**
 * Simple admin tasks table — loads Project_Sub_Task_A01 admin items,
 * opens the Kissflow task popup on row click.
 *
 * Extra AdminTasks-only APIs (report count / item details / table images):
 * `src/lib/kfAdminTasksApis.js` + `.cursor/skills/admin-tasks-kissflow`.
 */
export default function AdminTasks() {
  const { kf: kfFromContext } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext || resolveKfSdk(null);

  const [tasks, setTasks] = useState([]);
  const [reportCount, setReportCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!kfInstance?.api) {
      setLoading(false);
      setError('Kissflow SDK not ready — open this page inside Kissflow.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const taskRows = await fetchAdminTaskTrackerData(kfInstance, { enrichDetails: false });
      const projectRes = await fetchProjectDashboardData(kfInstance).catch(() => null);
      const countRes = await fetchAdminTasksReportCount(kfInstance).catch(() => null);
      const projectRows = (projectRes?.rows ?? []).map((p) => ({
        id: String(p.id ?? '').trim(),
        displayId: String(p.displayId ?? '').trim(),
        name: p.name ?? '—',
        projectId: String(p.id ?? p.displayId ?? '').trim(),
        raw: p,
      }));
      setTasks(
        enrichTasksWithProjectCatalog(
          (taskRows || []).map((t) => ({
            ...t,
            project: t.projectName,
          })),
          projectRows,
        ),
      );
      setReportCount(typeof countRes === 'number' ? countRes : null);
    } catch (err) {
      console.warn('AdminTasks load failed', err);
      setError(err?.message || 'Failed to load admin tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [kfInstance]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => {
      const hay = [
        t.taskName,
        t.taskId,
        t.id,
        t.project,
        t.projectName,
        t.assignedTo,
        t.status,
        t.priority,
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }, [tasks, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PT_TABLE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PT_TABLE_PAGE_SIZE;
    return filtered.slice(start, start + PT_TABLE_PAGE_SIZE);
  }, [filtered, safePage]);

  const handleRowClick = useCallback(
    async (row) => {
      const sdk = resolveKfSdk(kfInstance);
      const rowKey = String(row?.InstanceID || row?.id || '');
      setOpeningId(rowKey);

      let nextRow = row;
      const { instanceId, activityId } = resolveTaskPopupIds(row);
      // Admin list sometimes omits activity — hydrate from process-report item details.
      if (instanceId && !activityId) {
        try {
          const detail = await fetchAdminTasksReportItemDetails(kfInstance, instanceId);
          nextRow = mergeAdminTaskRowWithReportDetails(row, detail);
        } catch (err) {
          console.warn('AdminTasks: report item details failed', err?.message || err);
        }
      }

      openAdminTaskPopup(sdk, nextRow);
      setOpeningId(null);
    },
    [kfInstance],
  );

  return (
    <div className="min-h-full bg-[#edf1ff] p-3 sm:p-4 lg:p-5">
      <div className="mx-auto max-w-[1400px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-200/40">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-indigo-50/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <div>
            <h1 className="text-sm font-semibold text-slate-800 sm:text-base">Admin Tasks</h1>
            <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
              {loading
                ? 'Loading…'
                : `${filtered.length} task${filtered.length === 1 ? '' : 's'} from admin`}
              {reportCount != null && !loading ? ` · report count ${reportCount}` : ''}
              {' · click a row to open'}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-56">
              <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-[#1E88E5]"
              />
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <i className={`ri-refresh-line text-sm ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="border-b border-rose-100 bg-rose-50/80 px-4 py-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {['Task Name', 'Project', 'Assigned To', 'Start Date', 'End Date', 'Priority', 'Status'].map(
                  (label) => (
                    <th
                      key={label}
                      className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:px-5"
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading && pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                    <i className="ri-loader-4-line mr-1 inline-block animate-spin" />
                    Loading admin tasks…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                    No tasks found
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const projectLabel = row.project || row.projectName;
                  const rowKey = String(row.InstanceID || row.id || row.taskId);
                  const isOpening = openingId === rowKey;
                  return (
                    <tr
                      key={rowKey}
                      onClick={() => void handleRowClick(row)}
                      className="cursor-pointer border-b border-slate-100 transition hover:bg-blue-50/50"
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <p className="max-w-[240px] truncate text-sm font-medium text-slate-800">
                          {isOpening ? (
                            <i className="ri-loader-4-line mr-1 inline-block animate-spin text-slate-400" />
                          ) : null}
                          {row.taskName || '—'}
                        </p>
                        <p className="text-[11px] text-slate-400">{row.taskId || row.id}</p>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        {isEmptyProjectName(projectLabel) ? (
                          <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200/80">
                            Individual Task
                          </span>
                        ) : (
                          <span
                            className="inline-block max-w-[160px] truncate rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#1E88E5]"
                            title={projectLabel}
                          >
                            {projectLabel}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1E88E5]/10 text-[10px] font-bold text-[#1E88E5]">
                            {row.assigneeAvatar || '—'}
                          </span>
                          <span className="max-w-[140px] truncate text-sm text-slate-700">
                            {row.assignedTo || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700 sm:px-5">
                        {row.startDate || '—'}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div>
                          <p className="whitespace-nowrap text-sm text-slate-700">
                            {row.revisedEndDate || row.endDate || '—'}
                          </p>
                          {Number(row.delayDays) > 0 ? (
                            <p className="text-xs font-medium text-[#E53935]">+{row.delayDays}d delay</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            row.priority === 'High'
                              ? 'bg-rose-100 text-rose-700'
                              : row.priority === 'Low'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {row.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(row.status)}`}
                        >
                          {row.status || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePaginationBar
          total={filtered.length}
          page={safePage}
          onPageChange={setPage}
          pageSize={PT_TABLE_PAGE_SIZE}
        />
      </div>
    </div>
  );
}
