import AppLayout from '../../components/feature/AppLayout';
import { KPICard } from '../../components/base/Card';
import ProgressBar from '../../components/base/ProgressBar';
import Avatar from '../../components/base/Avatar';
import { mockPMStats } from '../../mocks/dashboard';
import { mockProjects } from '../../mocks/projects';
import { mockTasks } from '../../mocks/tasks';
import { mockEmployees } from '../../mocks/employees';
export default function PMDashboardPage() {
    const { myProjects, totalTasks, completedTasks, overdueTasks, upcomingDeadlines, taskProgress } = mockPMStats;
    const myProjectList = mockProjects.slice(0, myProjects);
    const overdueMockTasks = mockTasks.filter((t) => t.status === 'In Progress').slice(0, 3);
    const urgencyMap = {
        high: 'text-red-600 bg-red-50 border-red-100',
        medium: 'text-amber-600 bg-amber-50 border-amber-100',
        low: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    };
    return (<AppLayout>
      {/* Hero Banner */}
      <div className="relative mb-4 overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-400 p-3.5 sm:mb-6 sm:rounded-2xl sm:p-6">
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-10">
          <i className="ri-folder-3-fill text-white" style={{ fontSize: '200px', position: 'absolute', right: '-20px', top: '-20px' }}/>
        </div>
        <div className="relative z-10">
          <p className="text-xs text-white/80 sm:text-sm">Good morning,</p>
          <h1 className="mt-1 text-lg font-bold text-white sm:text-2xl">Arjun Mehta</h1>
          <p className="mt-1 text-[11px] text-white/70 sm:text-sm">Project Manager · {myProjects} active projects · {overdueTasks} overdue tasks</p>
        </div>
        <div className="relative z-10 mt-3 flex items-center gap-2.5 sm:mt-4 sm:gap-3">
          <button className="whitespace-nowrap rounded-lg border border-white/30 bg-white/20 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-white/30 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm">
            <i className="ri-add-line mr-1.5"/>Create Task
          </button>
          <button className="whitespace-nowrap rounded-lg border border-white/30 bg-white/20 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-white/30 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm">
            <i className="ri-folder-add-line mr-1.5"/>New Project
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:mb-6 sm:gap-4 lg:grid-cols-4">
        <KPICard title="My Projects" value={myProjects} icon="ri-folder-3-line" gradient="from-blue-500 to-blue-400"/>
        <KPICard title="Total Tasks" value={totalTasks} icon="ri-task-line" gradient="from-emerald-500 to-emerald-400"/>
        <KPICard title="Completed" value={completedTasks} icon="ri-checkbox-circle-line" gradient="from-amber-500 to-amber-400"/>
        <KPICard title="Overdue Tasks" value={overdueTasks} icon="ri-alarm-warning-line" gradient="from-red-500 to-rose-400" trend={{ value: 'Needs attention', positive: false }}/>
      </div>

      {/* Main Grid */}
      <div className="mb-4 grid grid-cols-1 gap-3.5 sm:mb-5 sm:gap-5 lg:grid-cols-12">
        {/* My Projects */}
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 sm:rounded-2xl sm:p-5 lg:col-span-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800 sm:text-base">My Projects</h3>
            <a href="/projects" className="text-xs text-blue-500 hover:text-blue-600">View all →</a>
          </div>
          <div className="space-y-3">
            {myProjectList.map((p) => (<div key={p.id} className="p-3 rounded-xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-800 truncate flex-1">{p.name}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${p.health === 'Green' ? 'bg-emerald-50 text-emerald-600' :
                p.health === 'Amber' ? 'bg-amber-50 text-amber-600' :
                    'bg-red-50 text-red-600'}`}>{p.health}</span>
                </div>
                <ProgressBar value={p.progress} size="sm" className="mb-1.5"/>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">{p.progress}% complete</span>
                  <span className="text-[10px] text-gray-400">Due: {p.endDate}</span>
                </div>
              </div>))}
          </div>
        </div>

        {/* Task Progress */}
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 sm:rounded-2xl sm:p-5 lg:col-span-3">
          <h3 className="mb-4 text-sm font-bold text-gray-800 sm:mb-5 sm:text-base">Task Progress</h3>
          <div className="flex flex-col items-center gap-5">
            {[
            { label: 'Completed', value: taskProgress.completed, total: totalTasks, color: '#10B981' },
            { label: 'In Progress', value: taskProgress.inProgress, total: totalTasks, color: '#3B82F6' },
            { label: 'Pending', value: taskProgress.pending, total: totalTasks, color: '#F59E0B' },
        ].map((item) => {
            const pct = Math.round((item.value / item.total) * 100);
            const RADIUS = 45;
            const CIRC = 2 * Math.PI * RADIUS;
            const dash = (pct / 100) * CIRC;
            return (<div key={item.label} className="flex items-center gap-4 w-full">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#F3F4F6" strokeWidth="10"/>
                      <circle cx="50" cy="50" r={RADIUS} fill="none" stroke={item.color} strokeWidth="10" strokeDasharray={`${dash} ${CIRC - dash}`} strokeLinecap="round" className="transition-all duration-1000"/>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-700">{pct}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.value} of {item.total} tasks</p>
                  </div>
                </div>);
        })}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 sm:rounded-2xl sm:p-5 lg:col-span-4">
          <h3 className="mb-3 text-sm font-bold text-gray-800 sm:mb-4 sm:text-base">Upcoming Deadlines</h3>
          <div className="relative pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 via-emerald-400 to-amber-400"/>
            <div className="space-y-4">
              {upcomingDeadlines.map((d, i) => (<div key={i} className="relative">
                  <div className="absolute -left-[18px] top-1 w-3 h-3 rounded-full bg-white border-2 border-blue-400"/>
                  <div className={`p-3 rounded-xl border ${urgencyMap[d.urgency]} cursor-pointer hover:opacity-80 transition-all`}>
                    <p className="text-xs font-semibold">{d.task}</p>
                    <p className="text-[10px] opacity-70 mt-0.5">{d.project}</p>
                    <p className="text-[10px] font-medium mt-1 opacity-80">
                      <i className="ri-calendar-line mr-1"/>
                      Due: {d.dueDate}
                    </p>
                  </div>
                </div>))}
            </div>
          </div>
        </div>
      </div>

      {/* Team Workload */}
      <div className="rounded-xl border border-gray-100 bg-white p-3.5 sm:rounded-2xl sm:p-5">
        <h3 className="mb-3 text-sm font-bold text-gray-800 sm:mb-4 sm:text-base">Team Workload</h3>
        <div className="space-y-3">
          {mockEmployees.map((emp) => {
            const pct = Math.round((emp.completedTasks / emp.taskCount) * 100);
            return (<div key={emp.id} className="flex items-center gap-2.5 sm:gap-4">
                <Avatar initials={emp.avatar} size="sm"/>
                <div className="w-32 flex-shrink-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{emp.name}</p>
                  <p className="text-xs text-gray-400">{emp.role}</p>
                </div>
                <div className="flex-1">
                  <ProgressBar value={emp.completedTasks} max={emp.taskCount} size="sm" gradient="from-blue-500 via-emerald-500 to-amber-400"/>
                </div>
                <span className="text-xs text-gray-500 w-24 text-right flex-shrink-0">
                  {emp.completedTasks}/{emp.taskCount} tasks
                </span>
                <span className={`text-xs font-medium w-10 text-right flex-shrink-0 ${pct >= 70 ? 'text-emerald-500' : pct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                  {pct}%
                </span>
              </div>);
        })}
        </div>
      </div>
    </AppLayout>);
}
