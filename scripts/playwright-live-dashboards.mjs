import { chromium } from 'playwright'

const BASE = 'http://localhost:3000/'
const EMAIL = 'aravind.srinivasan@refex.co.in'

const httpErrors = []
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.addInitScript(() => {
  sessionStorage.removeItem('pm_external_identity')
  localStorage.removeItem('iam_user')
  localStorage.removeItem('iam_token')
})
page.on('response', async (res) => {
  if (res.status() < 400) return
  const url = res.url()
  if (!/localhost:3000\/(kf-|process|case|user)/.test(url)) return
  let body = ''
  try { body = (await res.text()).slice(0, 160) } catch { body = '' }
  httpErrors.push({ status: res.status(), url: url.replace('http://localhost:3000', '').split('?')[0], body: body.replace(/\s+/g, ' ') })
})

async function login() {
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
}

function summarizeErrors() {
  const map = new Map()
  for (const item of httpErrors) {
    const key = `${item.status} ${item.url}`
    map.set(key, (map.get(key) || 0) + 1)
  }
  return [...map.entries()].map(([key, count]) => `${count}x ${key}`)
}

try {
  await login()
  for (const id of ['projects', 'tasks', 'subtasks']) {
    httpErrors.length = 0
    await page.getByTestId(`pm-tab-${id}`).click()
    await page.waitForTimeout(5000)
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
    const rows = await page.locator('table:visible tbody tr').count()
    console.log('PAGE', id, 'rows', rows)
    console.log('SNIP', text.slice(0, 400))
    console.log('ERR', summarizeErrors().join(' | ') || 'none')
  }
} catch (error) {
  console.log('SCRIPT_ERROR', error?.message || error)
  process.exitCode = 1
} finally {
  await browser.close()
}
