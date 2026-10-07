import { readFileSync } from 'node:fs'

const email = 'itsm.test@refex.co.in'
const stamp = Date.now()
const names = {
  project: `ITSM test project ${stamp}`,
  task: `ITSM test task ${stamp}`,
  subtask: `ITSM test subtask ${stamp}`,
}

function envValue(name) {
  const text = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const line = text.split(/\r?\n/).find((row) => row.startsWith(`${name}=`))
  return line ? line.slice(name.length + 1).trim() : ''
}

const webhookUrl = envValue('PM_CREATE_WEBHOOK_URL') || envValue('VITE_PM_CREATE_WEBHOOK_URL')

const submittedAt = new Date().toISOString()
const assigneeText = {
  Assignee_Name: 'itsm.test',
  Assignee_Email: email,
  Assignee_Email_Extracted: email,
  Requester_Email: email,
  Requester_Name: 'itsm.test',
  Created_by_flat_field_email: email,
}

const bodies = {
  project: {
    source: 'project',
    project: {
      Project_Name: names.project,
      Name: names.project,
      Project_Category: 'Information Technology',
      Project_Status: 'Planning',
      Priority_1: 'High',
      Start_Date: '2026-10-05',
      End_Date: '2026-12-31',
      Governance_Frequency: 'Monthly',
      Business_Owner_Name: 'itsm.test',
      Business_Owner_Email: email,
      ...assigneeText,
      Submitted_At: submittedAt,
    },
    task: null,
    subtask: null,
  },
  task: {
    source: 'task',
    project: null,
    task: {
      Sub_Task_Name: names.task,
      Task_Priority: 'High',
      Start_Date: '2026-10-05',
      End_Date: '2026-10-12',
      Task_Status: 'Open',
      Task_type: 'Development',
      Is_Dependent_on_another_Task: false,
      ...assigneeText,
      Submitted_At: submittedAt,
    },
    subtask: null,
  },
  subtask: {
    source: 'subtask',
    project: null,
    task: null,
    subtask: {
      Sub_task_Name: names.subtask,
      Sub_task_Priority: 'Medium',
      TStatus: 'Open',
      Start_Date: '2026-10-05',
      End_Date: '2026-10-12',
      Dependent_ON: false,
      Assignee: email,
      ...assigneeText,
      Submitted_At: submittedAt,
    },
  },
}

async function postWebhook(source) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(bodies[source]),
  })
  const data = await res.json().catch(() => ({}))
  return {
    source,
    status: res.status,
    message: data.en_message || data.message || data.status || '',
    id: data._id || data.instance_id || data.InstanceID || '',
    keys: Object.keys(data).slice(0, 12),
  }
}

async function liveGet(path) {
  const res = await fetch(`http://localhost:3000/kf-live${path}`, {
    headers: { Accept: 'application/json' },
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

function rowsOf(payload) {
  return payload.Data || payload.data || []
}

async function findCreated() {
  const found = { project: null, task: null, subtask: null }
  const projects = await liveGet('/case/2/AcCMptlq60zH/Project_Management_A01/list?page_number=1&page_size=20')
  for (const row of rowsOf(projects.data)) {
    const name = row.Project_Name || row.Name || ''
    if (String(name).includes(String(stamp))) {
      found.project = { id: row._id, name, status: projects.status }
    }
  }
  const tasks = await liveGet('/process/2/AcCMptlq60zH/admin/Project_Sub_Task_A01/item?page_number=1&page_size=15&_application_id=Project_Management_Tracker_A00')
  for (const row of rowsOf(tasks.data)) {
    if (String(row.Sub_Task_Name || '').includes(String(stamp))) {
      found.task = {
        id: row._id,
        name: row.Sub_Task_Name,
        assigneeEmail: row.Assignee_Email || row.externalemail || '',
        requesterEmail: row.Requester_Email || row.Created_by_flat_field_email || '',
        assignedTo: row.Assigned_To ? row.Assigned_To._id || 'object' : null,
        status: row._status || row.Task_Status || '',
      }
    }
  }
  const subtasks = await liveGet('/process/2/AcCMptlq60zH/admin/Sub_Task_Process_A00/item?page_number=1&page_size=15&_application_id=Project_Management_Tracker_A00')
  for (const row of rowsOf(subtasks.data)) {
    if (String(row.Sub_task_Name || row.Sub_Task_Name || '').includes(String(stamp))) {
      found.subtask = {
        id: row._id,
        name: row.Sub_task_Name || row.Sub_Task_Name,
        assigneeEmail: row.Assignee_Email || '',
        requesterEmail: row.Requester_Email || '',
        assignee: row.Assignee_1 ? row.Assignee_1._id || 'object' : null,
        status: row._status || row.TStatus || '',
      }
    }
  }
  return {
    found,
    listStatus: { projects: projects.status, tasks: tasks.status, subtasks: subtasks.status },
    listError: {
      projects: projects.data.en_message || '',
      tasks: tasks.data.en_message || '',
      subtasks: subtasks.data.en_message || '',
    },
  }
}

const posts = []
for (const source of ['project', 'task', 'subtask']) {
  posts.push(await postWebhook(source))
}
await new Promise((resolve) => setTimeout(resolve, 20000))
const check = await findCreated()
console.log(JSON.stringify({ stamp, names, posts, ...check }, null, 2))
