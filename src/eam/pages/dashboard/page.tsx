import { useState } from 'react'
import { DashboardKPIs } from './components/DashboardKPIs'
import { WarrantyAlertCard } from './components/WarrantyAlertCard'
import { EntityFilterBar } from './components/EntityFilterBar'
import { useAppContext } from '@eam/context/AppContext'
import { assetRequests } from '@eam/mocks/requests'
import { Link } from 'react-router-dom'

const EmployeeDashboard = () => {
  const { currentEmployeeId } = useAppContext()
  const myRequests = assetRequests.filter((r) => r.employeeId === currentEmployeeId)
  const pending = myRequests.filter((r) => r.status === 'Pending').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">My Dashboard</h1>
        <p className="mt-0.5 text-sm text-gray-500">Welcome back, Arjun Mehta</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'My Assigned Assets', value: 1, icon: 'ri-computer-line', color: '#023957', bg: '#e6eef3' },
          { label: 'Pending Requests', value: pending, icon: 'ri-file-list-3-line', color: '#d97706', bg: '#fef3c7' },
          { label: 'Approved Requests', value: myRequests.filter((r) => r.status === 'Approved').length, icon: 'ri-checkbox-circle-line', color: '#15803d', bg: '#dcfce7' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-100 bg-white p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: card.bg }}>
              <i className={`${card.icon} text-lg`} style={{ color: card.color }} />
            </div>
            <p className="text-2xl font-bold text-gray-800">{card.value}</p>
            <p className="mt-0.5 text-xs text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">My Recent Requests</h3>
          <Link to="/requests" className="cursor-pointer text-xs font-medium text-secondary hover:underline">
            View All
          </Link>
        </div>
        {myRequests.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No requests yet.</p>
        ) : (
          <div className="space-y-3">
            {myRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{req.assetType}</p>
                  <p className="text-xs text-gray-400">
                    {req.requestNo} · {req.requestDate}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    req.status === 'Approved'
                      ? 'bg-green-50 text-green-700'
                      : req.status === 'Rejected'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const ManagerDashboard = () => {
  const [selectedEntity, setSelectedEntity] = useState('all')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Asset Management Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">Overview of all enterprise assets · 31 March 2026</p>
        </div>
        <Link
          to="/assets"
          className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: '#023957' }}
        >
          <i className="ri-add-line" aria-hidden />
          Add Asset
        </Link>
      </div>

      <EntityFilterBar selectedEntity={selectedEntity} onEntityChange={setSelectedEntity} />
      <DashboardKPIs />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WarrantyAlertCard />
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <h3 className="font-display text-sm font-semibold text-gray-800">More dashboard cards</h3>
          <p className="mt-1 text-xs text-gray-500">Remaining EAM dashboard cards can be ported next.</p>
        </div>
      </div>
    </div>
  )
}

const DashboardPage = () => {
  const { role } = useAppContext()
  return role === 'manager' ? <ManagerDashboard /> : <EmployeeDashboard />
}

export default DashboardPage

