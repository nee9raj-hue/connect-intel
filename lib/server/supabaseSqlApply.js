import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PIPELINE_TASKS_MEETINGS_BOOTSTRAP_SQL } from './migrations/pipelineTasksMeetingsBootstrap.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')

const PROJECT_REF = 'hkdrannqcnszfukcqchj'

function buildPgConnectionString() {
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (url) return url
  if (process.env.SUPABASE_DB_PASSWORD && process.env.SUPABASE_URL) {
    const host = new URL(process.env.SUPABASE_URL).hostname
    const projectRef = host.split('.')[0]
    return `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@db.${projectRef}.supabase.co:5432/postgres`
  }
  return null
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
  await client.connect()
  try {
    await client.query(sql)
    return { applied: true, method: 'pg' }
  } finally {
    await client.end()
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
