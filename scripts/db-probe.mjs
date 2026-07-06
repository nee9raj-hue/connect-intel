#!/usr/bin/env node
/**
 * Probe Supabase Postgres connectivity for migrations.
 *
 *   npm run db:probe
 *   SUPABASE_DB_PASSWORD=... npm run db:probe
 *
 * Loads .env.deploy.local / .env.vercel.production when present.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePgConnectionString } from '../lib/server/supabaseSqlApply.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

for (const file of ['.env.deploy.local', '.env.vercel.production', '.env.local']) {
  if (!existsSync(join(ROOT, file))) continue
  for (const line of readFileSync(join(ROOT, file), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m || process.env[m[1]]) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (v) process.env[m[1]] = v
  }
}

console.log('Connect Intel — database probe\n')

const hasCreds =
  process.env.SUPABASE_DB_PASSWORD ||
  process.env.DATABASE_URL ||
  process.env.DIRECT_URL ||
  process.env.SUPABASE_ACCESS_TOKEN

if (!hasCreds) {
  console.log('No DB creds in env. Set SUPABASE_DB_PASSWORD or DATABASE_URL (pooler host from Supabase dashboard).')
  console.log('Dashboard: https://supabase.com/dashboard/project/hkdrannqcnszfukcqchj/settings/database')
  process.exit(1)
}

const result = await resolvePgConnectionString()
if (result.connectionString && result.attempts?.some((a) => a.ok)) {
  const ok = result.attempts.find((a) => a.ok)
  console.log(`✓ Connected via ${ok.host}`)
  process.exit(0)
}

console.log('✗ Could not connect')
for (const row of result.attempts || []) {
  console.log(`  - ${row.host || '?'}: ${row.ok ? 'ok' : row.error}`)
}
console.log('\nTip: copy Session pooler host from Supabase → Settings → Database → Connection string.')
process.exit(1)
