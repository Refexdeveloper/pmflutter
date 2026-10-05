import { readFileSync } from 'node:fs'

function envValue(name) {
  const text = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const line = text.split(/\r?\n/).find((row) => row.startsWith(`${name}=`))
  return line ? line.slice(name.length + 1).trim() : ''
}

const origin = envValue('VITE_KF_LIVE_API_ORIGIN')
const account = envValue('VITE_KF_LIVE_ACCOUNT_ID')
const headers = {
  Accept: 'application/json',
  'X-Access-Key-Id': envValue('VITE_KF_LIVE_ACCESS_KEY_ID'),
  'X-Access-Key-Secret': envValue('VITE_KF_LIVE_ACCESS_KEY_SECRET'),
}

async function get(path) {
  const res = await fetch(`${origin}${path}`, { headers })
  return res.json()
}

function person(value) {
  if (!value || typeof value !== 'object') return value || null
  return { id: value._id || '', name: value.Name || '', email: value.Email || '', kind: value.Kind || '' }
}

const task = await get(`/process/2/${account}/admin/Project_Sub_Task_A01/PkEJYCbe0gtR?_application_id=Project_Management_Tracker_A00`)
const sub = await get(`/process/2/${account}/admin/Sub_Task_Process_A00/PkEJYCcQeJk3?_application_id=Project_Management_Tracker_A00`)
const projects = await get(`/case/2/${account}/Project_Management_A01/list?page_number=1&page_size=30`)
const projectHit = (projects.Data || []).find((row) => String(row.Project_Name || row.Name || '').includes('1791195745574'))

console.log(JSON.stringify({
  task: {
    id: task._id,
    name: task.Sub_Task_Name,
    status: task.Task_Status,
    workflow: task._status,
    assignedTo: person(task.Assigned_To),
    assigneeEmail: task.Assignee_Email || '',
    extracted: task.Assignee_Email_Extracted || '',
    externalemail: task.externalemail || '',
  },
  subtask: {
    id: sub._id,
    name: sub.Sub_task_Name,
    status: sub.TStatus,
    workflow: sub._status,
    assignee1: person(sub.Assignee_1),
    assignee: sub.Assignee || '',
    assigneeEmail: sub.Assignee_Email || '',
    externalemail: sub.externalemail || '',
  },
  projectHit: projectHit ? { id: projectHit._id, name: projectHit.Project_Name || projectHit.Name } : null,
  newestProjects: (projects.Data || []).slice(0, 5).map((row) => row.Project_Name || row.Name),
}, null, 2))
