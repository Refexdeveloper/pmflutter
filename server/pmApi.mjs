import { randomBytes } from 'node:crypto'
import {
  directoryStatus,
  ensureDirectoryReady,
  listDirectory,
  lookupDirectoryEmail,
  searchDirectory,
  setTrackerRoleOverride,
  startMorningSync,
  syncUserMaster,
} from './directoryStore.mjs'
import { createWebhookUrl } from './kfProxy.mjs'

const sessions = new Map()

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sessionFrom(req) {
  const header = String(req.headers.authorization || '')
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) return null
  return sessions.get(token) || null
}

function publicPerson(person) {
  if (!person) return null
  return {
    email: person.email,
    name: person.name,
    designation: person.designation,
    directoryRole: person.directoryRole,
    department: person.department,
    company: person.company,
    trackerRole: person.trackerRole,
    roleOverride: person.roleOverride || '',
  }
}

export { ensureDirectoryReady, startMorningSync }

export async function handlePmApi(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  const path = url.pathname
  const isSync = path === '/internal/sync-user-master'
  const isApi = path.startsWith('/api/pm')
  if (!isApi && !isSync) return false

  await ensureDirectoryReady()
  const method = String(req.method || 'GET').toUpperCase()

  if (isSync && method === 'POST') {
    const expected = String(process.env.PM_SYNC_TOKEN || '').trim()
    const provided = String(req.headers['x-sync-token'] || '').trim()
    const remote = String(req.socket?.remoteAddress || '')
    const local = remote === '127.0.0.1' || remote === '::1' || remote.endsWith('127.0.0.1')
    if (expected) {
      if (provided !== expected) {
        send(res, 401, { error: 'Sync token was rejected.' })
        return true
      }
    } else if (!local) {
      send(res, 401, { error: 'Set PM_SYNC_TOKEN before calling sync from outside this machine.' })
      return true
    }
    const saved = await syncUserMaster()
    send(res, 200, { ok: true, syncedAt: saved.syncedAt, count: saved.count })
    return true
  }

  if (path === '/api/pm/create-webhook' && method === 'POST') {
    const webhookUrl = createWebhookUrl()
    if (!webhookUrl) {
      send(res, 503, { error: 'Create webhook URL is not configured on the server.' })
      return true
    }
    const body = await readBody(req)
    let upstream
    try {
      upstream = await fetch(webhookUrl, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      })
    } catch {
      send(res, 502, { error: 'Create webhook request failed.' })
      return true
    }
    const text = await upstream.text()
    res.statusCode = upstream.status
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    res.end(text)
    return true
  }

  if (path === '/api/pm/health' && method === 'GET') {
    send(res, 200, directoryStatus())
    return true
  }

  if (path === '/api/pm/search' && method === 'GET') {
    const people = searchDirectory(url.searchParams.get('q') || '', url.searchParams.get('limit') || 8)
    send(res, 200, { people: people.map(publicPerson) })
    return true
  }

  if (path === '/api/pm/login' && method === 'POST') {
    const body = await readBody(req)
    const person = lookupDirectoryEmail(body.email)
    if (!person) {
      send(res, 404, { error: 'That email is not an active User Master profile.' })
      return true
    }
    const token = randomBytes(24).toString('hex')
    sessions.set(token, { email: person.email, role: person.trackerRole, at: Date.now() })
    send(res, 200, { token, person: publicPerson(person) })
    return true
  }

  if (path === '/api/pm/people' && method === 'GET') {
    const session = sessionFrom(req)
    if (!session || session.role !== 'admin') {
      send(res, 403, { error: 'Only an admin can view and edit tracker roles.' })
      return true
    }
    const people = listDirectory(url.searchParams.get('q') || '', 40)
    send(res, 200, { people: people.map(publicPerson) })
    return true
  }

  if (path === '/api/pm/people/role' && method === 'PUT') {
    const session = sessionFrom(req)
    if (!session || session.role !== 'admin') {
      send(res, 403, { error: 'Only an admin can edit tracker roles.' })
      return true
    }
    const body = await readBody(req)
    try {
      const person = await setTrackerRoleOverride(body.email, body.trackerRole)
      send(res, 200, { person: publicPerson(person) })
    } catch (error) {
      send(res, 400, { error: error?.message || 'Could not update the role.' })
    }
    return true
  }

  send(res, 404, { error: 'Not found' })
  return true
}
