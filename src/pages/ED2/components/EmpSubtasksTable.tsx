import { useState } from 'react';
import { MySubtask } from '@/mocks/employee-dashboard';

interface EmpSubtasksTableProps {
  tasks: MySubtask[];
  onComplete: (id: string) => void;
  onStatusChange: (id: string, status: MySubtask['status']) => void;
}

const priorityConfig = {
  High: { bg: '#FEF2F2', color: '#EF4444', label: 'High' },
  Medium: { bg: '#FFFBEB', color: '#F59E0B', label: 'Medium' },
  Low: { bg: '#F0FDF4', color: '#10B981', label: 'Low' },
};

const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
  'Not Started': { bg: '#F8FAFC', color: '#94A3B8', label: 'Not Started' },
  'In Progress': { bg: '#EFF6FF', color: '#3B82F6', label: 'In Progress' },
  Completed: { bg: '#F0FDF4', color: '#10B981', label: 'Completed' },
  Overdue: { bg: '#FEF2F2', color: '#EF4444', label: 'Overdue' },
};

type FilterType = 'All' | MySubtask['status'];

export default function EmpSubtasksTable({ tasks, onComplete, onStatusChange }: EmpSubtasksTableProps) {
  const [filter, setFilter] = useState<FilterType>('All');
  const [search, setSearch] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const filtered = tasks.filter((t) => {
    const matchFilter = filter === 'All' || t.status === filter;
    const matchSearch =
      t.taskName.toLowerCase().includes(search.toLowerCase()) ||
      t.projectName.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const filterCounts: Record<string, number> = {
    All: tasks.length,
    'Not Started': tasks.filter((t) => t.status === 'Not Started').length,
    'In Progress': tasks.filter((t) => t.status === 'In Progress').length,
    Completed: tasks.filter((t) => t.status === 'Completed').length,
    Overdue: tasks.filter((t) => t.status === 'Overdue').length,
  };

  const filterTabs: FilterType[] = ['All', 'Not Started', 'In Progress', 'Completed', 'Overdue'];

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', fontFamily: 'Inter, sans-serif' }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ background: '#F0FDF4' }}
            >
              <i className="ri-checkbox-circle-line text-base" style={{ color: '#10B981' }} />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: '#0F172A' }}>
                My Tasks
              </h3>
              <p className="text-xs" style={{ color: '#94A3B8' }}>
                {tasks.filter((t) => t.status !== 'Completed').length} open &bull;{' '}
                {tasks.filter((t) => t.isOverdue).length} overdue
              </p>
            </div>
          </div>
          {/* Search */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl border"
            style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}
          >
            <i className="ri-search-line text-sm" style={{ color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Search tasks or projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm w-44"
              style={{ color: '#0F172A', fontFamily: 'Inter, sans-serif' }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="cursor-pointer"
              >
                <i className="ri-close-line text-sm" style={{ color: '#94A3B8' }} />
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterTabs.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
              style={{
                background: filter === f ? '#3B82F6' : '#F8FAFC',
                color: filter === f ? '#fff' : '#475569',
                border: `1px solid ${filter === f ? '#3B82F6' : '#E2E8F0'}`,
              }}
            >
              {f}
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{
                  background: filter === f ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                  color: filter === f ? '#fff' : '#475569',
                }}
              >
                {filterCounts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {['Project', 'Subtask Name', 'Priority', 'Due Date', 'Aging', 'Status', 'Action'].map((h) => (
                <th
                  key={h}
                  className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#94A3B8' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-14 text-center">
                  <i className="ri-task-line text-5xl block mb-3" style={{ color: '#E2E8F0' }} />
                  <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>No tasks found</p>
                  <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>
                    Try adjusting your filters or search
                  </p>
                </td>
              </tr>
            )}
            {filtered.map((t, i) => {
              const pri = priorityConfig[t.priority];
              const st = statusConfig[t.status] ?? statusConfig['Not Started'];
              const isCompleted = t.status === 'Completed';

              return (
                <tr
                  key={t.id}
                  className="transition-all duration-150"
                  style={{
                    borderTop: i > 0 ? '1px solid #F1F5F9' : undefined,
                    height: 56,
                    background:
                      t.status === 'Overdue'
                        ? '#FEF2F2'
                        : hoveredId === t.id
                        ? '#F8FAFC'
                        : 'transparent',
                    borderLeft:
                      t.status === 'Overdue'
                        ? '3px solid #EF4444'
                        : t.status === 'In Progress'
                        ? '3px solid #3B82F6'
                        : '3px solid transparent',
                  }}
                  onMouseEnter={() => setHoveredId(t.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <td className="px-6 py-3">
                    <span
                      className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ background: '#EFF6FF', color: '#3B82F6' }}
                    >
                      {t.projectName.length > 16 ? t.projectName.slice(0, 16) + '…' : t.projectName}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      {isCompleted && (
                        <i className="ri-checkbox-circle-fill text-sm flex-shrink-0" style={{ color: '#10B981' }} />
                      )}
                      <p
                        className="text-sm font-medium"
                        style={{
                          color: '#0F172A',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          opacity: isCompleted ? 0.5 : 1,
                        }}
                      >
                        {t.taskName}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: pri.bg, color: pri.color }}
                    >
                      {pri.label}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-sm"
                        style={{ color: t.isOverdue ? '#EF4444' : '#0F172A' }}
                      >
                        {formatDate(t.dueDate)}
                      </span>
                      {t.isOverdue && (
                        <i className="ri-alarm-warning-line text-xs" style={{ color: '#EF4444' }} />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: t.agingDays > 20 ? '#EF4444' : t.agingDays > 10 ? '#F59E0B' : '#94A3B8' }}
                    >
                      {t.agingDays > 0 ? `${t.agingDays}d` : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <select
                      value={t.status}
                      onChange={(e) => onStatusChange(t.id, e.target.value as MySubtask['status'])}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-medium border-0 outline-none cursor-pointer"
                      style={{ background: st.bg, color: st.color, fontFamily: 'Inter, sans-serif' }}
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </td>
                  <td className="px-6 py-3">
                    {!isCompleted ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onComplete(t.id); }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer hover:shadow-sm whitespace-nowrap"
                        style={{ background: '#F0FDF4', color: '#10B981', border: '1px solid #A7F3D0' }}
                      >
                        <i className="ri-check-line" />
                        Complete
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#10B981' }}>
                        <i className="ri-checkbox-circle-fill" />
                        Done
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div
        className="px-6 py-3 border-t flex items-center justify-between flex-wrap gap-2"
        style={{ borderColor: '#F1F5F9', background: '#F8FAFC' }}
      >
        <p className="text-xs" style={{ color: '#94A3B8' }}>
          Showing {filtered.length} of {tasks.length} tasks
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          {(['Not Started', 'In Progress', 'Completed', 'Overdue'] as const).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: statusConfig[s].color }}
              />
              <span className="text-xs" style={{ color: '#94A3B8' }}>
                {s}: {tasks.filter((t) => t.status === s).length}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
