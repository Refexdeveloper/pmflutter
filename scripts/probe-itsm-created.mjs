import { readFileSync } from 'node:fs'

const stamp = '1791195745574'

function envValue(name) {
  const text = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const line = text.split(/\r?\n/).find((row) => row.startsWith(`${name}=`))
  return line ? line.slice(name.length + 1).trim() : ''
}

const devOrigin = envValue('VITE_KF_DEV_API_ORIGIN')
const devAccount = envValue('VITE_KF_DEV_ACCOUNT_ID')
const liveOrigin = envValue('VITE_KF_LIVE_API_ORIGIN')
const liveAccount = envValue('VITE_KF_LIVE_ACCOUNT_ID')

async function get(origin, account, path, live) {
  const keyId = envValue(live ? 'VITE_KF_LIVE_ACCESS_KEY_ID' : 'VITE_KF_DEV_ACCESS_KEY_ID')
  const secret = envValue(live ? 'VITE_KF_LIVE_ACCESS_KEY_SECRET' : 'VITE_KF_DEV_ACCESS_KEY_SECRET')
  const res = await fetch(`${origin}${path.replaceAll('{account}', account)}`, {
    headers: {
      Accept: 'application/json',
      'X-Access-Key-Id': keyId,
      'X-Access-Key-Secret': secret,
    },
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

function summarize(label, payload) {
  const rows = payload.Data || payload.data || []
  return {
    label,
    count: payload.Count ?? rows.length,
    error: payload.en_message || '',
    newest: rows.slice(0, 3).map((row) => ({
      id: row._id,
      name: row.Project_Name || row.Name || row.Sub_Task_Name || row.Sub_task_Name || '',
      created: row._created_at || '',
    })),
    hit: rows.some((row) => JSON.stringify(row).includes(stamp)),
  }
}

const checks = []
for (const [label, origin, account, live] of [
  ['dev-project', devOrigin, devAccount, false],
  ['live-project', liveOrigin, liveAccount, true],
]) {
  const result = await get(origin, account, `/case/2/{account}/Project_Management_A01/list?page_number=1&page_size=20`, live)
  checks.push(summarize(label, result.data))
}
for (const [label, origin, account, live, processId] of [
  ['dev-task', devOrigin, devAccount, false, 'Project_Sub_Task_A01'],
  ['live-task', liveOrigin, liveAccount, true, 'Project_Sub_Task_A01'],
  ['dev-sub', devOrigin, devAccount, false, 'Sub_Task_Process_A00'],
  ['live-sub', liveOrigin, liveAccount, true, 'Sub_Task_Process_A00'],
]) {
  const result = await get(
    origin,
    account,
    `/process/2/{account}/admin/${processId}/item?page_number=1&page_size=15&_application_id=Project_Management_Tracker_A00`,
    live,
  )
  checks.push({ ...summarize(label, result.data), http: result.status })
}
console.log(JSON.stringify(checks, null, 2))
