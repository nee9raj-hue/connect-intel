#!/usr/bin/env node
/**
 * Post-deploy production ops — runs on Vercel (secrets stay server-side).
 *
 *   npm run prod:ops
 *   npm run prod:ops -- --name=Xindus
 *   npm run prod:ops -- --org=ORG_ID
 *   npm run prod:ops -- --dashboard
 */

import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const orgArg = process.argv.find((a) => a.startsWith('--org='))?.split('=')[1]
const nameArg = process.argv.find((a) => a.startsWith('--name='))?.split('=')[1]
const dashboard = process.argv.includes('--dashboard')

const params = new URLSearchParams()
if (orgArg) params.set('orgId', orgArg)
if (nameArg) params.set('nameQuery', nameArg)
if (!dashboard && !orgArg && !nameArg) {
  /* full org sync */
}

const path = dashboard
  ? '/api/crm/dashboard-warm-cron'
  : '/api/crm/meili-sync-cron'

const qs = params.toString()
const cronPath = qs ? `${path}?${qs}` : path

console.log(`Triggering production cron: ${cronPath}\n`)

try {
  execSync(`vercel crons run "${cronPath}"`, { cwd: ROOT, stdio: 'inherit' })
  console.log('\nCron triggered. Check Vercel → connect-intel → Logs for results.')
} catch (err) {
  console.error('\nCron trigger failed. Deploy may still be propagating — retry in ~60s.')
  process.exit(err.status || 1)
}
