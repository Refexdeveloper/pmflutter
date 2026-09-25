import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, 'playwright-output')
mkdirSync(OUT, { recursive: true })

const BASE = process.env.PM_PROBE_URL || 'http://localhost:3000/'
const EMAIL = 'aravind.srinivasan@refex.co.in'

function classify(url) {
  const u = String(url || '')
  if (!/\/(process|process-report|case|case-report|user)\//.test(u)) return null
  if (u.includes('/kf-live/')) return 'live'
  if (u.includes('AcCMptp3yqcn') || u.includes('development-refexgroup')) return 'dev'
  return 'other'
}

async function ensureEmployeeWorkspace(page) {
  const roleSwitch = page.getByTestId('pm-role-switch')
  if (await roleSwitch.count()) {
    await roleSwitch.selectOption('employee').catch(() => null)
  }
  await page.getByTestId('pm-tab-projects').waitFor({ timeout: 20000 })
}

async function login(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForSelector(
    '[data-testid="pm-non-kf-identity-form"], [data-testid="pm-tracker-nav"]',
    { timeout: 45000 },
  )
  const gate = page.getByTestId('pm-non-kf-identity-form')
  if (await gate.count()) {
    const search = page.getByTestId('pm-non-kf-email')
    await search.waitFor({ timeout: 15000 })
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="pm-non-kf-email"]')
      return el && !el.disabled
    }, null, { timeout: 45000 })
    await search.fill(EMAIL)
    const option = page.getByTestId(`pm-login-user-${EMAIL}`)
    await option.waitFor({ timeout: 20000 })
    await option.click()
    const emp = page.getByRole('button', { name: /^Employee\b/ })
    if (await emp.count()) await emp.click()
    await page.getByTestId('pm-non-kf-continue').click()
  }
  await page.getByTestId('pm-tracker-nav').waitFor({ timeout: 20000 })
  await ensureEmployeeWorkspace(page)
}

async function main() {
  const report = {
    startedAt: new Date().toISOString(),
    base: BASE,
    pages: [],
    http: [],
    issues: [],
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.addInitScript(() => {
    try {
      sessionStorage.removeItem('pm_external_identity')
      localStorage.removeItem('iam_user')
      localStorage.removeItem('iam_token')
    } catch {
      /* ignore */
    }
  })

  page.on('response', (res) => {
    const url = res.url()
    const kind = classify(url)
    if (!kind) return
    const row = { status: res.status(), kind, url }
    report.http.push(row)
    if (res.status() >= 400) {
      report.issues.push({ kind: `http.${res.status()}`, text: `${res.status()} ${kind} ${url}` })
    }
  })

  try {
    await login(page)
    await page.screenshot({ path: join(OUT, 'api-00-home.png'), fullPage: true })

    for (const id of ['projects', 'tasks', 'subtasks']) {
      await page.getByTestId(`pm-tab-${id}`).click()
      await page.waitForTimeout(4000)
      await page.getByText(/Loading/i).first().waitFor({ state: 'hidden', timeout: 20000 }).catch(() => null)
      const body = await page.locator('body').innerText()
      const failedLoad = /Failed to load|not authorized|HTTP 401|HTTP 403/i.test(body)
      const empty = /No (projects|tasks|subtasks) found|0 tasks found|No tasks/i.test(body)
      report.pages.push({
        id,
        failedLoad,
        emptyHint: empty,
        showsLoginEmail: body.toLowerCase().includes(EMAIL.toLowerCase()),
        snippet: body.replace(/\s+/g, ' ').slice(0, 320),
      })
      await page.screenshot({ path: join(OUT, `api-${id}.png`), fullPage: true })
    }
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '')
    report.issues.push({
      kind: 'run.failed',
      text: error?.message || String(error),
      snippet: body.replace(/\s+/g, ' ').slice(0, 400),
    })
    await page.screenshot({ path: join(OUT, 'api-fail.png'), fullPage: true }).catch(() => null)
  }

  await browser.close()

  const devFails = report.http.filter((h) => h.kind === 'dev' && h.status >= 400)
  const liveOk = report.http.filter((h) => h.kind === 'live' && h.status < 400)
  const liveFail = report.http.filter((h) => h.kind === 'live' && h.status >= 400)
  const emailFiltered = report.http.filter((h) => {
    try {
      return decodeURIComponent(h.url).toLowerCase().includes(EMAIL.toLowerCase())
    } catch {
      return h.url.toLowerCase().includes(EMAIL.toLowerCase())
    }
  })

  report.summary = {
    devFailCount: devFails.length,
    liveOkCount: liveOk.length,
    liveFailCount: liveFail.length,
    pagesFailedLoad: report.pages.filter((p) => p.failedLoad).map((p) => p.id),
    pagesMissingEmail: report.pages.filter((p) => !p.showsLoginEmail).map((p) => p.id),
    emailFilteredApiCount: emailFiltered.length,
  }

  if (report.summary.pagesMissingEmail.length) {
    report.issues.push({
      kind: 'ui.email',
      text: `Login email not shown on: ${report.summary.pagesMissingEmail.join(', ')}`,
    })
  }

  if (devFails.length) {
    report.issues.push({
      kind: 'dev.unauthorized',
      text: `${devFails.length} development list APIs still failed`,
    })
  }
  if (!liveOk.length) {
    report.issues.push({ kind: 'live.missing', text: 'No successful /kf-live list reads' })
  }

  const outFile = join(OUT, 'dashboard-apis.json')
  writeFileSync(outFile, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ ok: report.issues.length === 0, ...report.summary, issues: report.issues }, null, 2))
  if (report.issues.length) process.exitCode = 1
}

main()
