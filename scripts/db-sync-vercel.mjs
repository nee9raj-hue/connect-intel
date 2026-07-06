#!/usr/bin/env node
/**
 * Sync Supabase Postgres creds to Vercel production and probe pooler connectivity.
 *
 *   npm run db:sync-vercel -- <database-password>
 *   SUPABASE_DB_PASSWORD=... npm run db:sync-vercel
 *
 * Optional: SUPABASE_DB_HOST=aws-1-ap-south-1.pooler.supabase.com
 */

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePgConnectionString } from '../lib/server/supabaseSqlApply.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEPLOY_LOCAL = join(ROOT, '.env.deploy.local')
const PROJECT_REF = 'hkdrannqcnszfukcqchj'
const DEFAULT_HOST = 'aws-1-ap-south-1.pooler.supabase.com'

for (const file of ['.env.deploy.local', '.env.vercel.production', '.env.local']) {
  const path = join(ROOT, file)
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m || process.env[m[1]]) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (v) process.env[m[1]] = v
  }
}

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts })
}

function upsertDeployLocalLine(key, value) {
  let text = existsSync(DEPLOY_LOCAL) ? readFileSync(DEPLOY_LOCAL, 'utf8') : ''
  const line = `${key}=${value}`
  if (new RegExp(`^${key}=`, 'm').test(text)) {
    text = text.replace(new RegExp(`^${key}=.*$`, 'm'), line)
  } else {
    text = `${text.trimEnd()}\n${line}\n`
  }
  writeFileSync(DEPLOY_LOCAL, text)
}

function syncVercelEnvVar(key, value) {
  try {
    run(`vercel env rm ${key} production --yes`, { silent: true })
  } catch {
    /* may not exist */
  }
  const result = spawnSync(
    'sh',
    ['-c', `printf '%s' '${String(value).replace(/'/g, "'\\''")}' | vercel env add ${key} production`],
    { cwd: ROOT, stdio: 'inherit' }
  )
  if (result.status !== 0) throw new Error(`Failed to set Vercel env ${key}`)
}

const passwordArg = process.argv.slice(2).find((a) => !a.startsWith('-'))
const password = String(passwordArg || process.env.SUPABASE_DB_PASSWORD || '').trim()
const host = String(process.env.SUPABASE_DB_HOST || DEFAULT_HOST).trim()

if (!password) {
  console.error(`Usage: npm run db:sync-vercel -- <database-password>
Or: SUPABASE_DB_PASSWORD=... npm run db:sync-vercel

Reset password: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database`)
  process.exit(1)
}

console.log('Connect Intel — sync DB creds to Vercel\n')

process.env.SUPABASE_DB_PASSWORD = password
process.env.SUPABASE_DB_HOST = host

const poolerUrl = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(password)}@${host}:5432/postgres`

console.log(`Probing pooler ${host}…`)
const probe = await resolvePgConnectionString()
const okAttempt = probe.attempts?.find((a) => a.ok)
if (!okAttempt) {
  console.error('✗ Pooler probe failed')
  for (const row of probe.attempts || []) {
    console.error(`  - ${row.host || '?'}: ${row.error}`)
  }
  process.exit(1)
}

console.log(`✓ Connected via ${okAttempt.host}`)

console.log('Syncing Vercel production env…')
syncVercelEnvVar('SUPABASE_DB_PASSWORD', password)
syncVercelEnvVar('SUPABASE_DB_HOST', okAttempt.host || host)
syncVercelEnvVar('DATABASE_URL', poolerUrl.replace(`@${host}:`, `@${okAttempt.host || host}:`))

upsertDeployLocalLine('SUPABASE_DB_PASSWORD', password)
upsertDeployLocalLine('SUPABASE_DB_HOST', okAttempt.host || host)

console.log('\n✓ DB creds synced to Vercel + .env.deploy.local')
console.log('Redeploy production (vercel deploy --prod) then hit /api/infra/bootstrap?secret=CRON_SECRET')
