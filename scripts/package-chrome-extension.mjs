#!/usr/bin/env node
/**
 * Package Connect Intel Chrome extension for Chrome Web Store upload.
 * Output: dist/connect-intel-chrome-extension-<version>.zip (manifest at zip root)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const extDir = path.join(root, 'extension')
const manifestPath = path.join(extDir, 'manifest.json')
const distDir = path.join(root, 'dist')

const REQUIRED = [
  'manifest.json',
  'background.js',
  'popup.html',
  'popup.js',
  'icons/icon-48.png',
  'icons/icon-128.png',
  'lib/api.js',
  'lib/runtime.js',
  'content/pageWidget.js',
]

function fail(msg) {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const version = manifest.version
if (!version) fail('manifest.json missing version')

for (const rel of REQUIRED) {
  const full = path.join(extDir, rel)
  if (!fs.existsSync(full)) fail(`Missing required file: extension/${rel}`)
}

const apiJs = fs.readFileSync(path.join(extDir, 'lib/api.js'), 'utf8')
if (/localhost|127\.0\.0\.1/.test(apiJs)) {
  fail('extension/lib/api.js must use production API_BASE for store builds')
}

fs.mkdirSync(distDir, { recursive: true })
const zipName = `connect-intel-chrome-extension-${version}.zip`
const zipPath = path.join(distDir, zipName)

if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)

execSync(`zip -r "${zipPath}" . -x "*.DS_Store" -x "README.md" -x "store/*"`, {
  cwd: extDir,
  stdio: 'inherit',
})

const stat = fs.statSync(zipPath)
console.log(`\n✓ Packaged Chrome extension v${version}`)
console.log(`  ${zipPath}`)
console.log(`  ${(stat.size / 1024).toFixed(1)} KB`)
console.log('\nUpload at: https://chrome.google.com/webstore/devconsole')
console.log('Guide: docs/CHROME_WEB_STORE.md')
