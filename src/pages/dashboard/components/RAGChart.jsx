const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
function getArc(value, total, offset) {
    const pct = value / total;
    const len = pct * CIRCUMFERENCE;
    return { strokeDasharray: `${len} ${CIRCUMFERENCE - len}`, strokeDashoffset: -offset };
}
export default function RAGChart({ distribution, total }) {
    const greenOffset = 0;
    const amberOffset = (distribution.green / total) * CIRCUMFERENCE;
    const redOffset = amberOffset + (distribution.amber / total) * CIRCUMFERENCE;
    const green = getArc(distribution.green, total, greenOffset);
    const amber = getArc(distribution.amber, total, amberOffset);
    const red = getArc(distribution.red, total, redOffset);
    return (<div className="bg-white rounded-2xl border border-gray-100 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-800">RAG Status</h3>
        <span className="text-xs text-gray-400">{total} projects</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Donut chart */}
        <div className="relative w-44 h-44">
          <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
            {/* Background circle */}
            <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="#F3F4F6" strokeWidth="20"/>
            {/* Green */}
            <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="#10B981" strokeWidth="20" strokeDasharray={green.strokeDasharray} strokeDashoffset={green.strokeDashoffset} strokeLinecap="round" className="transition-all duration-1000"/>
            {/* Amber */}
            <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="#F59E0B" strokeWidth="20" strokeDasharray={amber.strokeDasharray} strokeDashoffset={amber.strokeDashoffset} strokeLinecap="round" className="transition-all duration-1000"/>
            {/* Red */}
            <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="#EF4444" strokeWidth="20" strokeDasharray={red.strokeDasharray} strokeDashoffset={red.strokeDashoffset} strokeLinecap="round" className="transition-all duration-1000"/>
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold bg-gradient-to-br from-blue-500 to-emerald-500 bg-clip-text text-transparent">{total}</span>
            <span className="text-xs text-gray-400">Total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-5">
          {[
            { label: 'On Track', color: 'bg-emerald-500', value: distribution.green },
            { label: 'Near Risk', color: 'bg-amber-500', value: distribution.amber },
            { label: 'Delayed', color: 'bg-red-500', value: distribution.red },
        ].map((item) => (<div key={item.label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${item.color} flex-shrink-0`}/>
              <span className="text-xs text-gray-600">{item.label}</span>
              <span className="text-xs font-bold text-gray-800">{item.value}</span>
            </div>))}
        </div>
      </div>
    </div>);
}
