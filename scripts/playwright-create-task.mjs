import { chromium } from 'playwright'

const BASE = 'http://localhost:3000/'
const EMAIL = 'playwright.probe@refex.co.in'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const http = []
page.on('response', (res) => {
  if (res.status() >= 400) http.push({ status: res.status(), url: res.url() })
})

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
if (await page.getByTestId('pm-non-kf-identity-form').count()) {
  await page.getByTestId('pm-non-kf-email').fill(EMAIL)
  await page.getByTestId('pm-non-kf-name').fill('Playwright Probe')
  await page.getByTestId('pm-non-kf-continue').click()
  await page.waitForTimeout(3000)
}
await page.waitForTimeout(2500)
await page.evaluate(() => window.dispatchEvent(new CustomEvent('pm-open-task-details', { detail: {} })))
await page.getByRole('heading', { name: 'Task Details' }).waitFor({ timeout: 10000 })
await page.getByLabel('Task Name', { exact: false }).first().fill('Live restore probe task')
await page.locator('label').filter({ hasText: 'Task Priority' }).locator('select').selectOption('Medium')
const dates = page.locator('input[type="date"]')
await dates.nth(0).fill('2026-09-10')
await dates.nth(1).fill('2026-09-20')
await page.getByLabel('Assigned To').first().fill(EMAIL)
await page.getByRole('button', { name: 'Submit' }).click()
await page.waitForTimeout(2000)
const waiting = page.getByRole('button', { name: /Waiting for Kissflow/i })
if (await waiting.count()) {
  await waiting.first().waitFor({ state: 'hidden', timeout: 45000 }).catch(() => null)
}
await page.waitForTimeout(1500)
const stillOpen = (await page.getByRole('heading', { name: 'Task Details' }).count()) > 0
const errors = []
for (const el of await page.locator('p.text-red-700, .bg-red-50').all()) {
  if (await el.isVisible()) errors.push((await el.innerText()).trim())
}
const webhook = await page.evaluate(() => window.__pmLastCreateWebhook || null)
console.log(JSON.stringify({
  stillOpen,
  errors,
  webhookInstance: webhook?.payload?.task?._id || webhook?.payload?.task?.InstanceID || null,
  http4xx: http.filter((x) => /process\/2\/|case\/2\/|integration\/2\//.test(x.url)).slice(0, 12),
}, null, 2))
await browser.close()
