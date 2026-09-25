import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, 'playwright-output')
mkdirSync(OUT, { recursive: true })

const BASE = process.env.PM_PROBE_URL || 'http://localhost:3000/'
const EMAIL = 'aravind.srinivasan@refex.co.in'
const NAME = 'Aravind'
const STAMP = Date.now()
const TASK_NAME = `PW Task ${STAMP}`
const SUBTASK_NAME = `PW Subtask ${STAMP}`
const START = '2026-09-16'
const END = '2026-09-30'

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
  await field.waitFor({ state: 'visible', timeout: 12000 })
  await field.fill(value)
}

async function selectByLabel(page, label, value) {
  const wrapped = page.locator('label').filter({ hasText: label }).locator('select').first()
  if (await wrapped.count()) {
    await wrapped.selectOption(value)
    return
  }
  await page.getByLabel(label, { exact: false }).first().selectOption(value)
}

async function waitForSubmitIdle(page) {
  const waiting = page.getByRole('button', { name: /Waiting for Kissflow/i })
  if (await waiting.count()) {
    await waiting.first().waitFor({ state: 'hidden', timeout: 90000 }).catch(() => null)
  }
  await page.waitForTimeout(800)
}

async function formErrors(page) {
  const errors = []
  for (const el of await page.locator('p.text-red-700, [role="alert"], .bg-red-50').all()) {
    if (await el.isVisible()) errors.push((await el.innerText()).trim())
  }
  return errors.filter(Boolean)
}

async function visibleHeadings(page) {
  const texts = []
  for (const el of await page.locator('h1, h2, h3').all()) {
    const text = String((await el.innerText().catch(() => '')) || '').trim()
    if (text) texts.push(text)
  }
  return texts.slice(0, 24)
}

