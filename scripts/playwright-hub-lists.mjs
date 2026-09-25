import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, 'playwright-output')
mkdirSync(OUT, { recursive: true })

const BASE = process.env.PM_PROBE_URL || 'http://localhost:3000/'
const EMAIL = 'aravind.srinivasan@refex.co.in'

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
  const roleSwitch = page.getByTestId('pm-role-switch')
  if (await roleSwitch.count()) {
    await roleSwitch.selectOption('employee').catch(() => null)
  }
}

async function waitListIdle(page) {
  await page.waitForTimeout(1200)
  await page.getByText(/Loading/i).first().waitFor({ state: 'hidden', timeout: 25000 }).catch(() => null)
  await page.waitForTimeout(800)
}

async function countVisibleRows(page) {
  const desktop = page.locator('table:visible tbody tr').filter({ hasNotText: /No (projects|tasks|subtasks)/i })
  const desktopCount = await desktop.count()
  if (desktopCount > 0) return desktopCount
  const cards = page.locator('div:visible.rounded-xl.border, div:visible.rounded-2xl.border').filter({ has: page.locator('p, span') })
  return cards.count()
}

async function main() {
  const report = { startedAt: new Date().toISOString(), base: BASE, pages: [], httpErrors: [], ok: false }
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
    if (!/\/(process|process-report|case|user)\//.test(url)) return
    if (res.status() >= 400) {
      report.httpErrors.push({ status: res.status(), url })
    }
  })

  try {
    await login(page)
    for (const id of ['projects', 'tasks', 'subtasks']) {
      await page.getByTestId(`pm-tab-${id}`).click()
      await waitListIdle(page)
      if (id === 'tasks' || id === 'subtasks') {
        const created = page.getByTestId('pm-task-scope-created').filter({ visible: true }).first()
        if (await created.count()) {
          await created.click()
          await page.waitForTimeout(800)
        }
        const openRows = await countVisibleRows(page)
        if (openRows === 0) {
          const closed = page.getByTestId('pm-task-status-closed').filter({ visible: true }).first()
          if (await closed.count()) {
            await closed.click()
            await page.waitForTimeout(800)
          }
        }
      }
      const body = await page.locator('body').innerText()
      const rows = await countVisibleRows(page)
      const empty = /No (projects|tasks|subtasks) found|0 tasks found/i.test(body) && rows === 0
      report.pages.push({
        id,
        rows,
        empty,
        snippet: body.replace(/\s+/g, ' ').slice(0, 280),
      })
      await page.screenshot({ path: join(OUT, `hub-${id}.png`), fullPage: true })
    }
  } catch (error) {
    report.error = error?.message || String(error)
    await page.screenshot({ path: join(OUT, 'hub-fail.png'), fullPage: true }).catch(() => null)
  }

  await browser.close()
  report.ok = !report.error && report.pages.length === 3 && report.pages.every((p) => p.rows > 0)
  writeFileSync(join(OUT, 'hub-lists.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exitCode = 1
}

main()
