function agingColor(days) {
    if (days >= 10)
        return 'text-red-600 bg-red-50 border border-red-100';
    if (days >= 4)
        return 'text-amber-600 bg-amber-50 border border-amber-100';
    return 'text-emerald-600 bg-emerald-50 border border-emerald-100';
}
export default function AgingTable({ projects }) {
    return (<div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-800">Delayed Projects — Aging</h3>
        <span className="text-xs bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full">{projects.length} delayed</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {['Project', 'Owner', 'Priority', 'End Date', 'Aging'].map((h) => (<th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {h}
                </th>))}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (<tr key={p.id} className="border-b border-gray-50 hover:bg-amber-50/20 transition-all">
                <td className="px-4 py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.id}</p>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-sm text-gray-600">{p.owner}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.priority === 'High' ? 'bg-red-50 text-red-600 border border-red-100' :
                p.priority === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                    'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>{p.priority}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-sm text-gray-600">{p.endDate}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${agingColor(p.agingDays)}`}>
                    +{p.agingDays} days
                  </span>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
    </div>);
}
