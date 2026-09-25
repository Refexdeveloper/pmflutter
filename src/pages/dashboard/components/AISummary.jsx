export default function AISummary({ usage }) {
    return (<div className="bg-gradient-to-br from-blue-500 via-blue-600 to-emerald-600 rounded-2xl p-5 text-white">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/20">
          <i className="ri-robot-line text-white text-base"/>
        </div>
        <h3 className="text-base font-bold">AI Usage Summary</h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
            { label: 'Active Models', value: usage.activeModels, icon: 'ri-cpu-line' },
            { label: 'Queries/Month', value: usage.queriesThisMonth.toLocaleString(), icon: 'ri-chat-3-line' },
            { label: 'Time Saved', value: usage.automationSaved, icon: 'ri-time-line' },
        ].map((stat) => (<div key={stat.label} className="bg-white/15 rounded-xl p-3 text-center">
            <div className="w-6 h-6 flex items-center justify-center mx-auto mb-1">
              <i className={`${stat.icon} text-white/80 text-sm`}/>
            </div>
            <p className="text-lg font-bold text-white">{stat.value}</p>
            <p className="text-[10px] text-white/70 mt-0.5">{stat.label}</p>
          </div>))}
      </div>
    </div>);
}
