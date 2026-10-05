import { chromium } from 'playwright'

const BASE = 'http://localhost:3000/'
const EMAIL = 'aravind.srinivasan@refex.co.in'
const http = []

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.addInitScript(() => {
  try {
    sessionStorage.removeItem('pm_external_identity')
    localStorage.removeItem('iam_user')
    localStorage.removeItem('iam_token')
  } catch { /* ignore */ }
})
page.on('response', async (res) => {
  const url = res.url()
  if (!/localhost:3000\/(kf-|process|case|user)/.test(url)) return
  if (res.status() < 400 && !/list|item|report/.test(url)) return
  if (res.status() < 400) {
    http.push({ status: res.status(), url: url.replace('http://localhost:3000', '').split('?')[0] })
    return
  }
  let body = ''
  try { body = (await res.text()).slice(0, 160) } catch { body = '' }
  http.push({ status: res.status(), url: url.replace('http://localhost:3000', '').slice(0, 180), body: body.replace(/\s+/g, ' ') })
})

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForSelector('[data-testid="pm-non-kf-identity-form"], [data-testid="pm-tracker-nav"]', { timeout: 45000 })
const gate = page.getByTestId('pm-non-kf-identity-form')
if (await gate.count()) {
  const search = page.getByTestId('pm-non-kf-email')
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="pm-non-kf-email"]')
    return el && !el.disabled
  }, null, { timeout: 45000 })
  await search.fill(EMAIL)
  await page.getByTestId(`pm-login-user-${EMAIL}`).click()
  const emp = page.getByRole('button', { name: /^Employee\b/ })
  if (await emp.count()) await emp.click()
  await page.getByTestId('pm-non-kf-continue').click()
}
await page.getByTestId('pm-tracker-nav').waitFor({ timeout: 25000 })

for (const id of ['projects', 'tasks', 'subtasks']) {
  await page.getByTestId(`pm-tab-${id}`).click()
  await page.waitForTimeout(5000)
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400)
  const create = await page.getByRole('button', { name: /Create (task|project|sub)/i }).count()
  console.log('PAGE', id, 'createButtons', create)
  console.log(text)
  console.log('---')
}
const fails = http.filter((item) => item.status >= 400)
const ok = http.filter((item) => item.status < 400)
console.log('FAILS', fails.length)
for (const item of fails.slice(0, 20)) console.log(item.status, item.url, item.body || '')
console.log('OK_PATHS')
for (const item of [...new Set(ok.map((item) => item.status + ' ' + item.url))].slice(0, 30)) console.log(item)
await browser.close()
