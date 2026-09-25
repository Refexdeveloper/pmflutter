import { chromium, firefox, webkit, devices } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, 'playwright-output', 'responsive')
mkdirSync(OUT, { recursive: true })

const BASE = process.env.PM_PROBE_URL || 'http://localhost:3000/'
const EMAIL = 'aravind.srinivasan@refex.co.in'
const OVERFLOW_PX = 24

const ENGINES = [
  { name: 'chromium', factory: chromium },
  { name: 'firefox', factory: firefox },
  { name: 'webkit', factory: webkit },
]

const PROFILES = [
  { engine: 'chromium', device: 'iPhone SE', kind: 'phone' },
  { engine: 'chromium', device: 'iPhone 14', kind: 'phone' },
  { engine: 'chromium', device: 'Pixel 7', kind: 'phone' },
  { engine: 'chromium', device: 'iPad Mini', kind: 'tablet' },
  { engine: 'chromium', device: 'iPad Pro 11', kind: 'tablet' },
  {
    engine: 'chromium',
    label: 'desktop-1280',
    kind: 'desktop',
    viewport: { width: 1280, height: 800 },
  },
  {
    engine: 'chromium',
    label: 'desktop-1920',
    kind: 'desktop',
    viewport: { width: 1920, height: 1080 },
  },
  {
    engine: 'firefox',
    label: 'firefox-1440',
    kind: 'desktop',
    viewport: { width: 1440, height: 900 },
  },
  {
    engine: 'firefox',
    label: 'firefox-tablet',
    kind: 'tablet',
    viewport: { width: 820, height: 1180 },
    isMobile: true,
    hasTouch: true,
  },
  { engine: 'webkit', device: 'iPhone 14', kind: 'phone' },
  {
    engine: 'webkit',
    label: 'safari-1440',
    kind: 'desktop',
    viewport: { width: 1440, height: 900 },
  },
]

function nowIso() {
  return new Date().toISOString()
}

function slug(value) {
  return String(value || 'view').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-')
}

function contextOptions(profile) {
  if (profile.device) {
    const preset = devices[profile.device]
    if (!preset) throw new Error(`Unknown Playwright device: ${profile.device}`)
    return { ...preset }
  }
  return {
    viewport: profile.viewport,
    isMobile: Boolean(profile.isMobile),
    hasTouch: Boolean(profile.hasTouch),
  }
}

function profileName(profile) {
  return slug(profile.label || profile.device || `${profile.engine}-${profile.kind}`)
}

async function measureLayout(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.rootDiv') || document.documentElement
    const vw = window.innerWidth
    const vh = window.innerHeight
    const overflowX = Math.max(0, (root.scrollWidth || 0) - (root.clientWidth || vw))
    const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || ''
    const buttons = [...document.querySelectorAll('button, [role="button"], a, input, select')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh
      })
      .slice(0, 80)
    const smallTaps = buttons
      .map((el) => {
        const r = el.getBoundingClientRect()
        return {
          text: String(el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        }
      })
      .filter((b) => b.w > 0 && b.h > 0 && (b.h < 32 || b.w < 32))
      .slice(0, 8)
    const clipped = []
    const nodes = document.querySelectorAll('h1, h2, header, nav, form, table, [data-testid]')
    for (const el of nodes) {
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      if (r.right > vw + 8 || r.left < -8) {
        clipped.push({
          testid: el.getAttribute('data-testid') || '',
          tag: el.tagName,
          right: Math.round(r.right),
          left: Math.round(r.left),
        })
      }
      if (clipped.length >= 8) break
    }
    return {
      vw,
      vh,
      overflowX,
      viewportMeta,
      hasRoot: Boolean(document.querySelector('.rootDiv')),
      smallTaps,
      clipped,
      title: document.querySelector('h1')?.textContent?.trim() || '',
    }
  })
}

async function shot(page, name) {
  const file = join(OUT, `${name}.png`)
  await page.screenshot({ path: file })
  return file
}

async function waitHidden(page, pattern, timeout = 8000) {
  await page.getByText(pattern).first().waitFor({ state: 'hidden', timeout }).catch(() => null)
}

async function signIn(page, role) {
  const gate = page.getByTestId('pm-non-kf-identity-form')
  await gate.waitFor({ timeout: 25000 })
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="pm-non-kf-email"]')
    return el && !el.disabled
  }, null, { timeout: 45000 })
  const search = page.getByTestId('pm-non-kf-email')
  await search.fill(EMAIL)
  const option = page.getByTestId(`pm-login-user-${EMAIL}`)
  await option.waitFor({ timeout: 15000 })
  await option.click()
  await page.getByTestId('pm-login-selected').waitFor({ timeout: 8000 })
  const roleButton = page.getByRole('button', {
    name: role === 'pm' ? /^Project Manager\b/ : /^Employee\b/,
  })
  if (await roleButton.count()) await roleButton.click()
  await page.getByTestId('pm-non-kf-continue').click()
  await page.getByTestId('pm-standalone-banner').waitFor({ timeout: 25000 })
}

