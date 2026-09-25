import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, 'playwright-output')
mkdirSync(OUT, { recursive: true })

const BASE = process.env.PM_PROBE_URL || 'http://localhost:3000/'
const EMAIL = 'playwright.probe@refex.co.in'
const NAME = 'Playwright Probe'

function nowIso() {
  return new Date().toISOString()
}

async function shot(page, name) {
  const file = join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function fillByLabel(page, label, value) {
  const field = page.getByLabel(label, { exact: false }).first()
  await field.waitFor({ state: 'visible', timeout: 8000 })
  await field.fill(value)
}

async function selectByLabel(page, label, value) {
  const field = page.getByLabel(label, { exact: false }).locator('select').first()
  if (await field.count()) {
    await field.selectOption(value)
    return
  }
  await page.getByLabel(label, { exact: false }).first().selectOption(value)
}

async function visibleText(page) {
  return page.locator('body').innerText()
}

async function main() {
  const report = {
    startedAt: nowIso(),
    base: BASE,
    issues: [],
    console: [],
    pageErrors: [],
    httpErrors: [],
    http429: [],
    steps: [],
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  page.on('console', (msg) => {
    const entry = { type: msg.type(), text: msg.text(), at: nowIso() }
    report.console.push(entry)
    if (['error', 'warning'].includes(msg.type())) {
      report.issues.push({ kind: `console.${msg.type()}`, text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    report.pageErrors.push({ text: String(err), at: nowIso() })
    report.issues.push({ kind: 'pageerror', text: String(err) })
  })
  page.on('response', (res) => {
    const status = res.status()
    const url = res.url()
    if (status >= 400) {
      const item = { status, url, at: nowIso() }
      report.httpErrors.push(item)
      if (status === 429) report.http429.push(item)
      report.issues.push({ kind: `http.${status}`, text: `${status} ${url}` })
    }
  })

  const step = async (name, fn) => {
    const started = Date.now()
    try {
      const detail = await fn()
      report.steps.push({ name, ok: true, ms: Date.now() - started, detail })
      return detail
    } catch (error) {
      const text = error?.message || String(error)
      report.steps.push({ name, ok: false, ms: Date.now() - started, error: text })
      report.issues.push({ kind: 'step.failed', text: `${name}: ${text}` })
      await shot(page, `fail-${name.replace(/\W+/g, '-')}`).catch(() => null)
      throw error
    }
  }

  try {
    await step('open-app', async () => {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(1500)
      await shot(page, '01-open')
      return { title: await page.title(), url: page.url() }
    })

    await step('identity-gate', async () => {
      const gate = page.getByTestId('pm-non-kf-identity-form')
      if (await gate.count()) {
        await page.getByTestId('pm-non-kf-email').fill(EMAIL)
        await page.getByTestId('pm-non-kf-name').fill(NAME)
        const pmBtn = page.getByRole('button', { name: 'Project Manager' })
        if (await pmBtn.count()) await pmBtn.click()
        await page.getByTestId('pm-non-kf-continue').click()
        await page.waitForTimeout(4000)
      }
      await shot(page, '02-after-identity')
      const banner = page.getByTestId('pm-standalone-banner')
      const text = await visibleText(page)
      return {
        hasGate: (await gate.count()) > 0,
        hasBanner: (await banner.count()) > 0,
        banner: (await banner.count()) ? await banner.innerText() : '',
        hasKissflowAssignedError: /Kissflow Assigned To is required/i.test(text),
        hasRateLimitError: /rate-limited|Kissflow is busy/i.test(text),
      }
    })

    await step('landing-state', async () => {
      await page.waitForTimeout(4000)
      await shot(page, '03-landing')
      const text = await visibleText(page)
      return {
        url: page.url(),
        hasQuickCreate: (await page.getByLabel(/Quick create/i).count()) > 0,
        hasCreateTask: (await page.getByRole('button', { name: /Create Task/i }).count()) > 0,
        snippet: text.slice(0, 1200),
      }
    })

    await step('open-task-form', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('pm-open-task-details', { detail: {} }))
      })
      await page.getByRole('heading', { name: 'Task Details' }).waitFor({ timeout: 10000 })
      await shot(page, '04-task-form')
      return { opened: true, via: 'pm-open-task-details' }
    })

    await step('submit-task-non-kf-assignee', async () => {
      await fillByLabel(page, 'Task Name', 'Playwright probe task')
      await selectByLabel(page, 'Task Priority', 'Medium')
      const dates = page.locator('input[type="date"]')
      await dates.nth(0).fill('2026-09-10')
      await dates.nth(1).fill('2026-09-20')
      await fillByLabel(page, 'Assigned To', EMAIL)
      await shot(page, '05-task-filled')
      await page.getByRole('button', { name: 'Submit' }).click()
      await page.waitForTimeout(2000)
      const waiting = page.getByRole('button', { name: /Waiting for Kissflow/i })
      if (await waiting.count()) {
        await waiting.first().waitFor({ state: 'hidden', timeout: 120000 }).catch(() => null)
      }
      await page.waitForTimeout(1500)
      await shot(page, '06-task-after-submit')
      const text = await visibleText(page)
      const errorBox = page.locator('p.text-red-700, [role="alert"], .bg-red-50')
      const errors = []
      for (const el of await errorBox.all()) {
        if (await el.isVisible()) errors.push((await el.innerText()).trim())
      }
      return {
        stillOpen: (await page.getByRole('heading', { name: 'Task Details' }).count()) > 0,
        errors: errors.filter(Boolean),
        hasKissflowAssignedError: /Kissflow Assigned To is required|Type a Kissflow/i.test(text),
        hasRateLimitError: /rate-limited|Kissflow is busy|HTTP 429/i.test(text),
        webhook: await page.evaluate(() => window.__pmLastCreateWebhook || null),
      }
    })

    if (await page.getByRole('heading', { name: 'Task Details' }).count()) {
      await page.getByRole('button', { name: 'Close' }).first().click().catch(async () => {
        await page.keyboard.press('Escape')
      })
      await page.waitForTimeout(500)
    }

    await step('open-project-form', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('pm-open-project-details', { detail: {} }))
      })
      await page.getByRole('heading', { name: 'Project Details' }).waitFor({ timeout: 10000 })
      await shot(page, '07-project-form')
      return { opened: true }
    })

    await step('submit-project-non-kf-owner', async () => {
      await fillByLabel(page, 'Project Name', 'Playwright probe project')
      await selectByLabel(page, 'Functions', 'Information Technology')
      const dates = page.locator('form input[type="date"]')
      await dates.nth(0).fill('2026-09-10')
      await dates.nth(1).fill('2026-12-31')
      await fillByLabel(page, 'Business Owner', EMAIL)
      await selectByLabel(page, 'Governance Frequency', 'Monthly')
      await shot(page, '08-project-filled')
      await page.getByRole('button', { name: 'Submit' }).click()
      const waiting = page.getByRole('button', { name: /Waiting for Kissflow/i })
      if (await waiting.count()) {
        await waiting.first().waitFor({ state: 'hidden', timeout: 120000 }).catch(() => null)
      }
      await page.waitForTimeout(1500)
      await shot(page, '09-project-after-submit')
      const text = await visibleText(page)
      const errorBox = page.locator('p.text-red-700, [role="alert"], .bg-red-50')
      const errors = []
      for (const el of await errorBox.all()) {
        if (await el.isVisible()) errors.push((await el.innerText()).trim())
      }
      return {
        stillOpen: (await page.getByRole('heading', { name: 'Project Details' }).count()) > 0,
        errors: errors.filter(Boolean),
        hasKissflowAssignedError: /Kissflow Assigned To is required|Type a Kissflow/i.test(text),
        hasRateLimitError: /rate-limited|Kissflow is busy|HTTP 429/i.test(text),
        webhook: await page.evaluate(() => window.__pmLastCreateWebhook || null),
      }
    })
  } catch (error) {
    report.fatal = error?.message || String(error)
  }

  report.finishedAt = nowIso()
  report.http429Count = report.http429.length
  report.issueCount = report.issues.length
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({
    fatal: report.fatal || null,
    steps: report.steps,
    issueCount: report.issues.length,
    http429Count: report.http429.length,
    uniqueIssues: [...new Set(report.issues.map((i) => `${i.kind}: ${i.text}`))].slice(0, 40),
    out: OUT,
  }, null, 2))

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
