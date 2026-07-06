#!/usr/bin/env node
/**
 * Apply pipeline_activities index migration via direct Postgres (if DATABASE_URL set).
 * Otherwise prints SQL for Supabase SQL editor.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPgConnectionString, resolvePgConnectionString } from '../lib/server/supabaseSqlApply.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const sqlPath = join(ROOT, 'supabase/migrations/20260617120000_pipeline_activities_indexes.sql')
const sql = readFileSync(sqlPath, 'utf8')

const resolved = await resolvePgConnectionString()
const connectionString = resolved.connectionString || buildPgConnectionString()

if (!connectionString) {
  console.log('No DATABASE_URL / SUPABASE_DB_PASSWORD — run this SQL in Supabase SQL editor:\n')
  console.log(sql)
  process.exit(0)
}

const pg = await import('pg')
const client = new pg.default.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query(sql)
  console.log('✓ Applied pipeline_activities index migration')
} finally {
  await client.end()
}
