import { useState, useMemo, useEffect } from 'react';

const PAGE_SIZE = 10;

const COLUMN_META = [
  { key: 'name', label: 'Project Name' },
  { key: 'owner', label: 'Owner' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
  { key: 'revised', label: 'Revised' },
  { key: 'progress', label: 'Progress' },
  { key: 'rag', label: 'RAG Status' },
  { key: 'status', label: 'Status' },
];

function parseRowEndDate(row) {
  const s = row.revisedEndDate ?? row.originalEndDate;
  if (s == null || s === '') return null;
  const t = Date.parse(String(s));
  return Number.isNaN(t) ? null : t;
}

function parseRowStartDate(row) {
  const s = row.startDate;
  if (s == null || s === '') return null;
  const t = Date.parse(String(s));
  return Number.isNaN(t) ? null : t;
}

function ragRank(rag) {
  const order = { Green: 1, Amber: 2, Red: 3 };
  return order[rag] ?? 99;
}

/** Sorted unique page indices with gaps filled visually via ellipsis in the UI */
function compactPageIndices(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current, current - 1, current + 1, current - 2, current + 2]);
  return [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
}

function RAGCell({ rag }) {
  const config = {
    Red: { bg: 'bg-red-50', border: 'border-l-4 border-[#E53935]', dot: '🔴', text: 'text-[#E53935]', label: 'Delayed' },
    Amber: { bg: 'bg-orange-50', border: 'border-l-4 border-[#FB8C00]', dot: '🟡', text: 'text-[#FB8C00]', label: 'At Risk' },
    Green: { bg: 'bg-green-50', border: 'border-l-4 border-[#43A047]', dot: '🟢', text: 'text-[#43A047]', label: 'On Track' },
  }[rag];
  if (!config) {
    return <span className="text-xs font-medium text-slate-500">—</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.text}`}>
      <span>{config.dot}</span>
      {config.label}
    </span>
  );
}

function StatusCell({ status }) {
  const map = {
    Active: 'bg-blue-50 text-[#1E88E5]',
    Planning: 'bg-purple-50 text-purple-600',
    'On Hold': 'bg-orange-50 text-[#FB8C00]',
    Completed: 'bg-green-50 text-[#43A047]',
  };
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function ProgressCell({ value, compact }) {
  const color = value >= 70 ? '#43A047' : value >= 40 ? '#FB8C00' : '#E53935';
  return (
    <div className={`flex items-center gap-2 ${compact ? 'min-w-0 w-full' : 'min-w-[100px]'}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="w-9 text-right text-xs font-bold" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

function SortHeader({ label, colKey, sortKey, sortDir, onSort }) {
  const active = sortKey === colKey;
  return (
    <th className="whitespace-nowrap px-5 py-3 text-left">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSort(colKey);
        }}
        className={`group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
          active ? 'text-[#1E88E5]' : 'text-[#7F8C8D] hover:text-slate-900'
        }`}
      >
        {label}
        <span className="flex flex-col leading-none opacity-70">
          <i
            className={`ri-arrow-up-s-fill text-[10px] ${active && sortDir === 'asc' ? 'text-[#1E88E5] opacity-100' : 'text-slate-300 group-hover:text-slate-400'}`}
            aria-hidden
          />
          <i
            className={`-mt-1 ri-arrow-down-s-fill text-[10px] ${active && sortDir === 'desc' ? 'text-[#1E88E5] opacity-100' : 'text-slate-300 group-hover:text-slate-400'}`}
            aria-hidden
          />
        </span>
      </button>
    </th>
  );
}

function formatProjectRef(displayId, rowId) {
  const raw = String(displayId ?? rowId ?? '').trim();
  if (!raw) return 'Task-NA';
  if (raw.startsWith('Task-')) return raw;
  return raw;
}

