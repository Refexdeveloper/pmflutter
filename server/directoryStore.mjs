/**
 * Refex One User Master snapshot + admin role overrides.
 * Sensitive columns (PAN, phone, date of birth) are never stored.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { trackerRoleFromDirectory } from '../src/lib/trackerRole.js'

const PAGE_SIZE = 100
const MAX_PAGES = 40

let snapshot = { syncedAt: '', count: 0, people: [] }
let overrides = {}
let ready = null
let dataDir = ''

function envValue(name) {
  return String(process.env[name] || '').trim()
}

export function directoryDataDir() {
  if (!dataDir) {
    dataDir = envValue('PM_DATA_DIR') || join(process.cwd(), 'data')
  }
  return dataDir
}

function snapshotPath() {
  return join(directoryDataDir(), 'user-master-snapshot.json')
}

function overridesPath() {
  return join(directoryDataDir(), 'tracker-role-overrides.json')
}

function readJson(path, fallback) {
  try {
    if (!existsSync(path)) return fallback
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value))
}

async function gcsAccessToken() {
  if (!envValue('PM_GCS_BUCKET')) return ''
  try {
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      { headers: { 'Metadata-Flavor': 'Google' } },
    )
    if (!res.ok) return ''
    const data = await res.json()
    return String(data.access_token || '')
  } catch {
    return ''
  }
}

async function pullFromGcs(name) {
  const bucket = envValue('PM_GCS_BUCKET')
  const token = await gcsAccessToken()
  if (!bucket || !token) return null
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(name)}?alt=media`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  return res.json()
}

async function mirrorToGcs(name, value) {
  const bucket = envValue('PM_GCS_BUCKET')
  const token = await gcsAccessToken()
  if (!bucket || !token) return
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(name)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  })
  if (!res.ok) console.warn(`Cloud Storage mirror failed for ${name}: HTTP ${res.status}`)
}

export function loadDotEnv(file = '.env') {
  try {
    const text = readFileSync(join(process.cwd(), file), 'utf8')
    text.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return
      const index = trimmed.indexOf('=')
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim()
      if (key && process.env[key] == null) process.env[key] = value
    })
  } catch {
    /* production uses real env vars */
  }
}

function slimPerson(row) {
  const email = String(row?.email || row?.work_email || '').trim().toLowerCase()
  const name = String(row?.full_name || row?.name || '').trim() || email
  if (!email || !name) return null
  const status = String(row?.status || '').trim().toLowerCase()
  if (status && status !== 'active') return null
  if (row?.date_of_exit) return null
  return {
    id: String(row?.id || '').trim(),
    email,
    name,
    designation: String(row?.designation || '').trim(),
    directoryRole: String(row?.role || '').trim(),
    department: String(row?.department || '').trim(),
    company: String(row?.company || '').trim(),
  }
}

function withTrackerRole(person) {
  const override = overrides[person.email] || ''
  return {
    ...person,
    trackerRole: trackerRoleFromDirectory(person, override),
    roleOverride: override === 'employee' || override === 'pm' ? override : '',
  }
}

function userMasterUrl() {
  return (envValue('VITE_USER_MASTER_URL') || 'https://refexone.com/api/v1/user-master').replace(/\/$/, '')
}

