#!/usr/bin/env node
/**
 * One-time OAuth flow for Chrome Web Store API scope.
 * Opens browser; after consent prints refresh token for CHROME_WEB_STORE_REFRESH_TOKEN.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const PORT = 8787
const REDIRECT = `http://localhost:${PORT}/oauth/callback`
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore'

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

if (!clientId || !clientSecret) {
  console.error('Need GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env or .env.vercel.tmp')
  process.exit(1)
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  }).toString()

console.log('\nChrome Web Store OAuth')
console.log('======================')
console.log('Add this redirect URI to your Google Cloud OAuth Web client if missing:')
console.log(' ', REDIRECT)
console.log('\nOpening browser for consent…\n')

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/oauth/callback')) {
    res.writeHead(404)
    res.end('Not found')
    return
  }
  const url = new URL(req.url, REDIRECT)
  const code = url.searchParams.get('code')
  const err = url.searchParams.get('error')
  if (err) {
    res.writeHead(400, { 'Content-Type': 'text/html' })
    res.end(`<h1>OAuth error</h1><p>${err}</p>`)
    server.close()
    process.exit(1)
  }
  if (!code) {
    res.writeHead(400)
    res.end('Missing code')
    return
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT,
    grant_type: 'authorization_code',
  })
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body })
  const tokens = await tokenRes.json()

  res.writeHead(200, { 'Content-Type': 'text/html' })
  if (!tokenRes.ok) {
    res.end(`<h1>Token error</h1><pre>${JSON.stringify(tokens, null, 2)}</pre>`)
    server.close()
    process.exit(1)
  }

  res.end('<h1>Success</h1><p>You can close this tab. Check the terminal for your refresh token.</p>')
  server.close()

  console.log('Access token obtained.')
  if (tokens.refresh_token) {
    console.log('\nAdd to Vercel Production:\n')
    console.log(`CHROME_WEB_STORE_REFRESH_TOKEN=${tokens.refresh_token}`)
    console.log('\nThen run: node scripts/upload-chrome-extension.mjs')
  } else {
    console.log('\nNo new refresh_token (already authorized). Revoke at https://myaccount.google.com/permissions and retry, or use existing token.')
    console.log(JSON.stringify(tokens, null, 2))
  }
  process.exit(0)
})

server.listen(PORT, () => {
  try {
    execSync(`open "${authUrl}"`, { stdio: 'ignore' })
  } catch {
    console.log(authUrl)
  }
})

setTimeout(() => {
  console.error('Timed out waiting for OAuth callback (5 min).')
  server.close()
  process.exit(1)
}, 5 * 60 * 1000)