export default function ProjectHealthTable({ data, onRowClick }) {
  const [ragFilter, setRagFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const owners = Array.from(new Set(data.map((d) => d.owner)));
  const statuses = Array.from(new Set(data.map((d) => d.status)));

  const filtered = useMemo(
    () =>
      data.filter((row) => {
        if (ragFilter !== 'all' && row.rag !== ragFilter) return false;
        if (statusFilter !== 'all' && row.status !== statusFilter) return false;
        if (ownerFilter !== 'all' && row.owner !== ownerFilter) return false;
        if (
          search &&
          !row.name.toLowerCase().includes(search.toLowerCase()) &&
          !row.owner.toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [data, ragFilter, statusFilter, ownerFilter, search],
  );

  const sortedFiltered = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return dir * String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
        case 'owner':
          return dir * String(a.owner || '').localeCompare(String(b.owner || ''), undefined, { sensitivity: 'base' });
        case 'startDate': {
          const ta = parseRowStartDate(a);
          const tb = parseRowStartDate(b);
          if (ta == null && tb == null) return 0;
          if (ta == null) return sortDir === 'asc' ? 1 : -1;
          if (tb == null) return sortDir === 'asc' ? -1 : 1;
          return dir * (ta - tb);
        }
        case 'endDate': {
          const ta = parseRowEndDate(a);
          const tb = parseRowEndDate(b);
          if (ta == null && tb == null) return 0;
          if (ta == null) return sortDir === 'asc' ? 1 : -1;
          if (tb == null) return sortDir === 'asc' ? -1 : 1;
          return dir * (ta - tb);
        }
        case 'revised':
          return dir * ((a.revisedCount ?? 0) - (b.revisedCount ?? 0));
        case 'progress':
          return dir * ((a.progress ?? 0) - (b.progress ?? 0));
        case 'rag':
          return dir * (ragRank(a.rag) - ragRank(b.rag));
        case 'status':
          return dir * String(a.status || '').localeCompare(String(b.status || ''), undefined, { sensitivity: 'base' });
        default:
          return 0;
      }
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const total = sortedFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, total);
  const pageRows = sortedFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, ragFilter, statusFilter, ownerFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const rowBg = (rag) => {
    if (rag === 'Red') return 'hover:bg-red-50/60';
    if (rag === 'Amber') return 'hover:bg-orange-50/60';
    return 'hover:bg-green-50/40';
  };

  const pageIndexList = useMemo(() => compactPageIndices(safePage, totalPages), [safePage, totalPages]);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl"
      data-aos="fade-up"
      data-aos-duration="700"
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center">
        <div className="text-center lg:text-left">
          <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Project Health Overview</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
            {filtered.length} of {data.length} projects
            {totalPages > 1 ? ` · ${PAGE_SIZE} per page` : ''}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto">
          <div className="relative w-full sm:w-44 lg:w-44">
            <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#7F8C8D]" />
            <input
              type="text"
              placeholder="Search project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs shadow-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 lg:justify-end [&::-webkit-scrollbar]:hidden">
            <select
              value={ragFilter}
              onChange={(e) => setRagFilter(e.target.value)}
              className="min-w-0 shrink-0 snap-start cursor-pointer rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] shadow-sm outline-none focus:border-indigo-500 sm:text-xs"
            >
              <option value="all">All RAG</option>
              <option value="Red">🔴 Red</option>
              <option value="Amber">🟡 Amber</option>
              <option value="Green">🟢 Green</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-0 shrink-0 snap-start cursor-pointer rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] shadow-sm outline-none focus:border-indigo-500 sm:text-xs"
            >
              <option value="all">All Status</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="min-w-[7.5rem] shrink-0 snap-start cursor-pointer rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] shadow-sm outline-none focus:border-indigo-500 sm:max-w-[180px] sm:text-xs"
            >
              <option value="all">All Owners</option>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2 lg:hidden">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Sort by</span>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white py-1.5 pl-2 pr-6 text-[11px] font-medium text-slate-700"
        >
          {COLUMN_META.map((col) => (
            <option key={col.key} value={col.key}>
              {col.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          className="flex h-8 shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700"
          aria-label={sortDir === 'asc' ? 'Sort descending' : 'Sort ascending'}
        >
          <i className={sortDir === 'asc' ? 'ri-sort-asc' : 'ri-sort-desc'} />
          {sortDir === 'asc' ? 'A–Z' : 'Z–A'}
        </button>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {COLUMN_META.map((col) => (
                <SortHeader
                  key={col.key}
                  label={col.label}
                  colKey={col.key}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <i className="ri-inbox-line text-3xl text-gray-300" />
                    <p className="text-sm text-[#7F8C8D]">No projects found</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setRagFilter('all');
                        setStatusFilter('all');
                        setOwnerFilter('all');
                      }}
                      className="cursor-pointer text-xs text-[#1E88E5] hover:underline"
                    >
                      Clear filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick(row)}
                  className={`cursor-pointer border-b border-slate-100 transition-all duration-150 ${rowBg(row.rag)}`}
                  style={{ height: '56px' }}
                >
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#2C3E50] transition-colors hover:text-[#1E88E5]">{row.name}</p>
                      <p className="text-xs text-[#7F8C8D]">
                        {formatProjectRef(row.displayId, row.id)} · {row.lineOfBusiness}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#1E88E5] text-xs font-bold text-white">
                        {row.ownerAvatar}
                      </div>
                      <span className="whitespace-nowrap text-sm text-[#2C3E50]">{row.owner}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="whitespace-nowrap text-sm text-[#2C3E50]">{row.startDate || '—'}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div>
                      <p className="whitespace-nowrap text-sm text-[#2C3E50]">{row.revisedEndDate ?? row.originalEndDate}</p>
                      {row.delayDays > 0 ? <p className="text-xs font-medium text-[#E53935]">+{row.delayDays}d delay</p> : null}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {row.revisedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-[#FB8C00]">
                        <i className="ri-refresh-line text-xs" />
                        {row.revisedCount}x
                      </span>
                    ) : (
                      <span className="text-xs text-[#7F8C8D]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <ProgressCell value={row.progress} />
                  </td>
                  <td className="px-5 py-3">
                    <RAGCell rag={row.rag} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusCell status={row.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2.5 p-2.5 sm:space-y-3 sm:p-3 lg:hidden">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500 sm:text-sm">
            No projects found
          </div>
        )}
        {pageRows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onRowClick(row)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm ring-1 ring-slate-100 transition active:scale-[0.99] sm:rounded-2xl sm:p-4"
            data-aos="zoom-in-up"
            data-aos-duration="500"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{row.name}</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                  {formatProjectRef(row.displayId, row.id)} · {row.lineOfBusiness}
                </p>
              </div>
              <div className="shrink-0 scale-90 origin-top-right">
                <RAGCell rag={row.rag} />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px]">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E88E5] text-[10px] font-bold text-white">
                {row.ownerAvatar}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Owner</span>
                <p className="truncate font-medium text-slate-800">{row.owner}</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="shrink-0 text-slate-500">Start date</span>
                <span className="min-w-0 truncate text-right font-medium text-slate-800">{row.startDate || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="shrink-0 text-slate-500">End date</span>
                <span className="min-w-0 truncate text-right font-medium text-slate-800">{row.revisedEndDate ?? row.originalEndDate}</span>
              </div>
              {row.delayDays > 0 ? (
                <p className="text-end text-[10px] font-medium text-[#E53935]">+{row.delayDays}d delay</p>
              ) : null}
              <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Revised</span>
                {row.revisedCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-[#FB8C00]">
                    <i className="ri-refresh-line text-[10px]" />
                    {row.revisedCount}×
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Progress</span>
                <div className="mt-1">
                  <ProgressCell value={row.progress} compact />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Status</span>
                <StatusCell status={row.status} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-2 py-2.5 sm:flex-row sm:gap-3 sm:px-5 sm:py-3 lg:items-stretch">
          <p className="w-full text-center text-[10px] text-slate-500 sm:w-auto sm:text-left sm:text-xs lg:text-xs">
            Showing <span className="font-semibold text-slate-700">{pageStart}</span>–
            <span className="font-semibold text-slate-700">{pageEnd}</span> of{' '}
            <span className="font-semibold text-slate-700">{total}</span>
          </p>
          <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-0.5 sm:w-auto sm:max-w-none sm:gap-1 lg:justify-end">
            <button
              type="button"
              aria-label="First page"
              disabled={safePage <= 1}
              onClick={() => setPage(1)}
              className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:text-sm"
            >
              «
            </button>
            <button
              type="button"
              aria-label="Previous page"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:text-sm"
            >
              ‹
            </button>
            {pageIndexList.map((n, idx) => (
              <span key={n} className="flex items-center">
                {idx > 0 && pageIndexList[idx - 1] !== n - 1 ? (
                  <span className="px-1.5 text-xs font-medium text-slate-400" aria-hidden>
                    …
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label={`Page ${n}`}
                  aria-current={n === safePage ? 'page' : undefined}
                  onClick={() => setPage(n)}
                  className={`flex h-7 min-w-[1.6rem] items-center justify-center rounded-md border px-1.5 text-[10px] font-semibold shadow-sm transition sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:px-2 sm:text-xs ${
                    n === safePage
                      ? 'border-[#1E88E5] bg-[#1E88E5] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {n}
                </button>
              </span>
            ))}
            <button
              type="button"
              aria-label="Next page"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:text-sm"
            >
              ›
            </button>
            <button
              type="button"
              aria-label="Last page"
              disabled={safePage >= totalPages}
              onClick={() => setPage(totalPages)}
              className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:text-sm"
            >
              »
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