async function fetchUserMasterPage(page) {
  const token = envValue('USER_MASTER_TOKEN') || envValue('VITE_USER_MASTER_TOKEN')
  if (!token) throw new Error('User Master token is missing. Set USER_MASTER_TOKEN.')
  const url = `${userMasterUrl()}?status=all&page=${page}&page_size=${PAGE_SIZE}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`User Master HTTP ${res.status}`)
  const payload = await res.json()
  const users = Array.isArray(payload?.users)
    ? payload.users
    : Array.isArray(payload?.data)
      ? payload.data
      : []
  const total = Number(payload?.total ?? payload?.count ?? users.length) || users.length
  return { users, total }
}

export async function syncUserMaster() {
  const seen = new Set()
  const people = []
  let total = Infinity
  for (let page = 1; page <= MAX_PAGES && people.length < total; page += 1) {
    const batch = await fetchUserMasterPage(page)
    total = batch.total
    if (!batch.users.length) break
    batch.users.forEach((row) => {
      const person = slimPerson(row)
      if (!person || seen.has(person.email)) return
      seen.add(person.email)
      people.push(person)
    })
    if (batch.users.length >= total || batch.users.length > PAGE_SIZE) break
  }
  people.sort((a, b) => a.name.localeCompare(b.name))
  snapshot = { syncedAt: new Date().toISOString(), count: people.length, people }
  writeJson(snapshotPath(), snapshot)
  await mirrorToGcs('pm-tracker/user-master-snapshot.json', snapshot)
  console.info(`User Master sync saved ${people.length} people at ${snapshot.syncedAt}`)
  return snapshot
}

export async function ensureDirectoryReady() {
  if (!ready) {
    ready = (async () => {
      loadDotEnv()
      snapshot = readJson(snapshotPath(), snapshot)
      if (!Array.isArray(snapshot.people) || !snapshot.people.length) {
        const remoteSnapshot = await pullFromGcs('pm-tracker/user-master-snapshot.json')
        if (remoteSnapshot?.people?.length) snapshot = remoteSnapshot
      }
      if (!Array.isArray(snapshot.people)) snapshot = { syncedAt: '', count: 0, people: [] }
      overrides = readJson(overridesPath(), null)
      if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
        overrides = (await pullFromGcs('pm-tracker/tracker-role-overrides.json')) || {}
      }
      if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) overrides = {}
      const age = snapshot.syncedAt ? Date.now() - Date.parse(snapshot.syncedAt) : Infinity
      if (!snapshot.people.length || age > 20 * 60 * 60 * 1000) {
        try {
          await syncUserMaster()
        } catch (error) {
          console.warn('User Master sync skipped:', error?.message || error)
        }
      }
    })().catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}

export function directoryStatus() {
  const devId = envValue('KF_ACCESS_KEY_ID') || envValue('VITE_KF_DEV_ACCESS_KEY_ID') || envValue('VITE_KF_ACCESS_KEY_ID')
  const devSecret = envValue('KF_ACCESS_KEY_SECRET') || envValue('VITE_KF_DEV_ACCESS_KEY_SECRET') || envValue('VITE_KF_ACCESS_KEY_SECRET')
  const liveId = envValue('KF_LIVE_ACCESS_KEY_ID') || envValue('VITE_KF_LIVE_ACCESS_KEY_ID')
  const liveSecret = envValue('KF_LIVE_ACCESS_KEY_SECRET') || envValue('VITE_KF_LIVE_ACCESS_KEY_SECRET')
  return {
    ok: true,
    syncedAt: snapshot.syncedAt || null,
    count: snapshot.people.length,
    userMasterConfigured: Boolean(envValue('USER_MASTER_TOKEN') || envValue('VITE_USER_MASTER_TOKEN')),
    kissflowDevConfigured: Boolean(devId && devSecret),
    kissflowLiveConfigured: Boolean(liveId && liveSecret),
    webhookConfigured: Boolean(envValue('PM_CREATE_WEBHOOK_URL') || envValue('VITE_PM_CREATE_WEBHOOK_URL')),
    gcsBucketConfigured: Boolean(envValue('PM_GCS_BUCKET')),
  }
}

export function searchDirectory(query, limit = 8) {
  const needle = String(query || '').trim().toLowerCase()
  const max = Math.max(1, Math.min(25, Number(limit) || 8))
  if (!needle) return []
  const ranked = snapshot.people
    .filter((person) => {
      const hay = `${person.name} ${person.email} ${person.designation} ${person.department}`.toLowerCase()
      return hay.includes(needle)
    })
    .sort((a, b) => {
      const aEmail = a.email === needle || a.email.startsWith(needle) ? 0 : 1
      const bEmail = b.email === needle || b.email.startsWith(needle) ? 0 : 1
      return aEmail - bEmail || a.name.localeCompare(b.name)
    })
  return ranked.slice(0, max).map(withTrackerRole)
}

export function lookupDirectoryEmail(email) {
  const needle = String(email || '').trim().toLowerCase()
  if (!needle) return null
  const person = snapshot.people.find((row) => row.email === needle)
  return person ? withTrackerRole(person) : null
}

export function listDirectory(query, limit = 30) {
  return searchDirectory(query, limit)
}

export async function setTrackerRoleOverride(email, trackerRole) {
  const person = lookupDirectoryEmail(email)
  if (!person) throw new Error('That person is not in User Master.')
  if (person.trackerRole === 'admin' && !person.roleOverride) {
    throw new Error('User Master admins keep the Admin role.')
  }
  if (trackerRoleFromDirectory(person, '') === 'admin') {
    throw new Error('User Master admins keep the Admin role.')
  }
  const key = person.email
  if (trackerRole !== 'employee' && trackerRole !== 'pm') {
    throw new Error('Choose Employee or Project Manager.')
  }
  overrides[key] = trackerRole
  writeJson(overridesPath(), overrides)
  await mirrorToGcs('pm-tracker/tracker-role-overrides.json', overrides)
  return lookupDirectoryEmail(key)
}

export function msUntilNextMorningIst(hour = 6) {
  const now = new Date()
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000)
  const next = new Date(ist)
  next.setUTCHours(hour, 0, 0, 0)
  if (next <= ist) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime() - ist.getTime()
}

let morningTimer = null

export function startMorningSync() {
  if (morningTimer) return
  const schedule = () => {
    const wait = Math.max(1000, msUntilNextMorningIst(6))
    morningTimer = setTimeout(async () => {
      morningTimer = null
      try {
        await syncUserMaster()
      } catch (error) {
        console.warn('Morning User Master sync failed:', error?.message || error)
      }
      schedule()
    }, wait)
  }
  schedule()
}