async function visitAndCheck(page, report, profile, surface, action) {
  const started = Date.now()
  const name = `${profile.engine}-${profileName(profile)}-${surface}`
  try {
    if (action) await action()
    await page.waitForTimeout(700)
    await waitHidden(page, /Loading (projects|tasks|subtasks)/i)
    const layout = await measureLayout(page)
    await shot(page, name)
    const issues = []
    if (layout.overflowX > OVERFLOW_PX) {
      issues.push(`horizontal overflow ${layout.overflowX}px`)
    }
    if (!/width=device-width/i.test(layout.viewportMeta)) {
      issues.push('missing device-width viewport meta')
    }
    const result = {
      surface,
      ok: issues.length === 0,
      ms: Date.now() - started,
      layout,
      issues,
      shot: name,
    }
    report.surfaces.push({ profile: profileName(profile), engine: profile.engine, kind: profile.kind, ...result })
    for (const text of issues) {
      report.issues.push({ kind: 'layout', profile: name, text })
    }
    return result
  } catch (error) {
    const text = error?.message || String(error)
    report.surfaces.push({
      profile: profileName(profile),
      engine: profile.engine,
      kind: profile.kind,
      surface,
      ok: false,
      ms: Date.now() - started,
      error: text,
    })
    report.issues.push({ kind: 'step.failed', profile: name, text })
    await shot(page, `fail-${name}`).catch(() => null)
    return null
  }
}

async function runProfile(browser, profile, report) {
  const context = await browser.newContext({
    ...contextOptions(profile),
    ignoreHTTPSErrors: true,
  })
  await context.addInitScript(() => {
    try {
      sessionStorage.removeItem('pm_external_identity')
      localStorage.removeItem('iam_user')
      localStorage.removeItem('iam_token')
    } catch {
      /* ignore */
    }
  })
  const page = await context.newPage()
  page.setDefaultTimeout(20000)
  page.on('pageerror', (err) => {
    report.issues.push({
      kind: 'pageerror',
      profile: profileName(profile),
      text: String(err),
    })
  })

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(800)
  await visitAndCheck(page, report, profile, 'login', async () => {
    await page.getByTestId('pm-non-kf-identity-form').waitFor({ timeout: 25000 })
  })

  await signIn(page, 'employee')
  await visitAndCheck(page, report, profile, 'employee-projects', async () => {
    const tab = page.getByTestId('pm-tab-projects')
    if (await tab.count()) await tab.click()
  })
  await visitAndCheck(page, report, profile, 'employee-tasks', async () => {
    await page.getByTestId('pm-tab-tasks').click()
  })

  if (profile.kind !== 'desktop') {
    await visitAndCheck(page, report, profile, 'employee-task-form', async () => {
      const create = page.getByRole('button', { name: 'Create task' }).first()
      await create.waitFor({ timeout: 12000 })
      await create.click()
      await page.getByRole('heading', { name: 'Task Details' }).waitFor({ timeout: 10000 })
    })
    await page.keyboard.press('Escape').catch(() => null)
    await page.getByRole('button', { name: 'Close' }).first().click().catch(() => null)
    await page.waitForTimeout(400)
  }

  await visitAndCheck(page, report, profile, 'employee-subtasks', async () => {
    await page.getByTestId('pm-tab-subtasks').click({ force: true })
  })

  const role = page.getByTestId('pm-role-switch')
  if (await role.count()) {
    await role.selectOption('pm')
    await page.waitForTimeout(1200)
  }
  await visitAndCheck(page, report, profile, 'pm-home', async () => {
    const home = page.getByTestId('pm-tab-home')
    if (await home.count()) await home.click()
  })
  if (await page.getByTestId('pm-tab-admin').count()) {
    await visitAndCheck(page, report, profile, 'pm-admin', async () => {
      await page.getByTestId('pm-tab-admin').click()
    })
  }

  await context.close()
}

async function launchEngine(engine) {
  try {
    const browser = await engine.factory.launch({ headless: true })
    return { name: engine.name, browser }
  } catch (error) {
    return { name: engine.name, error: error?.message || String(error) }
  }
}

async function main() {
  const report = {
    startedAt: nowIso(),
    base: BASE,
    overflowThresholdPx: OVERFLOW_PX,
    skippedEngines: [],
    surfaces: [],
    issues: [],
  }

  const launched = {}
  for (const engine of ENGINES) {
    const result = await launchEngine(engine)
    if (result.browser) launched[engine.name] = result.browser
    else report.skippedEngines.push({ engine: engine.name, reason: result.error })
  }

  try {
    for (const profile of PROFILES) {
      const browser = launched[profile.engine]
      if (!browser) {
        report.skippedEngines.push({
          engine: profile.engine,
          profile: profileName(profile),
          reason: 'engine not available',
        })
        continue
      }
      if (profile.device && !devices[profile.device]) {
        report.issues.push({
          kind: 'config',
          text: `Unknown device ${profile.device}`,
        })
        continue
      }
      try {
        await runProfile(browser, profile, report)
      } catch (error) {
        report.issues.push({
          kind: 'profile.failed',
          profile: profileName(profile),
          text: error?.message || String(error),
        })
      }
    }
  } finally {
    await Promise.all(Object.values(launched).map((browser) => browser.close().catch(() => null)))
  }

  report.finishedAt = nowIso()
  report.failedSurfaces = report.surfaces.filter((s) => !s.ok).map((s) => `${s.engine}:${s.profile}:${s.surface}`)
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))

  const summary = {
    ok: report.failedSurfaces.length === 0 && !report.issues.some((i) => i.kind === 'pageerror' || i.kind === 'profile.failed'),
    surfaces: report.surfaces.length,
    failed: report.failedSurfaces,
    skippedEngines: report.skippedEngines,
    issues: report.issues.slice(0, 40),
    out: OUT,
  }
  console.log(JSON.stringify(summary, null, 2))
  if (!summary.ok) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
