#!/usr/bin/env node
/**
 * Upload extension zip via Playwright file chooser (system Chromium).
 * Updates an existing Chrome Web Store item when CHROME_EXTENSION_ITEM_ID is set.
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

if (!fs.existsSync(zipPath)) {
  console.error(`Zip not found: ${zipPath}\nRun: npm run extension:package`)
  process.exit(1)
}

const packageUrl = `https://chrome.google.com/webstore/devconsole/${publisherId}/${itemId}/edit/package`

const browser = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: { width: 1400, height: 900 },
})

const page = browser.pages()[0] || (await browser.newPage())
await page.goto(packageUrl, { waitUntil: 'domcontentloaded' })

for (let i = 0; i < 120; i++) {
  const url = page.url()
  if (url.includes('/edit/package') && !url.includes('accounts.google.com')) break
  await page.waitForTimeout(1000)
}

if (page.url().includes('accounts.google.com')) {
  console.error('Not logged in to Chrome Web Store in Playwright profile.')
  console.error('Sign in in the opened browser window, then re-run: npm run extension:upload')
  await browser.close()
  process.exit(1)
}

const uploadBtn = page.getByRole('button', { name: /upload new package/i })
await uploadBtn.waitFor({ timeout: 15000 })
const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 })
await uploadBtn.click()
const fileChooser = await fileChooserPromise
await fileChooser.setFiles(zipPath)

console.log(`Uploading ${path.basename(zipPath)}…`)
await page.waitForTimeout(12000)

const bodyText = await page.locator('body').innerText()
const versionMatch = bodyText.match(new RegExp(`Version\\s+${manifest.version.replace('.', '\\.')}`, 'i'))
console.log('Current URL:', page.url())
console.log(versionMatch ? `✓ Draft shows v${manifest.version}` : `Check dashboard for v${manifest.version} in Draft section`)

const storeUrl = `https://chromewebstore.google.com/detail/connect-intel/${itemId}`
console.log('\nExtension ID:', itemId)
console.log('Store URL:', storeUrl)
console.log('Dashboard:', packageUrl)

await browser.close()
