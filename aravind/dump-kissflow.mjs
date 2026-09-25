/**
 * Pull full project / task / subtask lists from Kissflow into aravind/data.
 * Uses parent .env access keys. Does not print secrets.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const REPO = join(ROOT, '..')
const DATA = join(ROOT, 'data')

const CASE_ID = 'Project_Management_A01'
const TASK_PROCESS = 'Project_Sub_Task_A01'
const SUBTASK_PROCESS = 'Sub_Task_Process_A00'
const PAGE_SIZE = 500

function loadEnv(filePath) {
  const out = {}
  let text = ''
  try {
    text = readFileSync(filePath, 'utf8')
  } catch {
    return out
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function extractRows(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.Data)) return payload.Data
  if (Array.isArray(payload.data?.Data)) return payload.data.Data
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.items)) return payload.items
  return []
}

function mergeUnique(target, batch, idOf) {
  const seen = new Set(target.map((row) => idOf(row)).filter(Boolean))
  for (const row of batch) {
    const id = idOf(row)
    if (id && seen.has(id)) continue
    if (id) seen.add(id)
    target.push(row)
  }
}

function rowId(row) {
  return String(row?._item_id || row?._id || row?.Id || '').trim()
}

async function kfGet(origin, headers, path) {
  const url = `${origin}${path}`
  const res = await fetch(url, { method: 'GET', headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data?.en_message || data?.message || `HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    err.path = path
    throw err
  }
  return data
}

async function fetchAllPages(origin, headers, buildPath) {
  const rows = []
  for (let page = 1; page <= 200; page += 1) {
    const payload = await kfGet(origin, headers, buildPath(page))
    const batch = extractRows(payload)
    if (!batch.length) break
    mergeUnique(rows, batch, rowId)
    if (batch.length < PAGE_SIZE) break
    await new Promise((r) => setTimeout(r, 120))
  }
  return rows
}

function unique(values) {
  return [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))]
}

function pickTenants(env) {
  const tenants = []
  const liveAccounts = unique([
    env.VITE_KF_LIVE_ACCOUNT_ID,
    'AcCMptp3yqcn',
    'AcCMptlq60zH',
  ])
  const devAccounts = unique([
    env.VITE_KF_ACCOUNT_ID,
    'AcCMptp3yqcn',
    'AcCMptlq60zH',
  ])

  if (env.VITE_KF_LIVE_ACCESS_KEY_ID && env.VITE_KF_LIVE_ACCESS_KEY_SECRET) {
    for (const accountId of liveAccounts) {
      tenants.push({
        name: `live:${accountId}`,
        origin: env.VITE_KF_LIVE_API_ORIGIN || env.VITE_KF_BASE_URL || 'https://refexgroup.kissflow.com',
        accountId,
        accessKeyId: env.VITE_KF_LIVE_ACCESS_KEY_ID,
        accessKeySecret: env.VITE_KF_LIVE_ACCESS_KEY_SECRET,
      })
    }
  }
  if (env.VITE_KF_ACCESS_KEY_ID && env.VITE_KF_ACCESS_KEY_SECRET) {
    for (const accountId of devAccounts) {
      tenants.push({
        name: `dev:${accountId}`,
        origin: env.VITE_KF_API_ORIGIN || 'https://development-refexgroup.kissflow.com',
        accountId,
        accessKeyId: env.VITE_KF_ACCESS_KEY_ID,
        accessKeySecret: env.VITE_KF_ACCESS_KEY_SECRET,
      })
    }
  }
  return tenants
}

async function dumpTenant(tenant) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Access-Key-Id': tenant.accessKeyId,
    'X-Access-Key-Secret': tenant.accessKeySecret,
  }
  const acc = tenant.accountId
  const log = (msg) => console.log(`[${tenant.name}] ${msg}`)

  log(`origin=${tenant.origin} account=${acc}`)

  let fields = []
  try {
    fields = await kfGet(tenant.origin, headers, `/case/2/${acc}/${CASE_ID}/fields`)
    if (!Array.isArray(fields)) fields = fields?.Data || []
    log(`project fields: ${fields.length}`)
  } catch (err) {
    log(`project fields failed: ${err.message}`)
  }

  const projects = []
  const projectPaths = [
    (page) => `/case/2/${acc}/${CASE_ID}/list?page_number=${page}&page_size=${PAGE_SIZE}`,
    (page) =>
      `/case/2/${acc}/${CASE_ID}/view/Project_Management_A01_all/list/items?page_number=${page}&page_size=100`,
    (page) => `/case-report/2/${acc}/${CASE_ID}/Your_Projects_A00?page_number=${page}&page_size=${PAGE_SIZE}`,
  ]
  for (const buildPath of projectPaths) {
    try {
      const batch = await fetchAllPages(tenant.origin, headers, buildPath)
      mergeUnique(projects, batch, rowId)
      if (projects.length) break
    } catch (err) {
      log(`project path failed: ${err.message}`)
    }
  }
  log(`projects: ${projects.length}`)

  const tasks = []
  const taskPaths = [
    (page) =>
      `/process/2/${acc}/admin/${TASK_PROCESS}/item?page_number=${page}&page_size=${PAGE_SIZE}&apply_preference=0`,
    (page) =>
      `/process/2/${acc}/admin/${TASK_PROCESS}/item?page_number=${page}&page_size=${PAGE_SIZE}&apply_preference=1`,
    (page) =>
      `/process/2/${acc}/${TASK_PROCESS}/myitems/all?page_number=${page}&page_size=${PAGE_SIZE}&apply_preference=true&skip_aggregation=true`,
    (page) =>
      `/process-report/2/${acc}/${TASK_PROCESS}/Live_Sub_Task_Task_Wise_A00?page_number=${page}&page_size=${PAGE_SIZE}`,
  ]
  for (const buildPath of taskPaths) {
    try {
      const batch = await fetchAllPages(tenant.origin, headers, buildPath)
      mergeUnique(tasks, batch, rowId)
      if (tasks.length) break
    } catch (err) {
      log(`task path failed: ${err.message}`)
    }
  }
  log(`tasks: ${tasks.length}`)

  const subtasks = []
  const subtaskPaths = [
    (page) =>
      `/process/2/${acc}/admin/${SUBTASK_PROCESS}/item?page_number=${page}&page_size=${PAGE_SIZE}&apply_preference=0`,
    (page) =>
      `/process/2/${acc}/admin/${SUBTASK_PROCESS}/item?page_number=${page}&page_size=${PAGE_SIZE}&apply_preference=1`,
    (page) =>
      `/process/2/${acc}/${SUBTASK_PROCESS}/myitems/all?page_number=${page}&page_size=${PAGE_SIZE}&apply_preference=true&skip_aggregation=true`,
  ]
  for (const buildPath of subtaskPaths) {
    try {
      const batch = await fetchAllPages(tenant.origin, headers, buildPath)
      mergeUnique(subtasks, batch, rowId)
      if (subtasks.length) break
    } catch (err) {
      log(`subtask path failed: ${err.message}`)
    }
  }
  log(`subtasks: ${subtasks.length}`)

  return {
    tenant: tenant.name,
    origin: tenant.origin,
    accountId: acc,
    fetchedAt: new Date().toISOString(),
    counts: {
      projectFields: Array.isArray(fields) ? fields.length : 0,
      projects: projects.length,
      tasks: tasks.length,
      subtasks: subtasks.length,
    },
    fields,
    projects,
    tasks,
    subtasks,
  }
}

function writeJson(name, value) {
  writeFileSync(join(DATA, name), JSON.stringify(value, null, 2), 'utf8')
  console.log(`wrote data/${name}`)
}

async function main() {
  mkdirSync(DATA, { recursive: true })
  const env = {
    ...loadEnv(join(REPO, '.env')),
    ...loadEnv(join(REPO, '.env.local')),
  }
  const tenants = pickTenants(env)
  if (!tenants.length) {
    throw new Error('No Kissflow access keys in .env (VITE_KF_LIVE_* or VITE_KF_*).')
  }

  let best = null
  const errors = []
  for (const tenant of tenants) {
    try {
      const dump = await dumpTenant(tenant)
      if (
        !best ||
        dump.counts.projects + dump.counts.tasks + dump.counts.subtasks >
          best.counts.projects + best.counts.tasks + best.counts.subtasks
      ) {
        best = dump
      }
      if (dump.counts.projects || dump.counts.tasks || dump.counts.subtasks) break
    } catch (err) {
      errors.push(`${tenant.name}: ${err.status || ''} ${err.message}`)
      console.warn(`[${tenant.name}] failed: ${err.message}`)
    }
  }

  if (!best) {
    throw new Error(`Kissflow dump failed. ${errors.join(' | ')}`)
  }

  writeJson('projects.raw.json', best.projects)
  writeJson('tasks.raw.json', best.tasks)
  writeJson('subtasks.raw.json', best.subtasks)
  writeJson('project-fields.json', best.fields)
  writeJson('snapshot.json', {
    tenant: best.tenant,
    origin: best.origin,
    accountId: best.accountId,
    fetchedAt: best.fetchedAt,
    counts: best.counts,
    errors,
  })
  console.log('dump complete', best.counts)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
