export default function DelayRevisionSection({ data }) {
  const delayed = data.filter((p) => p.delayDays > 0 || p.revisedCount > 0);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm lg:rounded-3xl lg:border-white/80 lg:bg-white/95 lg:shadow-lg lg:shadow-slate-200/40 lg:backdrop-blur-sm"
      data-aos="fade-up"
      data-aos-duration="700"
    >
      <div className="flex flex-col gap-2 border-b border-slate-100 bg-gradient-to-r from-rose-50/60 to-white px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-center lg:text-left">
          <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Delay &amp; Revision Tracker</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">Projects with timeline changes</p>
        </div>
        <span className="inline-flex items-center justify-center gap-1.5 self-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold text-[#E53935] sm:self-auto sm:text-xs">
          <i className="ri-alarm-warning-line" aria-hidden />
          {delayed.length} affected
        </span>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {['Project', 'Original End Date', 'Latest Revised Date', 'Delay Days', 'Revisions', 'Risk'].map((h) => (
                <th key={h} className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {delayed.map((row) => {
              const latestDate = row.revisedEndDate ?? row.originalEndDate;
              const isDelayed = row.delayDays > 0;
              return (
                <tr key={row.id} className="border-b border-slate-100 transition-all hover:bg-slate-50" style={{ height: '56px' }}>
                  <td className="px-5 py-3">
                    <p className="text-sm font-semibold text-[#2C3E50]">{row.name}</p>
                    <p className="text-xs text-[#7F8C8D]">{row.id}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-[#2C3E50]">{row.originalEndDate}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-sm font-medium ${row.revisedEndDate ? 'text-[#FB8C00]' : 'text-[#7F8C8D]'}`}>
                      {latestDate}
                      {row.revisedEndDate ? <span className="ml-1 text-xs text-[#FB8C00]">(revised)</span> : null}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {isDelayed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-[#E53935]">
                        <i className="ri-time-line" aria-hidden />+{row.delayDays} days
                      </span>
                    ) : (
                      <span className="text-xs text-[#7F8C8D]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {row.revisedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#FB8C00]">
                        <i className="ri-refresh-line" aria-hidden />
                        {row.revisedCount} revision{row.revisedCount > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-[#7F8C8D]">No revisions</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {row.rag === 'Red' ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-[#E53935]">🔴 Critical</span>
                    ) : row.rag === 'Amber' ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#FB8C00]">🟡 At Risk</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-[#43A047]">🟢 Managed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2.5 p-2.5 sm:space-y-3 sm:p-3 lg:hidden">
        {delayed.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">No delayed projects</div>
        )}
        {delayed.map((row) => (
          <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100 sm:rounded-2xl sm:p-4" data-aos="zoom-in-up" data-aos-duration="500">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{row.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{row.id}</p>
              </div>
              {row.rag === 'Red' ? (
                <span className="shrink-0 rounded-lg bg-red-50 px-2 py-1 text-[10px] font-semibold text-[#E53935]">🔴 Critical</span>
              ) : row.rag === 'Amber' ? (
                <span className="shrink-0 rounded-lg bg-orange-50 px-2 py-1 text-[10px] font-semibold text-[#FB8C00]">🟡 At Risk</span>
              ) : (
                <span className="shrink-0 rounded-lg bg-green-50 px-2 py-1 text-[10px] font-semibold text-[#43A047]">🟢 Managed</span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px]">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Original</span>
                <span className="font-medium text-slate-800">{row.originalEndDate}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Latest</span>
                <span className={`font-medium ${row.revisedEndDate ? 'text-[#FB8C00]' : 'text-slate-800'}`}>
                  {row.revisedEndDate ?? row.originalEndDate}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Delay</span>
                {row.delayDays > 0 ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-[#E53935]">+{row.delayDays}d</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Revisions</span>
                <span className="font-medium text-slate-800">{row.revisedCount}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
