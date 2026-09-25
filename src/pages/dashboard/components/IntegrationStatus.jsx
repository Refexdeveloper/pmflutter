export default function IntegrationStatus({ integrations }) {
    return (<div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h3 className="text-base font-bold text-gray-800 mb-4">Integration Status</h3>
      <div className="space-y-2.5">
        {integrations.map((item) => (<div key={item.name} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0">
              <i className={`${item.icon} text-gray-600 text-base`}/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">{item.name}</p>
              <p className="text-xs text-gray-400">{item.lastSync !== 'N/A' ? `Last sync: ${item.lastSync}` : 'Not connected'}</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${item.status === 'Connected'
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
              {item.status}
            </span>
          </div>))}
      </div>
    </div>);
}
