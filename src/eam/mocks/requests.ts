export type RequestStatus = 'Pending' | 'Approved' | 'Rejected'
export type RequestPriority = 'Low' | 'Medium' | 'High'

export interface AssetRequest {
  id: string
  requestNo: string
  employeeId: string
  employeeName: string
  department: string
  assetType: string
  reason: string
  priority: RequestPriority
  status: RequestStatus
  requestDate: string
  reviewDate?: string
  reviewerNote?: string
}

export const assetRequests: AssetRequest[] = [
  {
    id: 'req1',
    requestNo: 'REQ-2026-001',
    employeeId: 'e1',
    employeeName: 'Arjun Mehta',
    department: 'Engineering',
    assetType: 'Laptop',
    reason: 'Current laptop is too slow for development tasks, need upgrade for better performance.',
    priority: 'High',
    status: 'Pending',
    requestDate: '2026-03-28',
  },
  {
    id: 'req2',
    requestNo: 'REQ-2026-002',
    employeeId: 'e2',
    employeeName: 'Priya Sharma',
    department: 'HR',
    assetType: 'Mobile Phone',
    reason: 'Need a mobile phone for field employee coordination and remote HR activities.',
    priority: 'Medium',
    status: 'Approved',
    requestDate: '2026-03-20',
    reviewDate: '2026-03-22',
    reviewerNote: 'Approved. Asset will be assigned from available stock.',
  },
  {
    id: 'req3',
    requestNo: 'REQ-2026-003',
    employeeId: 'e4',
    employeeName: 'Neha Singh',
    department: 'Marketing',
    assetType: 'Projector',
    reason: 'Need projector for client presentations at marketing events.',
    priority: 'Medium',
    status: 'Rejected',
    requestDate: '2026-03-15',
    reviewDate: '2026-03-17',
    reviewerNote: 'Rejected. Use shared projector available in conference room.',
  },
  {
    id: 'req4',
    requestNo: 'REQ-2026-004',
    employeeId: 'e8',
    employeeName: 'Kavya Nair',
    department: 'Engineering',
    assetType: 'Monitor',
    reason: 'Working on dual-screen projects, need additional monitor for productivity.',
    priority: 'High',
    status: 'Pending',
    requestDate: '2026-03-30',
  },
  {
    id: 'req5',
    requestNo: 'REQ-2026-005',
    employeeId: 'e9',
    employeeName: 'Suresh Babu',
    department: 'Admin',
    assetType: 'Printer',
    reason: 'Office printer is outdated and frequently breaks down, need replacement.',
    priority: 'Low',
    status: 'Pending',
    requestDate: '2026-03-31',
  },
]

