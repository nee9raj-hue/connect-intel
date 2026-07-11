#!/usr/bin/env node
/**
 * Upload latest extension zip and submit Chrome Web Store listing for review.
 * Uses persistent Chromium profile — sign in once when prompted.
 *
 *   npm run extension:package
 *   npm run extension:publish
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8'))
const zipPath = path.join(root, 'dist', `connect-intel-chrome-extension-${manifest.version}.zip`)
const profileDir = '/tmp/connect-intel-cws-profile'
const publisherId = process.env.CHROME_WEB_STORE_PUBLISHER_ID || '09468178-973b-4767-8214-20bc719d9f7c'
const itemId = process.env.CHROME_EXTENSION_ITEM_ID || 'bahhnjcdlpjoglipkjiamnobhikmdpkb'
const storeUrl = `https://chromewebstore.google.com/detail/connect-intel/${itemId}`

if (!fs.existsSync(zipPath)) {
  console.error(`Zip missing: ${zipPath}\nRun: npm run extension:package`)
  process.exit(1)
}

const packageUrl = `https://chrome.google.com/webstore/devconsole/${publisherId}/${itemId}/edit/package`
const distributionUrl = `https://chrome.google.com/webstore/devconsole/${publisherId}/${itemId}/edit/distribution`
const publishUrl = `https://chrome.google.com/webstore/devconsole/${publisherId}/${itemId}/publish`

async function waitForDashboard(page, timeoutMs = 180_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const url = page.url()
    if (url.includes('chromewebstore') && url.includes('/edit/') && !url.includes('accounts.google.com')) {
      return true
    }
    if (url.includes('accounts.google.com')) {
      console.log('→ Sign in to Google (invite@connectintel.net) in the browser window…')
    }
    await page.waitForTimeout(1500)
  }
  return false
}

const browser = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: { width: 1400, height: 900 },
})
const page = browser.pages()[0] || (await browser.newPage())

console.log(`\nConnect Intel Chrome Web Store publish — v${manifest.version}`)
console.log('Store URL:', storeUrl)

// 1) Upload package
console.log('\n[1/3] Upload package…')
await page.goto(packageUrl, { waitUntil: 'domcontentloaded' })
if (!(await waitForDashboard(page))) {
  console.error('Timed out waiting for CWS login.')
  await browser.close()
  process.exit(1)
}

try {
  const uploadBtn = page.getByRole('button', { name: /upload new package/i })
  await uploadBtn.waitFor({ timeout: 20_000 })
  const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15_000 })
  await uploadBtn.click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(zipPath)
  console.log('   Uploaded', path.basename(zipPath))
  await page.waitForTimeout(8000)
} catch (err) {
  console.warn('   Package upload skipped or failed:', err?.message || err)
}

// 2) Distribution → Public
console.log('\n[2/3] Set distribution to Public…')
await page.goto(distributionUrl, { waitUntil: 'domcontentloaded' })
await waitForDashboard(page, 60_000)
try {
  const publicRadio = page.getByLabel(/public/i).first()
  if (await publicRadio.isVisible({ timeout: 8000 }).catch(() => false)) {
    await publicRadio.check()
    const save = page.getByRole('button', { name: /save/i }).first()
    if (await save.isVisible({ timeout: 3000 }).catch(() => false)) {
      await save.click()
      await page.waitForTimeout(2000)
      console.log('   Distribution set to Public')
    }
  }
} catch (err) {
  console.warn('   Distribution step:', err?.message || err)
}

// 3) Submit for review
console.log('\n[3/3] Submit for review…')
await page.goto(publishUrl, { waitUntil: 'domcontentloaded' })
await waitForDashboard(page, 60_000)
await page.waitForTimeout(2000)

const body = await page.locator('body').innerText()
if (/in review|pending review|published/i.test(body)) {
  console.log('   Listing already submitted or published.')
} else {
  const submit = page.getByRole('button', { name: /submit for review|publish/i }).first()
  if (await submit.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await submit.click()
    await page.waitForTimeout(1500)
    const confirm = page.getByRole('button', { name: /submit|confirm|publish/i }).last()
    if (await confirm.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirm.click()
    }
    console.log('   Submitted for review.')
  } else {
    console.log('   Submit button not found — complete any red checklist items in the dashboard.')
  }
}

console.log('\nDone.')
console.log('Dashboard:', publishUrl)
console.log('After Google approves (1–3 days), users install from:', storeUrl)
console.log('App install button: Team → Integrations (already wired on connectintel.net)\n')

await page.waitForTimeout(3000)
await browser.close()
