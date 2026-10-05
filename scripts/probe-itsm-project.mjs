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

const list = await fetch(`${origin}/case/2/${account}/Project_Management_A01/list?page_number=1&page_size=5`, { headers }).then((res) => res.json())
const row = (list.Data || []).find((item) => String(item.Project_Name || '').includes('ITSM test project 2026-10-05'))
const id = row?._id
const item = id
  ? await fetch(`${origin}/case/2/${account}/Project_Management_A01/${id}`, { headers }).then((res) => res.json())
  : {}

function person(value) {
  if (!value || typeof value !== 'object') return value ?? null
  return { id: value._id || '', name: value.Name || '', email: value.Email || '' }
}

const emails = {}
for (const [key, value] of Object.entries(item)) {
  const text = typeof value === 'string' ? value : ''
  if (text.includes('@') || /email|assign|owner|extern/i.test(key)) {
    emails[key] = value && typeof value === 'object' ? person(value) : value
  }
}
console.log(JSON.stringify({ listId: id, emails }, null, 2))
