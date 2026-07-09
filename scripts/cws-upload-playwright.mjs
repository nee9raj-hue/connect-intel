#!/usr/bin/env node
/**
 * Upload extension zip via Playwright file chooser (system Chromium).
 * Requires one-time login in the opened browser window if session is cold.
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const zipPath = '/tmp/connect-intel-chrome-extension-1.2.0.zip'
const profileDir = '/tmp/connect-intel-cws-profile'

const browser = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: { width: 1400, height: 900 },
})

const page = browser.pages()[0] || (await browser.newPage())
await page.goto('https://chrome.google.com/webstore/devconsole', { waitUntil: 'domcontentloaded' })

// Wait for dashboard (logged in) or login
for (let i = 0; i < 120; i++) {
  const url = page.url()
  if (url.includes('/webstore/devconsole') && !url.includes('accounts.google.com')) break
  await page.waitForTimeout(1000)
}

if (page.url().includes('accounts.google.com')) {
  console.error('Not logged in to Chrome Web Store in Playwright profile.')
  console.error('Sign in in the opened browser window, then re-run this script.')
  process.exit(1)
}

const addBtn = page.getByRole('button', { name: /add a new item/i })
await addBtn.click()

const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 })
await page.getByRole('button', { name: /select file/i }).click()
const fileChooser = await fileChooserPromise
await fileChooser.setFiles(zipPath)

console.log('File selected — waiting for upload…')
await page.waitForTimeout(8000)

const url = page.url()
console.log('Current URL:', url)

// Try to read extension id from URL
const m = url.match(/\/edit\/([a-z]{32})/i) || url.match(/\/items\/([a-z]{32})/i)
if (m) {
  const id = m[1]
  const storeUrl = `https://chromewebstore.google.com/detail/connect-intel/${id}`
  console.log('\nExtension ID:', id)
  console.log('Store URL:', storeUrl)
}

await browser.close()
