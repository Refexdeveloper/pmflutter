export type AssignmentStatus = 'Active' | 'Returned' | 'Overdue'

export interface Assignment {
  id: string
  assetId: string
  assetName: string
  assetIdCode: string
  employeeId: string
  employeeName: string
  department: string
  companyId: string
  locationId: string
  assignDate: string
  expectedReturn: string
  status: AssignmentStatus
  returnDate?: string
}

export const assignments: Assignment[] = [
  {
    id: 'asgn1',
    assetId: 'a1',
    assetName: 'Dell Latitude 5540',
    assetIdCode: 'MIPL-CHN-LAP-0001',
    employeeId: 'e1',
    employeeName: 'Arjun Mehta',
    department: 'Engineering',
    companyId: 'c1',
    locationId: 'l1',
    assignDate: '2025-09-01',
    expectedReturn: '2026-08-31',
    status: 'Active',
  },
  {
    id: 'asgn2',
    assetId: 'a4',
    assetName: 'LG 27\" 4K Monitor',
    assetIdCode: 'MIPL-BLR-MON-0001',
    employeeId: 'e4',
    employeeName: 'Neha Singh',
    department: 'Marketing',
    companyId: 'c1',
    locationId: 'l3',
    assignDate: '2025-10-15',
    expectedReturn: '2026-10-14',
    status: 'Active',
  },
  {
    id: 'asgn3',
    assetId: 'a5',
    assetName: 'MacBook Pro M3',
    assetIdCode: 'TNS-DEL-LAP-0001',
    employeeId: 'e5',
    employeeName: 'Vikram Iyer',
    department: 'IT',
    companyId: 'c2',
    locationId: 'l4',
    assignDate: '2025-11-01',
    expectedReturn: '2026-10-31',
    status: 'Active',
  },
  {
    id: 'asgn4',
    assetId: 'a6',
    assetName: 'iPhone 15 Pro',
    assetIdCode: 'TNS-HYD-MOB-0001',
    employeeId: 'e6',
    employeeName: 'Sneha Reddy',
    department: 'Operations',
    companyId: 'c2',
    locationId: 'l5',
    assignDate: '2025-08-01',
    expectedReturn: '2026-07-31',
    status: 'Active',
  },
  {
    id: 'asgn5',
    assetId: 'a12',
    assetName: 'Epson EB-X51 Projector',
    assetIdCode: 'GEC-PUN-PRJ-0001',
    employeeId: 'e7',
    employeeName: 'Aditya Patel',
    department: 'Sales',
    companyId: 'c3',
    locationId: 'l6',
    assignDate: '2025-12-10',
    expectedReturn: '2026-12-09',
    status: 'Active',
  },
  {
    id: 'asgn6',
    assetId: 'a2',
    assetName: 'HP EliteBook 840',
    assetIdCode: 'MIPL-CHN-LAP-0002',
    employeeId: 'e3',
    employeeName: 'Rohan Kapoor',
    department: 'Finance',
    companyId: 'c1',
    locationId: 'l2',
    assignDate: '2025-07-01',
    expectedReturn: '2026-01-01',
    status: 'Overdue',
  },
  {
    id: 'asgn7',
    assetId: 'a10',
    assetName: 'Cisco Catalyst 2960',
    assetIdCode: 'TNS-DEL-NSW-0001',
    employeeId: 'e10',
    employeeName: 'Deepika Joshi',
    department: 'Legal',
    companyId: 'c2',
    locationId: 'l4',
    assignDate: '2025-09-15',
    expectedReturn: '2026-03-15',
    status: 'Overdue',
  },
]

