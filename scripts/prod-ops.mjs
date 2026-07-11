#!/usr/bin/env node
/**
 * Post-deploy production ops — triggers Vercel crons on connectintel.net.
 *
 *   npm run prod:ops
 *   npm run prod:ops -- --name=Xindus
 *   npm run prod:ops -- --org=ORG_ID
 *   npm run prod:ops -- --dashboard
 *   npm run prod:ops -- --data-sync --name=Xindus
 *
 * Uses CRON_SECRET from env or .env.vercel.production (vercel env pull).
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRODUCTION_URL = 'https://connectintel.net'

const orgArg = process.argv.find((a) => a.startsWith('--org='))?.split('=')[1]
const nameArg = process.argv.find((a) => a.startsWith('--name='))?.split('=')[1]
const dashboard = process.argv.includes('--dashboard')
const dataSync = process.argv.includes('--data-sync')

const params = new URLSearchParams()
if (orgArg) params.set('orgId', orgArg)
if (nameArg) params.set('nameQuery', nameArg)

const path = dashboard
  ? '/api/crm/dashboard-warm-cron'
  : dataSync
    ? '/api/crm/data-sync-cron'
    : '/api/crm/meili-sync-cron'
const qs = params.toString()
const cronPath = qs ? `${path}?${qs}` : path

function loadCronSecret() {
  if (process.env.CRON_SECRET != null) return process.env.CRON_SECRET
  if (process.env.MARKETING_CRON_SECRET != null) return process.env.MARKETING_CRON_SECRET
  const envFile = join(ROOT, '.env.vercel.production')
  if (!existsSync(envFile)) return null
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    if (!line.startsWith('CRON_SECRET=')) continue
    const raw = line.slice('CRON_SECRET='.length).trim()
    if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1)
    if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1)
    return raw || null
  }
  return null
}

async function triggerViaHttp() {
  const secret = loadCronSecret()
  if (!secret) {
    const err = new Error('CRON_SECRET not available locally')
    err.noSecret = true
    throw err
  }
  const url = `${PRODUCTION_URL}${cronPath}`
  console.log(`POST ${url}\n`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(180_000),
  })
  const data = await res.json().catch(() => ({}))
  console.log(JSON.stringify(data, null, 2))
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`)
    err.response = data
    throw err
  }
}

console.log(`Triggering production cron: ${cronPath}\n`)

async function triggerViaVercelCron() {
  execSync(`vercel crons run "${cronPath}"`, { cwd: ROOT, stdio: 'inherit' })
  console.log('\nCron triggered. Check Vercel → connect-intel → Logs for results.')
}

if (qs) {
  try {
    await triggerViaHttp()
  } catch (err) {
    console.warn(`HTTP trigger failed (${err?.message || err}) — running full cron (all orgs, includes filter target).\n`)
    triggerViaVercelCron()
  }
  process.exit(0)
}

try {
  triggerViaVercelCron()
} catch {
  console.warn('vercel crons run failed — falling back to HTTP trigger.\n')
  try {
    await triggerViaHttp()
  } catch (err) {
    console.error(err?.message || err)
    process.exit(1)
  }
}