async function main() {
  const report = {
    startedAt: nowIso(),
    base: BASE,
    taskName: TASK_NAME,
    subtaskName: SUBTASK_NAME,
    dashboards: [],
    createPayloads: [],
    issues: [],
    httpErrors: [],
    steps: [],
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

  page.on('pageerror', (err) => {
    report.issues.push({ kind: 'pageerror', text: String(err) })
  })
  page.on('response', (res) => {
    const status = res.status()
    const url = res.url()
    if (status >= 400 && /\/(process|case|integration|admin)\//.test(url)) {
      report.httpErrors.push({ status, url })
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
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 })
      await page.waitForTimeout(1200)
      return { url: page.url() }
    })

    await step('identity-employee', async () => {
      const gate = page.getByTestId('pm-non-kf-identity-form')
      if (await gate.count()) {
        await shot(page, '00-login')
        const search = page.getByTestId('pm-non-kf-email')
        await search.waitFor({ timeout: 10000 })
        await page.getByTestId('pm-non-kf-continue').waitFor({ state: 'visible' })
        await search.waitFor({ state: 'visible' })
        await page.waitForFunction(() => {
          const el = document.querySelector('[data-testid="pm-non-kf-email"]')
          return el && !el.disabled
        }, null, { timeout: 45000 })
        await search.fill(EMAIL)
        const option = page.getByTestId(`pm-login-user-${EMAIL}`)
        await option.waitFor({ timeout: 15000 })
        await option.click()
        const emp = page.getByRole('button', { name: /^Employee\b/ })
        if (await emp.count()) await emp.click()
        await page.getByTestId('pm-non-kf-continue').click()
        await page.waitForTimeout(3500)
      }
      await shot(page, '01-employee-home')
      return { hasGate: (await gate.count()) > 0 }
    })

    const visitDashboard = async (id, shotName) => {
      const tab = page.getByTestId(`pm-tab-${id}`)
      if (await tab.count()) await tab.click()
      await page.waitForTimeout(1800)
      await page.getByText(/Loading (projects|tasks|subtasks)/i).first().waitFor({ state: 'hidden', timeout: 12000 }).catch(() => null)
      const headings = await visibleHeadings(page)
      const body = await page.locator('body').innerText()
      const dashboard = {
        id,
        headings,
        hasCreateTask: /Create task/i.test(body),
        hasCreateSubtask: /Create subtask/i.test(body),
        hasInsights: /Project Insights|Task Insights|All subtasks|All projects|All tasks/i.test(body),
      }
      report.dashboards.push(dashboard)
      await shot(page, shotName)
      return dashboard
    }

    await step('create-task', async () => {
      await page.getByTestId('pm-tab-tasks').click()
      await page.getByRole('button', { name: 'Create task' }).first().waitFor({ timeout: 15000 })
      await page.getByRole('button', { name: 'Create task' }).first().click()
      await page.getByRole('heading', { name: 'Task Details' }).waitFor({ timeout: 10000 })
      await fillByLabel(page, 'Task Name', TASK_NAME)
      await selectByLabel(page, 'Task Priority', 'High')
      const dates = page.locator('form input[type="date"]')
      await dates.nth(0).fill(START)
      await dates.nth(1).fill(END)
      await selectByLabel(page, 'Task type', 'New')
      await shot(page, '05-task-form')
      await page.getByRole('button', { name: 'Submit' }).click()
      await waitForSubmitIdle(page)
      const webhook = await page.evaluate(() => window.__pmLastCreateWebhook || null)
      report.createPayloads.push({ source: 'task', webhook })
      const stillOpen = (await page.getByRole('heading', { name: 'Task Details' }).count()) > 0
      const errors = await formErrors(page)
      if (stillOpen) {
        await page.getByRole('button', { name: 'Close' }).first().click().catch(() => page.keyboard.press('Escape'))
        await page.waitForTimeout(400)
      }
      const payload = webhook?.payload || {}
      const assigned = payload.task?.Assigned_To || payload.Assigned_To
      return {
        stillOpen,
        errors,
        source: payload.source,
        name: payload.task?.Sub_Task_Name || payload.Sub_Task_Name,
        assignedTo: assigned?.Email || assigned?.Name || assigned?._id,
        dates: [payload.task?.Start_Date || payload.Start_Date, payload.task?.End_Date || payload.End_Date],
      }
    })

    await step('task-on-dashboard', async () => {
      await page.getByTestId('pm-tab-tasks').click()
      await page.waitForTimeout(800)
      const found = page.getByText(TASK_NAME).first()
      await found.waitFor({ timeout: 15000 })
      await shot(page, '06-task-on-dashboard')
      const body = await page.locator('body').innerText()
      return { visible: body.includes(TASK_NAME), hasAravind: /Aravind/i.test(body) }
    })

    await step('create-subtask-from-task', async () => {
      await page.evaluate((detail) => {
        window.dispatchEvent(new CustomEvent('pm-open-subtask-details', { detail }))
      }, { taskId: TASK_NAME, taskName: TASK_NAME })
      await page.getByRole('heading', { name: 'Sub-Task' }).waitFor({ timeout: 10000 })
      await fillByLabel(page, 'Sub task Name', SUBTASK_NAME)
      await selectByLabel(page, 'Sub task Priority', 'Medium')
      const dates = page.locator('form input[type="date"]')
      await dates.nth(0).fill(START)
      await dates.nth(1).fill(END)
      await shot(page, '07-subtask-form')
      await page.getByRole('button', { name: 'Submit' }).click()
      await waitForSubmitIdle(page)
      const webhook = await page.evaluate(() => window.__pmLastCreateWebhook || null)
      report.createPayloads.push({ source: 'subtask', webhook })
      const stillOpen = (await page.getByRole('heading', { name: 'Sub-Task' }).count()) > 0
      const errors = await formErrors(page)
      if (stillOpen) {
        await page.getByRole('button', { name: 'Close' }).first().click().catch(() => page.keyboard.press('Escape'))
        await page.waitForTimeout(400)
      }
      await page.keyboard.press('Escape').catch(() => null)
      await page.locator('[role="presentation"]').waitFor({ state: 'hidden', timeout: 4000 }).catch(() => null)
      const payload = webhook?.payload || {}
      const bucket = payload.subtask || payload
      return {
        stillOpen,
        errors,
        source: payload.source,
        name: bucket.Sub_task_Name,
        assignee: bucket.Assignee_1?.Email || bucket.Assignee_1?.Name || bucket.Assignee_1?._id,
        dependentOn: bucket.Dependent_ON,
        dates: [bucket.Start_Date, bucket.End_Date],
      }
    })

    await step('subtask-on-dashboard', async () => {
      await page.keyboard.press('Escape').catch(() => null)
      await page.locator('[role="presentation"]').waitFor({ state: 'hidden', timeout: 4000 }).catch(() => null)
      await page.getByTestId('pm-tab-subtasks').click({ force: true })
      await page.waitForTimeout(1500)
      const found = page.getByText(SUBTASK_NAME).first()
      await found.waitFor({ timeout: 15000 })
      await shot(page, '08-subtask-on-dashboard')
      const body = await page.locator('body').innerText()
      return { visible: body.includes(SUBTASK_NAME), hasAravind: /Aravind/i.test(body) }
    })

    await step('dashboard-projects', () => visitDashboard('projects', '02-projects'))
    await step('dashboard-tasks', () => visitDashboard('tasks', '03-tasks'))
    await step('dashboard-subtasks', () => visitDashboard('subtasks', '04-subtasks'))

    await step('pm-dashboards', async () => {
      const role = page.getByTestId('pm-role-switch')
      if (await role.count()) {
        await role.selectOption('pm')
        await page.waitForTimeout(2500)
      }
      await shot(page, '09-pm-home')
      const home = {
        id: 'pm-home',
        headings: await visibleHeadings(page),
      }
      report.dashboards.push(home)
      if (await page.getByTestId('pm-tab-admin').count()) {
        await page.getByTestId('pm-tab-admin').click()
        await page.waitForTimeout(2500)
        await shot(page, '10-pm-admin')
        report.dashboards.push({
          id: 'pm-admin',
          headings: await visibleHeadings(page),
        })
      }
      return { switched: (await role.count()) > 0, dashboards: report.dashboards.map((d) => d.id) }
    })
  } catch (error) {
    report.fatal = error?.message || String(error)
  }

  const taskPayload = report.createPayloads.find((p) => p.source === 'task')?.webhook?.payload
  const subPayload = report.createPayloads.find((p) => p.source === 'subtask')?.webhook?.payload
  const formatIssues = []
  if (taskPayload) {
    const task = taskPayload.task || taskPayload
    if (task.Sub_Task_Name !== TASK_NAME) formatIssues.push('task missing Sub_Task_Name')
    if (!task.Assigned_To?.Email && !task.Assigned_To?.Name && !task.Assigned_To?._id) {
      formatIssues.push('task Assigned_To is not a user object')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(task.Start_Date || ''))) formatIssues.push('task Start_Date not YYYY-MM-DD')
    if (typeof task.Is_Dependent_on_another_Task !== 'boolean') formatIssues.push('task Is_Dependent_on_another_Task not boolean')
  } else {
    formatIssues.push('task webhook payload missing')
  }
  if (subPayload) {
    const sub = subPayload.subtask || subPayload
    if (sub.Sub_task_Name !== SUBTASK_NAME) formatIssues.push('subtask missing Sub_task_Name')
    if (!sub.Assignee_1?.Email && !sub.Assignee_1?.Name && !sub.Assignee_1?._id) {
      formatIssues.push('subtask Assignee_1 is not a user object')
    }
    if (typeof sub.Dependent_ON !== 'boolean') formatIssues.push('subtask Dependent_ON not boolean')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(sub.Start_Date || ''))) formatIssues.push('subtask Start_Date not YYYY-MM-DD')
  } else {
    formatIssues.push('subtask webhook payload missing')
  }
  for (const text of formatIssues) report.issues.push({ kind: 'payload.format', text })

  report.finishedAt = nowIso()
  report.failedSteps = report.steps.filter((s) => !s.ok).map((s) => s.name)
  writeFileSync(join(OUT, 'full-app-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({
    fatal: report.fatal || null,
    failedSteps: report.failedSteps,
    dashboards: report.dashboards.map((d) => ({ id: d.id, headings: d.headings?.slice(0, 8) })),
    formatIssues,
    httpErrors: report.httpErrors.slice(0, 20),
    steps: report.steps.map((s) => ({ name: s.name, ok: s.ok, ms: s.ms, error: s.error || null, detail: s.detail || null })),
    out: OUT,
  }, null, 2))

  await browser.close()
  if (report.fatal || report.failedSteps.length || formatIssues.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
