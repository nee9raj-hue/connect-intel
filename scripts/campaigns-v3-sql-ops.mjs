#!/usr/bin/env node
/**
 * Deploy 12 ops — apply campaigns_v3 SQL (when creds exist) + production backfill.
 *
 *   npm run campaigns:sql-ops
 *   SUPABASE_DB_PASSWORD=... npm run campaigns:sql-ops
 *   npm run campaigns:sql-ops -- --org=ORG_ID
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyCampaignsV3Bootstrap } from '../lib/server/supabaseSqlApply.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRODUCTION_URL = 'https://connectintel.net'
const SQL_FILE = 'supabase/migrations/20260702140000_campaigns_v3_bootstrap.sql'
const orgArg = process.argv.find((a) => a.startsWith('--org='))?.split('=')[1]

function loadCronSecret() {
  for (const file of ['.env.deploy.local', '.env.vercel.production', '.env.production.local']) {
    if (!existsSync(join(ROOT, file))) continue
    for (const line of readFileSync(join(ROOT, file), 'utf8').split('\n')) {
      if (!line.startsWith('CRON_SECRET=')) continue
      let v = line.slice('CRON_SECRET='.length).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (v) return v
    }
  }
  return process.env.CRON_SECRET || null
}

async function postBootstrap(action, body = {}) {
  const secret = loadCronSecret()
  if (!secret) {
    console.error('Set CRON_SECRET or add it to .env.deploy.local')
    process.exit(1)
  }
  const url = `${PRODUCTION_URL}/api/infra/bootstrap?action=${encodeURIComponent(action)}`
  console.log(`POST ${url}`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  })
  const data = await res.json().catch(() => ({}))
  console.log(JSON.stringify(data, null, 2))
  return { res, data }
}

console.log('Connect Intel — Deploy 12 campaigns_v3 SQL ops\n')

if (process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_URL || process.env.SUPABASE_ACCESS_TOKEN) {
  console.log('Applying SQL locally…')
  const local = await applyCampaignsV3Bootstrap()
  console.log(JSON.stringify(local, null, 2))
  if (!local.applied) process.exit(1)
} else {
  console.log('No local DB creds — skipping local migrate (use SUPABASE_DB_PASSWORD or SUPABASE_ACCESS_TOKEN).\n')
}

const migrate = await postBootstrap('campaigns-v3-migrate')
const tablesOk = migrate.data?.tableProbe?.ok || migrate.data?.ok
if (!tablesOk) {
  console.error(`\nBlocked: ${SQL_FILE} must be run in Supabase SQL editor first.`)
  console.error(`https://supabase.com/dashboard/project/hkdrannqcnszfukcqchj/sql/new`)
  process.exit(1)
}

const syncAll = await postBootstrap('campaigns-v3-sync', {})
if (!syncAll.res.ok) process.exit(1)

if (orgArg) {
  const syncOrg = await postBootstrap('campaigns-v3-sync', { orgId: orgArg })
  if (!syncOrg.res.ok) process.exit(1)
}

console.log('\nDeploy 12 SQL ops complete.')
