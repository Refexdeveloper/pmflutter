import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, 'playwright-output')
mkdirSync(OUT, { recursive: true })

const BASE = process.env.PM_PROBE_URL || 'http://localhost:3000/'
const EMAIL = 'aravind.srinivasan@refex.co.in'

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

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.getByTestId('pm-non-kf-identity-form').waitFor({ timeout: 20000 })
await page.waitForFunction(() => {
  const el = document.querySelector('[data-testid="pm-non-kf-email"]')
  return el && !el.disabled
}, null, { timeout: 45000 })
await page.screenshot({ path: join(OUT, '00-login.png'), fullPage: true })

await page.getByTestId('pm-non-kf-email').fill(EMAIL)
await page.getByTestId(`pm-login-user-${EMAIL}`).waitFor({ timeout: 15000 })
await page.screenshot({ path: join(OUT, '00-login-search.png'), fullPage: true })
await page.getByTestId(`pm-login-user-${EMAIL}`).click()
await page.getByTestId('pm-login-selected').waitFor({ timeout: 8000 })
await page.screenshot({ path: join(OUT, '00-login-selected.png'), fullPage: true })

await page.getByRole('button', { name: /^Employee\b/ }).click()
await page.getByTestId('pm-non-kf-continue').click()
await page.getByTestId('pm-standalone-banner').waitFor({ timeout: 20000 })
await page.screenshot({ path: join(OUT, '00-login-signed-in.png'), fullPage: true })

const signedIn = await page.locator('body').innerText()
console.log(JSON.stringify({
  ok: /Signed in as aravind\.srinivasan@refex\.co\.in/i.test(signedIn) || /User Master/i.test(signedIn),
  banner: (await page.getByTestId('pm-standalone-banner').innerText().catch(() => '')),
  title: await page.getByRole('heading', { name: 'Project Management Tracker' }).count(),
}, null, 2))

await browser.close()
