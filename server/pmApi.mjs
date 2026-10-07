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
import { isDirectoryAdminRole, trackerRoleFromDirectory } from '../src/lib/trackerRole.js'

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

function refexOneOrigin() {
  return String(process.env.REFEXONE_ORIGIN || 'https://refexone.com').replace(/\/$/, '')
}

function bearerToken(req, url) {
  const header = String(req.headers.authorization || '')
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return String(url.searchParams.get('token') || url.searchParams.get('iam_token') || '').trim()
}

function trackerRoleForSso(me, directoryPerson) {
  if (directoryPerson?.trackerRole) return directoryPerson.trackerRole
  const iamRole = me?.role || me?.directoryRole || ''
  if (isDirectoryAdminRole(iamRole)) return 'admin'
  const designation = me?.designation || me?.job_title || me?.title || ''
  return trackerRoleFromDirectory({ role: iamRole, designation })
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

  if (path === '/api/pm/sso/session' && method === 'GET') {
    const iamToken = bearerToken(req, url)
    if (!iamToken) {
      send(res, 401, { error: 'Refex One session is missing.' })
      return true
    }
    let meRes
    try {
      meRes = await fetch(`${refexOneOrigin()}/api/auth/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${iamToken}` },
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      send(res, 502, { error: 'Could not reach Refex One.' })
      return true
    }
    if (meRes.status === 401 || meRes.status === 403) {
      send(res, 401, { error: 'Refex One session expired.' })
      return true
    }
    if (!meRes.ok) {
      send(res, 502, { error: 'Refex One did not return a profile.' })
      return true
    }
    const me = await meRes.json()
    const email = String(me.email || '').trim().toLowerCase()
    if (!email) {
      send(res, 401, { error: 'Refex One profile has no email.' })
      return true
    }
    const directoryPerson = lookupDirectoryEmail(email)
    const trackerRole = trackerRoleForSso(me, directoryPerson)
    const person = publicPerson({
      email,
      name: me.name || me.full_name || directoryPerson?.name || email,
      designation: directoryPerson?.designation || me.designation || me.job_title || '',
      directoryRole: directoryPerson?.directoryRole || me.role || '',
      department: directoryPerson?.department || me.department || '',
      company: directoryPerson?.company || '',
      trackerRole,
      roleOverride: directoryPerson?.roleOverride || '',
    })
    const token = randomBytes(24).toString('hex')
    sessions.set(token, { email, role: trackerRole, at: Date.now() })
    send(res, 200, { token, person })
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
