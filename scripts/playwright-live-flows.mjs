import { chromium } from 'playwright'

const BASE = 'http://localhost:3000/'
const EMAIL = 'aravind.srinivasan@refex.co.in'
const stamp = Date.now()

const report = { dashboards: {}, creates: {}, httpErrors: [], pending: [] }
const inflight = new Map()
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.addInitScript(() => {
  sessionStorage.removeItem('pm_external_identity')
  localStorage.removeItem('iam_user')
  localStorage.removeItem('iam_token')
})

page.on('request', (req) => {
  const url = req.url()
  if (!/localhost:3000\/(kf-|process|case|user|integration)/.test(url)) return
  inflight.set(req, { start: Date.now(), method: req.method(), url: url.replace('http://localhost:3000', '').slice(0, 160) })
})
page.on('requestfinished', (req) => inflight.delete(req))
page.on('requestfailed', (req) => inflight.delete(req))

page.on('response', async (res) => {
  if (res.status() < 400) return
  const url = res.url()
  if (!/localhost:3000\/(kf-|process|case|user|integration)/.test(url)) return
  report.httpErrors.push({
    status: res.status(),
    url: url.replace('http://localhost:3000', '').split('?')[0],
  })
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

async function bodyText() {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ')
}

async function selectFirst(dialog, label) {
  const field = dialog.getByLabel(label)
  const options = (await field.locator('option').allTextContents()).map((item) => item.trim()).filter(Boolean)
  if (options[0]) await field.selectOption({ label: options[0] })
  return options[0] || ''
}

async function closeDialog() {
  const close = page.getByRole('button', { name: 'Close' }).last()
  if (await close.count()) await close.click({ force: true }).catch(() => null)
  await page.keyboard.press('Escape').catch(() => null)
  await page.waitForTimeout(400)
}

async function fillAndSubmit(title, fill) {
  const dialog = page.locator('form').filter({ has: page.getByRole('heading', { name: title }) })
  await dialog.waitFor({ timeout: 15000 })
  await fill(dialog)
  await dialog.getByText(/will be sent as a Kissflow/i).waitFor({ timeout: 20000 }).catch(() => null)
  await dialog.getByRole('button', { name: 'Submit' }).click({ force: true })
  await page.waitForFunction((heading) => {
    const form = [...document.querySelectorAll('form')].find((node) => node.innerText.includes(heading))
    if (!form) return true
    return !/Waiting for Kissflow/.test(form.innerText)
  }, title, { timeout: 70000 }).catch(() => null)
  const text = await bodyText()
  const dialogText = await dialog.innerText().catch(() => '')
  const pending = [...inflight.values()].map((item) => ({
    pendingMs: Date.now() - item.start,
    method: item.method,
    url: item.url,
  }))
  await closeDialog()
  return {
    text,
    dialogText: dialogText.slice(-400),
    pending,
  }
}

try {
  await login()

  await page.getByTestId('pm-tab-projects').click()
  await page.waitForFunction(() => {
    const text = document.body.innerText
    const match = text.match(/TOTAL PROJECTS\s+(\d+)/i)
    return match && Number(match[1]) > 0
  }, null, { timeout: 45000 }).catch(() => null)
  const projectsText = await bodyText()
  const projectTotal = (projectsText.match(/TOTAL PROJECTS\s+(\d+)/i) || [])[1] || '0'
  report.dashboards.projects = { total: Number(projectTotal), rows: await page.locator('table:visible tbody tr').count() }

  await page.getByTestId('pm-tab-tasks').click()
  await page.waitForTimeout(4000)
  const tasksText = await bodyText()
  report.dashboards.tasks = {
    total: Number((tasksText.match(/TOTAL TASKS\s+(\d+)/i) || [])[1] || 0),
    rows: await page.locator('table:visible tbody tr').count(),
  }

  await page.getByTestId('pm-tab-subtasks').click()
  await page.waitForTimeout(4000)
  const subText = await bodyText()
  report.dashboards.subtasks = {
    rows: await page.locator('table:visible tbody tr').count(),
    hasCreate: /Create subtask/i.test(subText),
  }

  await page.getByTestId('pm-tab-projects').click({ force: true })
  await page.getByRole('button', { name: 'Create project' }).click({ force: true })
  const projectResult = await fillAndSubmit('Project Details', async (dialog) => {
    await dialog.getByLabel('Project Name').fill(`Live project ${stamp}`)
    await dialog.getByLabel('Functions').selectOption('Information Technology')
    await dialog.getByLabel('Start Date').fill('2026-10-01')
    await dialog.getByLabel('End Date').fill('2026-12-31')
    await dialog.getByLabel('Business Owner').fill(EMAIL)
    await page.getByText('Kissflow user').first().waitFor({ timeout: 20000 }).catch(() => null)
    await dialog.getByLabel('Governance Frequency').selectOption('Monthly')
  })
  report.creates.project = {
    ok: /Project created \(/i.test(projectResult.text),
    snippet: (projectResult.text.match(/Project created \([^)]+\)|Project sent[^.]+\.|Could not create[^.]+\.|does not exist[^.]+\./i) || [])[0] || projectResult.dialogText,
    pending: projectResult.pending,
  }

  await page.getByTestId('pm-tab-tasks').click({ force: true })
  await page.getByRole('button', { name: 'Create task' }).click({ force: true })
  const taskResult = await fillAndSubmit('Task Details', async (dialog) => {
    await dialog.getByLabel('Task Name').fill(`Live task ${stamp}`)
    await selectFirst(dialog, 'Task Priority')
    await dialog.getByLabel('Start Date').fill('2026-10-01')
    await dialog.getByLabel('End Date').fill('2026-10-07')
    await dialog.getByLabel('Assigned To').fill(EMAIL)
    await page.getByText('Kissflow user').first().waitFor({ timeout: 20000 }).catch(() => null)
  })
  report.creates.task = {
    ok: /Task draft created \(/i.test(taskResult.text),
    snippet: (taskResult.text.match(/Task draft created \([^)]+\)|Could not create[^.]+\.|does not exist[^.]+\./i) || [])[0] || taskResult.dialogText,
    pending: taskResult.pending,
  }

  await page.getByTestId('pm-tab-subtasks').click({ force: true })
  await page.getByRole('button', { name: 'Create subtask' }).click({ force: true })
  const subResult = await fillAndSubmit('Sub-Task', async (dialog) => {
    await dialog.getByLabel('Sub task Name').fill(`Live subtask ${stamp}`)
    await dialog.getByLabel('Assignee').fill(EMAIL)
    await page.getByText('Kissflow user').first().waitFor({ timeout: 20000 }).catch(() => null)
    await dialog.getByLabel('Start Date').fill('2026-10-01')
    await dialog.getByLabel('End Date').fill('2026-10-07')
  })
  report.creates.subtask = {
    ok: /Subtask draft created \(/i.test(subResult.text),
    snippet: (subResult.text.match(/Subtask draft created \([^)]+\)|Could not create[^.]+\.|does not exist[^.]+\./i) || [])[0] || subResult.dialogText,
    pending: subResult.pending,
  }
} catch (error) {
  report.error = error?.message || String(error)
  process.exitCode = 1
} finally {
  const uniqueErrors = [...new Set(report.httpErrors.map((item) => `${item.status} ${item.url}`))]
  report.httpErrors = uniqueErrors
  console.log(JSON.stringify(report, null, 2))
  await browser.close()
}
