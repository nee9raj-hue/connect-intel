#!/usr/bin/env node
/**
 * Upload Connect Intel extension zip to Chrome Web Store (new item or update).
 *
 * Requires (env or .env.vercel.tmp):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   CHROME_WEB_STORE_REFRESH_TOKEN  — OAuth refresh token with chromewebstore scope
 *
 * Usage:
 *   node scripts/upload-chrome-extension.mjs
 *   node scripts/upload-chrome-extension.mjs --publish
 *   node scripts/upload-chrome-extension.mjs --item-id=abcdefghijklmnop
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m || process.env[m[1]]) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    process.env[m[1]] = v
  }
}

loadEnvFile(path.join(root, '.env'))
loadEnvFile(path.join(root, '.env.vercel.tmp'))

const clientId = String(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim()
const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim()
const refreshToken = String(process.env.CHROME_WEB_STORE_REFRESH_TOKEN || '').trim()

const publish = process.argv.includes('--publish')
const itemIdArg = process.argv.find((a) => a.startsWith('--item-id='))
const itemId = itemIdArg ? itemIdArg.split('=')[1] : ''

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8'))
const zipPath = path.join(root, 'dist', `connect-intel-chrome-extension-${manifest.version}.zip`)

if (!clientId || !clientSecret) {
  console.error('Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET')
  process.exit(1)
}
if (!refreshToken) {
  console.error('Missing CHROME_WEB_STORE_REFRESH_TOKEN')
  console.error('Run: node scripts/chrome-webstore-oauth.mjs  (one-time, then add token to Vercel)')
  process.exit(1)
}
if (!fs.existsSync(zipPath)) {
  console.error(`Zip not found: ${zipPath}\nRun: npm run extension:package`)
  process.exit(1)
}

async function getAccessToken() {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || res.statusText)
  return data.access_token
}

async function uploadZip(token) {
  const url = itemId
    ? `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${itemId}`
    : 'https://www.googleapis.com/upload/chromewebstore/v1.1/items'

  const res = await fetch(url, {
    method: itemId ? 'PUT' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-goog-api-version': '2',
      'Content-Type': 'application/zip',
    },
    body: fs.readFileSync(zipPath),
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  if (!res.ok) throw new Error(JSON.stringify(data))
  return data
}

async function publishItem(token, id) {
  const res = await fetch(
    `https://www.googleapis.com/chromewebstore/v1.1/items/${id}/publish`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-goog-api-version': '2',
        'Content-Length': '0',
      },
    }
  )
  const text = await res.text()
  if (!res.ok) throw new Error(text || res.statusText)
  return text
}

const token = await getAccessToken()
console.log('Uploading', path.basename(zipPath), itemId ? `(update ${itemId})` : '(new item)…')
const result = await uploadZip(token)
const id = result.id || itemId
console.log('Upload OK:', JSON.stringify(result, null, 2))

if (id) {
  const storeUrl = `https://chromewebstore.google.com/detail/connect-intel/${id}`
  console.log('\nStore URL (draft):', storeUrl)
  console.log('Dashboard: https://chrome.google.com/webstore/devconsole')
}

if (publish && id) {
  await publishItem(token, id)
  console.log('Published for review.')
}
