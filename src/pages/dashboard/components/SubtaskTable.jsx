import { useState } from 'react';

function StatusBadge({ status }) {
  const map = {
    Completed: { bg: 'bg-green-50', text: 'text-[#43A047]', dot: 'bg-[#43A047]' },
    'In Progress': { bg: 'bg-blue-50', text: 'text-[#1E88E5]', dot: 'bg-[#1E88E5]' },
    Pending: { bg: 'bg-gray-100', text: 'text-[#7F8C8D]', dot: 'bg-gray-400' },
    Overdue: { bg: 'bg-red-50', text: 'text-[#E53935]', dot: 'bg-[#E53935]' },
  };
  const s = map[status] ?? map.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-xs ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${status === 'Overdue' ? 'animate-pulse' : ''}`} />
      {status}
    </span>
  );
}

export default function SubtaskTable({ data, onRowClick }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const projects = Array.from(new Set(data.map((d) => d.projectName)));
  const filtered = data.filter((row) => {
    if (statusFilter !== 'all' && row.status !== statusFilter) return false;
    if (projectFilter !== 'all' && row.projectName !== projectFilter) return false;
    if (
      search &&
      !row.taskName.toLowerCase().includes(search.toLowerCase()) &&
      !row.assignedTo.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl"
      data-aos="fade-up"
      data-aos-duration="700"
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-indigo-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center">
        <div className="text-center lg:text-left">
          <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Subtask Tracker</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">{filtered.length} tasks shown</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto">
          <div className="relative w-full sm:w-40">
            <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#7F8C8D]" />
            <input
              type="text"
              placeholder="Search task..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-[11px] outline-none focus:border-indigo-500 sm:text-xs"
            />
          </div>
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="shrink-0 snap-start cursor-pointer rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-indigo-500 sm:text-xs"
            >
              <option value="all">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Overdue">Overdue</option>
            </select>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="min-w-[8rem] shrink-0 snap-start cursor-pointer rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-indigo-500 sm:max-w-[180px] sm:text-xs"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {['Project', 'Task Name', 'Assigned To', 'Status', 'Start Date', 'End Date', 'Aging', 'Delay'].map((h) => (
                <th key={h} className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <i className="ri-task-line text-3xl text-gray-300" />
                    <p className="text-sm text-[#7F8C8D]">No tasks found</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className="cursor-pointer border-b border-slate-100 transition-all duration-150 hover:bg-slate-50"
                  style={{ height: '56px' }}
                >
                  <td className="px-5 py-3">
                    <p className="max-w-[140px] truncate text-xs font-medium text-[#1E88E5]">{row.projectName}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="max-w-[200px] truncate text-sm font-medium text-[#2C3E50]">{row.taskName}</p>
                    <p className="text-xs text-[#7F8C8D]">{row.id}</p>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#1E88E5]/10 text-xs font-bold text-[#1E88E5]">
                        {row.assigneeAvatar.slice(0, 2)}
                      </div>
                      <span className="whitespace-nowrap text-sm text-[#2C3E50]">{row.assignedTo}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-5 py-3">
                    <span className="whitespace-nowrap text-sm text-[#2C3E50]">{row.startDate}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`whitespace-nowrap text-sm ${row.status === 'Overdue' ? 'font-semibold text-[#E53935]' : 'text-[#2C3E50]'}`}>
                      {row.endDate}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-[#7F8C8D]">{row.agingDays}d</span>
                  </td>
                  <td className="px-5 py-3">
                    {row.delayDays > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-[#E53935]">+{row.delayDays}d</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-[#43A047]">On time</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2.5 p-2.5 sm:space-y-3 sm:p-3 lg:hidden">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">No tasks found</div>
        )}
        {filtered.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onRowClick?.(row)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm ring-1 ring-slate-100 transition active:scale-[0.99] sm:rounded-2xl sm:p-4"
            data-aos="zoom-in-up"
            data-aos-duration="500"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#1E88E5]">Project</p>
                <p className="truncate text-sm font-semibold text-slate-800">{row.projectName}</p>
              </div>
              <StatusBadge status={row.status} />
            </div>
            <p className="mt-2 text-sm font-medium text-slate-800">{row.taskName}</p>
            <p className="text-[10px] text-slate-400">{row.id}</p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px]">
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E88E5]/10 text-[10px] font-bold text-[#1E88E5]">
                  {row.assigneeAvatar.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-500">Assignee</span>
                  <p className="truncate font-medium text-slate-800">{row.assignedTo}</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Start</span>
                <span className="font-medium text-slate-800">{row.startDate}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">End</span>
                <span className={`font-medium ${row.status === 'Overdue' ? 'text-[#E53935]' : 'text-slate-800'}`}>{row.endDate}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Aging</span>
                <span className="font-medium text-slate-700">{row.agingDays}d</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Delay</span>
                {row.delayDays > 0 ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-[#E53935]">+{row.delayDays}d</span>
                ) : (
                  <span className="text-[10px] font-medium text-[#43A047]">On time</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
