export type EmployeeStatus = 'Active' | 'Resigned'

export interface Employee {
  id: string
  name: string
  email: string
  department: string
  companyId: string
  locationId: string
  status: EmployeeStatus
  resignDate?: string
}

export const employees: Employee[] = [
  { id: 'e1', name: 'Arjun Mehta', email: 'arjun.mehta@mipl.com', department: 'Engineering', companyId: 'c1', locationId: 'l1', status: 'Active' },
  { id: 'e2', name: 'Priya Sharma', email: 'priya.sharma@mipl.com', department: 'HR', companyId: 'c1', locationId: 'l1', status: 'Active' },
  { id: 'e3', name: 'Rohan Kapoor', email: 'rohan.kapoor@mipl.com', department: 'Finance', companyId: 'c1', locationId: 'l2', status: 'Resigned', resignDate: '2026-03-20' },
  { id: 'e4', name: 'Neha Singh', email: 'neha.singh@mipl.com', department: 'Marketing', companyId: 'c1', locationId: 'l3', status: 'Active' },
  { id: 'e5', name: 'Vikram Iyer', email: 'vikram.iyer@tns.com', department: 'IT', companyId: 'c2', locationId: 'l4', status: 'Active' },
  { id: 'e6', name: 'Sneha Reddy', email: 'sneha.reddy@tns.com', department: 'Operations', companyId: 'c2', locationId: 'l5', status: 'Resigned', resignDate: '2026-03-25' },
  { id: 'e7', name: 'Aditya Patel', email: 'aditya.patel@gec.com', department: 'Sales', companyId: 'c3', locationId: 'l6', status: 'Active' },
  { id: 'e8', name: 'Kavya Nair', email: 'kavya.nair@gec.com', department: 'Engineering', companyId: 'c3', locationId: 'l7', status: 'Active' },
  { id: 'e9', name: 'Suresh Babu', email: 'suresh.babu@mipl.com', department: 'Admin', companyId: 'c1', locationId: 'l1', status: 'Active' },
  { id: 'e10', name: 'Deepika Joshi', email: 'deepika.joshi@tns.com', department: 'Legal', companyId: 'c2', locationId: 'l4', status: 'Resigned', resignDate: '2026-03-28' },
]

export const departments = [
  'Engineering',
  'Finance',
  'HR',
  'Marketing',
  'Operations',
  'Sales',
  'IT',
  'Legal',
  'Admin',
]

