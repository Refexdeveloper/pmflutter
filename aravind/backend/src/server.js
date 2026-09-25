import { createServer } from 'node:http'
import { db, rowToProject, rowToSubtask, rowToTask } from './db.js'
import { projectInsights, subtaskInsights, taskInsights } from './insights.js'

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    return {}
  }
}

const PORT = Number(process.env.PORT || 8787)

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function applyFilters(rows, url) {
  const company = url.searchParams.get('company') || ''
  const lob = url.searchParams.get('lineOfBusiness') || ''
  const q = (url.searchParams.get('q') || '').toLowerCase()
  return rows.filter((row) => {
    if (company && String(row.companyName || '') !== company) return false
    if (lob && String(row.lineOfBusiness || '') !== lob) return false
    if (q) {
      const hay = Object.values(row).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

function allProjects() {
  return db.prepare('SELECT * FROM projects ORDER BY name').all().map(rowToProject)
}
function allTasks() {
  return db.prepare('SELECT * FROM tasks ORDER BY name').all().map(rowToTask)
}
function allSubtasks() {
  return db.prepare('SELECT * FROM subtasks ORDER BY name').all().map(rowToSubtask)
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`)

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, { ok: true, service: 'pm-tracker' })
    }
    if (req.method === 'GET' && url.pathname === '/api/me') {
      const user = db.prepare('SELECT * FROM users LIMIT 1').get()
      return json(res, 200, {
        id: user.id,
        name: user.name,
        firstName: user.first_name,
        email: user.email,
        role: user.role,
      })
    }
    if (req.method === 'GET' && url.pathname === '/api/projects') {
      return json(res, 200, { items: applyFilters(allProjects(), url) })
    }
    if (req.method === 'GET' && url.pathname === '/api/tasks') {
      return json(res, 200, { items: applyFilters(allTasks(), url) })
    }
    if (req.method === 'GET' && url.pathname === '/api/subtasks') {
      return json(res, 200, { items: applyFilters(allSubtasks(), url) })
    }
    if (req.method === 'GET' && url.pathname === '/api/filters') {
      const projects = allProjects()
      return json(res, 200, {
        companies: [...new Set(projects.map((p) => p.companyName).filter(Boolean))].sort(),
        lineOfBusiness: [...new Set(projects.map((p) => p.lineOfBusiness).filter(Boolean))].sort(),
      })
    }
    if (req.method === 'GET' && url.pathname === '/api/insights') {
      const view = url.searchParams.get('view') || 'projects'
      if (view === 'tasks') return json(res, 200, taskInsights(applyFilters(allTasks(), url)))
      if (view === 'subtasks') return json(res, 200, subtaskInsights(applyFilters(allSubtasks(), url)))
      return json(res, 200, projectInsights(applyFilters(allProjects(), url)))
    }
    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
      const projects = applyFilters(allProjects(), url)
      const tasks = applyFilters(allTasks(), url)
      const subtasks = applyFilters(allSubtasks(), url)
      const taskCountByProject = new Map()
      const doneCountByProject = new Map()
      for (const task of tasks) {
        const key = task.projectId
        if (!key) continue
        taskCountByProject.set(key, (taskCountByProject.get(key) || 0) + 1)
        const done = /complete|closed|done/i.test(String(task.status || ''))
        if (done) doneCountByProject.set(key, (doneCountByProject.get(key) || 0) + 1)
      }
      const projectsWithCounts = projects.map((project) => ({
        ...project,
        totalTasks: taskCountByProject.get(project.id) || 0,
        completedTasks: doneCountByProject.get(project.id) || 0,
      }))
      const me = db.prepare('SELECT id, name, first_name AS firstName, email, role FROM users LIMIT 1').get()
      return json(res, 200, {
        me,
        projects: projectsWithCounts,
        tasks,
        subtasks,
        insights: {
          projects: projectInsights(projectsWithCounts),
          tasks: taskInsights(tasks),
          subtasks: subtaskInsights(subtasks),
        },
      })
    }

    if (req.method === 'POST' && url.pathname === '/api/projects') {
      const body = await readBody(req)
      const id = String(body.id || `PRJ-${Date.now()}`)
      db.prepare(`
        INSERT INTO projects (
          id, display_id, name, owner, owner_email, owner_avatar, business_owner, sponsor,
          company_name, line_of_business, function_type, department, priority,
          start_date, end_date, original_end_date, revised_end_date, progress, rag, health,
          status, delay_days, delay, created_at, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        body.displayId || id,
        body.name || 'Untitled project',
        body.owner || '',
        body.ownerEmail || '',
        body.ownerAvatar || '',
        body.businessOwner || '',
        body.sponsor || '',
        body.companyName || '',
        body.lineOfBusiness || '',
        body.functionType || '',
        body.department || '',
        body.priority || 'Medium',
        body.startDate || '',
        body.endDate || '',
        body.originalEndDate || body.endDate || '',
        body.revisedEndDate || body.endDate || '',
        Number(body.progress || 0),
        body.rag || 'Green',
        body.health || 'On Track',
        body.status || 'Active',
        Number(body.delayDays || 0),
        body.delay || 'On time',
        body.createdAt || new Date().toISOString().slice(0, 10),
        body.description || '',
      )
      return json(res, 201, rowToProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(id)))
    }

    if (req.method === 'POST' && url.pathname === '/api/tasks') {
      const body = await readBody(req)
      const id = String(body.id || `TSK-${Date.now()}`)
      db.prepare(`
        INSERT INTO tasks (
          id, business_id, name, status, priority, assignee, assignee_avatar, start_date, end_date,
          company_name, line_of_business, project_id, project_name, delay_days, delay, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        body.businessId || body.taskId || id,
        body.name || body.taskName || 'Untitled task',
        body.status || 'Open',
        body.priority || 'Medium',
        body.assignee || body.assignedTo || '',
        body.assigneeAvatar || '',
        body.startDate || '',
        body.endDate || '',
        body.companyName || '',
        body.lineOfBusiness || '',
        body.projectId || '',
        body.projectName || '',
        Number(body.delayDays || 0),
        body.delay || 'On time',
        body.createdAt || new Date().toISOString().slice(0, 10),
      )
      return json(res, 201, rowToTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)))
    }

    if (req.method === 'POST' && url.pathname === '/api/subtasks') {
      const body = await readBody(req)
      const id = String(body.id || `SUB-${Date.now()}`)
      db.prepare(`
        INSERT INTO subtasks (
          id, name, status, priority, assignee, parent_task_id, parent_task_name,
          project_id, project_name, start_date, end_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        body.name || body.taskName || 'Untitled subtask',
        body.status || 'Open',
        body.priority || 'Medium',
        body.assignee || body.assignedTo || '',
        body.parentTaskId || body.parentTaskBusinessId || '',
        body.parentTaskName || '',
        body.projectId || '',
        body.projectName || '',
        body.startDate || '',
        body.endDate || '',
        body.createdAt || new Date().toISOString().slice(0, 10),
      )
      return json(res, 201, rowToSubtask(db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id)))
    }

    json(res, 404, { error: 'Not found' })
  } catch (err) {
    json(res, 500, { error: err.message || 'Server error' })
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PM Tracker API http://localhost:${PORT}`)
})
