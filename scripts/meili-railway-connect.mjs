#!/usr/bin/env node
/**
 * Redeploy Meilisearch on Railway and wire Vercel production env.
 *
 *   npx @railway/cli login
 *   npm run meili:railway
 *   npm run meili:railway -- --skip-vercel
 */

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MEILI_DIR = join(ROOT, 'infra/meilisearch')
const PROJECT_NAME = 'connect-intel-meili'
const PRODUCTION_URL = 'https://connectintel.net'
const skipVercel = process.argv.includes('--skip-vercel')

function run(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: opts.cwd || ROOT,
    encoding: 'utf8',
    stdio: opts.silent ? 'pipe' : 'inherit',
    ...opts,
  })
}

function runJson(cmd, opts = {}) {
  const out = run(cmd, { ...opts, silent: true })
  const trimmed = String(out || '').trim()
  return trimmed ? JSON.parse(trimmed) : null
}

function railway(args, { cwd = MEILI_DIR, json = false } = {}) {
  const cmd = `npx @railway/cli ${args}${json && !args.includes('--json') ? ' --json' : ''}`
  if (json) return runJson(cmd, { cwd })
  run(cmd, { cwd })
  return null
}

function loadCronSecret() {
  for (const file of ['.env.deploy.local', '.env.local']) {
    const path = join(ROOT, file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.startsWith('CRON_SECRET=')) continue
      let v = line.slice('CRON_SECRET='.length).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (v) return v
    }
  }
  return process.env.CRON_SECRET || ''
}

function ensureRailwayAuth() {
  try {
    const who = run('npx @railway/cli whoami', { silent: true }).trim()
    console.log(`Railway: ${who}`)
  } catch {
    console.error('Not logged in. Run: npx @railway/cli login')
    process.exit(1)
  }
}

async function waitForHealth(host, apiKey, timeoutMs = 120_000) {
  const base = host.replace(/\/$/, '')
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${base}/health`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) return true
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  return false
}

function parseEnvFile(path) {
  if (!existsSync(path)) return {}
  const vars = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq)
    let value = trimmed.slice(eq + 1)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (value) vars[key] = value
  }
  return vars
}

console.log('Connect Intel — Meilisearch Railway redeploy\n')
ensureRailwayAuth()

let linked = false
try {
  railway('status', { json: true })
  linked = true
  console.log('Using linked Railway project.')
} catch {
  console.log(`Linking Railway project "${PROJECT_NAME}" (or create in dashboard first)…`)
  try {
    railway(`link --project ${PROJECT_NAME}`)
    linked = true
  } catch {
    console.log(`
Could not auto-link. In Railway dashboard:
  1. New project → "${PROJECT_NAME}"
  2. Add service → Deploy from GitHub OR Empty → set root to infra/meilisearch
  3. Run: cd infra/meilisearch && npx @railway/cli link
  4. Re-run: npm run meili:railway
`)
    process.exit(1)
  }
}

console.log('\nDeploying Meilisearch from infra/meilisearch…')
const masterKey = randomBytes(32).toString('hex')
try {
  railway(`variables --set "MEILI_MASTER_KEY=${masterKey}"`)
} catch {
  console.warn('Could not set MEILI_MASTER_KEY via CLI — use Railway dashboard Variables.')
}

try {
  railway('up --detach')
} catch (error) {
  console.error('Deploy failed:', error?.message || error)
  console.log('Try restarting the existing service in Railway dashboard, then re-run.')
  process.exit(1)
}

let publicUrl = ''
try {
  const domain = railway('domain --json', { json: true })
  publicUrl = domain?.domain ? `https://${domain.domain}` : ''
} catch {
  publicUrl = 'https://meilisearch-production-00f3.up.railway.app'
  console.warn(`Using known URL: ${publicUrl} (set Railway public domain if different)`)
}

if (!publicUrl) {
  console.error('No public Railway URL. Add a domain in Railway → Networking.')
  process.exit(1)
}

console.log(`\nWaiting for ${publicUrl}/health …`)
const healthy = await waitForHealth(publicUrl, masterKey)
if (!healthy) {
  console.error('Meilisearch did not become healthy in time. Check Railway logs.')
  process.exit(1)
}
console.log('✓ Meilisearch healthy')

if (!skipVercel) {
  console.log('\nUpdating Vercel production env…')
  try {
    run(`vercel env rm MEILI_HOST production --yes`, { silent: true })
  } catch {
    /* may not exist */
  }
  try {
    run(`vercel env rm MEILI_API_KEY production --yes`, { silent: true })
  } catch {
    /* may not exist */
  }
  run(`vercel env add MEILI_HOST production --value "${publicUrl}" --yes`)
  run(`vercel env add MEILI_API_KEY production --value "${masterKey}" --yes --sensitive`)

  console.log('Redeploying Vercel production…')
  run('vercel deploy --prod --yes')
}

const cron = loadCronSecret()
if (cron) {
  console.log('\nTriggering production meili-sync…')
  const res = await fetch(`${PRODUCTION_URL}/api/infra/bootstrap?action=meili-sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cron}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orgId: 'org_7c9426b8-9506-4dbf-9e97-1872a4bd12bc' }),
    signal: AbortSignal.timeout(120_000),
  })
  const data = await res.json().catch(() => ({}))
  console.log(JSON.stringify({ ok: data.ok, verifyAfter: data.verifyAfter?.checks?.[0] }, null, 2))
}

console.log(`
Done.
  MEILI_HOST=${publicUrl}
  Docs: docs/MEILISEARCH_RAILWAY.md
`)
