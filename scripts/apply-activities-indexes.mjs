#!/usr/bin/env node
/**
 * Apply pipeline_activities index migration via direct Postgres (if DATABASE_URL set).
 * Otherwise prints SQL for Supabase SQL editor.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const sqlPath = join(ROOT, 'supabase/migrations/20260617120000_pipeline_activities_indexes.sql')
const sql = readFileSync(sqlPath, 'utf8')

const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
let connectionString = url
if (!connectionString && process.env.SUPABASE_DB_PASSWORD && process.env.SUPABASE_URL) {
  const host = new URL(process.env.SUPABASE_URL).hostname
  const projectRef = host.split('.')[0]
  connectionString = `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@db.${projectRef}.supabase.co:5432/postgres`
}

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
