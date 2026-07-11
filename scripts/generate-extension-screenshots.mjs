#!/usr/bin/env node
/**
 * Capture 1280×800 Chrome Web Store screenshots from connectintel.net.
 * Output: extension/store/screenshots/01-home.png …
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../extension/store/screenshots')
const shots = [
  { name: '01-home.png', url: 'https://connectintel.net/', waitMs: 4000 },
  { name: '02-privacy.png', url: 'https://connectintel.net/privacy.html', waitMs: 2000 },
]

fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

for (const shot of shots) {
  await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForTimeout(shot.waitMs)
  const target = path.join(outDir, shot.name)
  await page.screenshot({ path: target, fullPage: false })
  console.log('✓', target)
}

await browser.close()
console.log('\nUpload these in CWS → Store listing → Screenshots (1280×800).')
