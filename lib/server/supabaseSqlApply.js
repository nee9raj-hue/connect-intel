import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PIPELINE_TASKS_MEETINGS_BOOTSTRAP_SQL } from './migrations/pipelineTasksMeetingsBootstrap.js'
import { CAMPAIGNS_V3_BOOTSTRAP_SQL } from './migrations/campaignsV3Bootstrap.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')

const PROJECT_REF = 'hkdrannqcnszfukcqchj'

function parsePgHost(connectionString) {
  try {
    const normalized = String(connectionString).replace(/^postgresql:/, 'postgres:')
    return new URL(normalized).hostname
  } catch {
    return String(connectionString).match(/@([^:/]+)/)?.[1] || null
  }
}

function isUsablePgUrl(connectionString) {
  const raw = String(connectionString || '').trim()
  if (!raw) return false
  const host = parsePgHost(raw)
  if (!host || host === 'base') return false
  // Legacy direct host — no longer resolves on many Supabase projects.
  if (/^db\.[a-z0-9]+\.supabase\.co$/i.test(host)) return false
  return true
}

function buildPoolerConnectionString(password) {
  const poolerHost = process.env.SUPABASE_DB_HOST || 'aws-0-ap-south-1.pooler.supabase.com'
  const port = process.env.SUPABASE_DB_PORT || '5432'
  return `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(password)}@${poolerHost}:${port}/postgres`
}

/** Shared Postgres URL for migrations (pooler-first; skips broken DATABASE_URL hosts). */
export function buildPgConnectionString() {
  const dbUrl = String(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '').trim()
  if (isUsablePgUrl(dbUrl)) return dbUrl

  const password = String(process.env.SUPABASE_DB_PASSWORD || '').trim()
  if (password && process.env.SUPABASE_URL) {
    return buildPoolerConnectionString(password)
  }

  return dbUrl || null
}

async function applyViaPg(sql) {
  const connectionString = buildPgConnectionString()
  if (!connectionString) return { applied: false, reason: 'no_pg_connection' }

  let pg
  try {
    pg = await import('pg')
  } catch {
    return { applied: false, reason: 'pg_module_missing' }
  }

  const client = new pg.default.Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    await client.query(sql)
    return { applied: true, method: 'pg', host: parsePgHost(connectionString) }
  } catch (error) {
    return { applied: false, reason: 'pg_connect_error', error: error?.message || String(error) }
  } finally {
    await client.end().catch(() => {})
  }
}

async function applyViaManagementApi(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) return { applied: false, reason: 'no_supabase_access_token' }

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(120_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      applied: false,
      reason: 'management_api_error',
      status: res.status,
      detail: data?.message || data?.error || JSON.stringify(data).slice(0, 300),
    }
  }
  return { applied: true, method: 'management_api', result: data }
}

export async function applyPipelineTasksMeetingsBootstrap() {
  return applySupabaseSql(PIPELINE_TASKS_MEETINGS_BOOTSTRAP_SQL, {
    file: 'pipelineTasksMeetingsBootstrap',
  })
}

export async function applyCampaignsV3Bootstrap() {
  return applySupabaseSql(CAMPAIGNS_V3_BOOTSTRAP_SQL, {
    file: 'campaignsV3Bootstrap',
  })
}

export async function applySupabaseSqlFile(relativePath) {
  const sqlPath = join(ROOT, relativePath)
  const sql = readFileSync(sqlPath, 'utf8')
  return applySupabaseSql(sql, { file: relativePath })
}

export async function applySupabaseSql(sql, { file = null } = {}) {
  const viaPg = await applyViaPg(sql)
  if (viaPg.applied) return { ...viaPg, file }

  const viaApi = await applyViaManagementApi(sql)
  if (viaApi.applied) return { ...viaApi, file }

  return {
    applied: false,
    file,
    attempts: [viaPg, viaApi],
    hint: 'Set SUPABASE_DB_PASSWORD, DATABASE_URL, or SUPABASE_ACCESS_TOKEN — or run SQL in Supabase SQL editor.',
  }
}
