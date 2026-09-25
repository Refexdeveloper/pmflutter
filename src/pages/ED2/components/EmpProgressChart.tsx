import { MyProject } from '@/mocks/employee-dashboard';

interface EmpProgressChartProps {
  projects: MyProject[];
}

const ragColor: Record<string, string> = {
  Green: '#10B981',
  Amber: '#F59E0B',
  Red: '#EF4444',
};

const ragBg: Record<string, string> = {
  Green: '#F0FDF4',
  Amber: '#FFFBEB',
  Red: '#FEF2F2',
};

const ragLabel: Record<string, string> = {
  Green: 'On Track',
  Amber: 'At Risk',
  Red: 'Delayed',
};

export default function EmpProgressChart({ projects }: EmpProgressChartProps) {
  const overall = Math.round(
    projects.reduce((sum, p) => sum + p.progress, 0) / projects.length
  );

  const circumference = 2 * Math.PI * 48;
  const offset = circumference - (overall / 100) * circumference;

  const onTrack = projects.filter((p) => p.rag === 'Green').length;
  const atRisk = projects.filter((p) => p.rag === 'Amber').length;
  const delayed = projects.filter((p) => p.rag === 'Red').length;

  return (
    <div
      className="bg-white rounded-2xl p-6 border border-slate-100"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', fontFamily: 'Inter, sans-serif' }}
    >
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold" style={{ color: '#0F172A' }}>
            My Progress Overview
          </h3>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            Completion across all assigned projects
          </p>
        </div>
        <div className="flex items-center gap-4">
          {[
            { label: 'On Track', count: onTrack, color: '#10B981', bg: '#F0FDF4' },
            { label: 'At Risk', count: atRisk, color: '#F59E0B', bg: '#FFFBEB' },
            { label: 'Delayed', count: delayed, color: '#EF4444', bg: '#FEF2F2' },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: item.bg }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
              <span className="text-xs font-medium" style={{ color: item.color }}>
                {item.count} {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-center">
        {/* Donut */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 112 112">
              <circle cx="56" cy="56" r="48" fill="none" stroke="#F1F5F9" strokeWidth="10" />
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke={overall >= 70 ? '#10B981' : overall >= 40 ? '#F59E0B' : '#EF4444'}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1.2s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-2xl font-bold"
                style={{ color: overall >= 70 ? '#10B981' : overall >= 40 ? '#F59E0B' : '#EF4444' }}
              >
                {overall}%
              </span>
              <span className="text-[10px] font-medium" style={{ color: '#94A3B8' }}>
                Overall
              </span>
            </div>
          </div>
          <div className="mt-3 text-center">
            <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>Overall Completion</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>
              {projects.reduce((s, p) => s + p.completedTasks, 0)} /{' '}
              {projects.reduce((s, p) => s + p.totalTasks, 0)} tasks
            </p>
          </div>
        </div>

        {/* Bar chart */}
        <div className="flex-1 w-full space-y-4">
          {projects.map((p) => (
            <div key={p.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: ragColor[p.rag] }}
                  />
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: '#0F172A', maxWidth: 200 }}
                  >
                    {p.name}
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{ background: ragBg[p.rag], color: ragColor[p.rag] }}
                  >
                    {ragLabel[p.rag]}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className="text-xs font-bold" style={{ color: ragColor[p.rag] }}>
                    {p.progress}%
                  </span>
                  <span className="text-[10px]" style={{ color: '#94A3B8' }}>
                    {p.completedTasks}/{p.totalTasks}
                  </span>
                </div>
              </div>
              <div className="w-full h-2.5 rounded-full" style={{ background: '#F1F5F9' }}>
                <div
                  className="h-2.5 rounded-full transition-all duration-700"
                  style={{
                    width: `${p.progress}%`,
                    background: ragColor[p.rag],
                  }}
                />
              </div>
            </div>
          ))}

          {/* Overall bar */}
          <div className="pt-2 border-t" style={{ borderColor: '#F1F5F9' }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#3B82F6' }} />
                <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                  Overall Average
                </span>
              </div>
              <span className="text-xs font-bold" style={{ color: '#3B82F6' }}>
                {overall}%
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full" style={{ background: '#F1F5F9' }}>
              <div
                className="h-2.5 rounded-full transition-all duration-700"
                style={{ width: `${overall}%`, background: '#3B82F6' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
