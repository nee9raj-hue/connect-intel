#!/usr/bin/env node
/**
 * Post-deploy production ops — triggers Vercel crons on connectintel.net.
 *
 *   npm run prod:ops
 *   npm run prod:ops -- --name=Xindus
 *   npm run prod:ops -- --org=ORG_ID
 *   npm run prod:ops -- --dashboard
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

const params = new URLSearchParams()
if (orgArg) params.set('orgId', orgArg)
if (nameArg) params.set('nameQuery', nameArg)

const path = dashboard ? '/api/crm/dashboard-warm-cron' : '/api/crm/meili-sync-cron'
const qs = params.toString()
const cronPath = qs ? `${path}?${qs}` : path

function loadCronSecret() {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET
  if (process.env.MARKETING_CRON_SECRET) return process.env.MARKETING_CRON_SECRET
  const envFile = join(ROOT, '.env.vercel.production')
  if (!existsSync(envFile)) return null
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^CRON_SECRET=(?:"([^"]*)"|'([^']*)'|(.+))$/)
    if (m) return (m[1] || m[2] || m[3] || '').trim()
  }
  return null
}

async function triggerViaHttp() {
  const secret = loadCronSecret()
  if (!secret) {
    console.error('Set CRON_SECRET or run: vercel env pull .env.vercel.production --environment=production')
    process.exit(1)
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
  if (!res.ok) process.exit(1)
}

console.log(`Triggering production cron: ${cronPath}\n`)

if (qs) {
  await triggerViaHttp()
  process.exit(0)
}

try {
  execSync(`vercel crons run "${path}"`, { cwd: ROOT, stdio: 'inherit' })
  console.log('\nCron triggered. Check Vercel → connect-intel → Logs for results.')
} catch {
  console.warn('vercel crons run failed — falling back to HTTP trigger.\n')
  await triggerViaHttp()
}
