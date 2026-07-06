import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PIPELINE_TASKS_MEETINGS_BOOTSTRAP_SQL } from './migrations/pipelineTasksMeetingsBootstrap.js'
import { CAMPAIGNS_V3_BOOTSTRAP_SQL } from './migrations/campaignsV3Bootstrap.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')

export const SUPABASE_PROJECT_REF = 'hkdrannqcnszfukcqchj'
const POOLER_USER = `postgres.${SUPABASE_PROJECT_REF}`

const ENV_URL_KEYS = ['DIRECT_URL', 'DATABASE_URL', 'SUPABASE_DB_URL']

function parsePgUrl(connectionString) {
  const raw = String(connectionString || '').trim()
  if (!raw) return null
  try {
    const normalized = raw.replace(/^postgresql:/, 'postgres:')
    const url = new URL(normalized)
    return {
      hostname: url.hostname,
      port: url.port || '5432',
      username: decodeURIComponent(url.username || ''),
      password: decodeURIComponent(url.password || ''),
      raw,
    }
  } catch {
    return null
  }
}

export function parsePgHost(connectionString) {
  return parsePgUrl(connectionString)?.hostname || null
}

function isPoolerHost(host) {
  return /\.pooler\.supabase\.com$/i.test(String(host || ''))
}

function isBrokenPgHost(host) {
  if (!host || host === 'base') return true
  if (/^db\.[a-z0-9]+\.supabase\.co$/i.test(host)) return true
  return false
}

export function isUsablePgUrl(connectionString) {
  const parsed = parsePgUrl(connectionString)
  if (!parsed) return false
  return !isBrokenPgHost(parsed.hostname)
}

function migrationPort(port) {
  return String(port) === '6543' ? '5432' : String(port || '5432')
}

function poolerUser(username) {
  const user = String(username || '').trim()
  if (!user || user === 'postgres') return POOLER_USER
  if (user === `postgres.${SUPABASE_PROJECT_REF}`) return user
  if (user.startsWith('postgres.')) return user
  return POOLER_USER
}

function resolvePassword(passwordOverride) {
  const fromEnv = String(process.env.SUPABASE_DB_PASSWORD || '').trim()
  if (fromEnv) return fromEnv
  if (passwordOverride) return passwordOverride
  for (const key of ENV_URL_KEYS) {
    const parsed = parsePgUrl(process.env[key])
    if (parsed?.password) return parsed.password
  }
  return ''
}

/** Normalize any pooler URL for DDL migrations (session port 5432, pooler user). */
export function normalizePgUrlForMigration(connectionString, passwordOverride = '') {
  const parsed = parsePgUrl(connectionString)
  if (!parsed || isBrokenPgHost(parsed.hostname)) return null

  const password = resolvePassword(passwordOverride || parsed.password)
  if (!password) return null

  if (isPoolerHost(parsed.hostname)) {
    const port = migrationPort(parsed.port)
    const user = poolerUser(parsed.username)
    return `postgresql://${user}:${encodeURIComponent(password)}@${parsed.hostname}:${port}/postgres`
  }

  return parsed.raw
}

export function extractPoolerHostFromEnv() {
  if (process.env.SUPABASE_DB_HOST) {
    return {
      host: process.env.SUPABASE_DB_HOST,
      port: process.env.SUPABASE_DB_PORT || '5432',
    }
  }
  for (const key of ENV_URL_KEYS) {
    const parsed = parsePgUrl(process.env[key])
    if (parsed && isPoolerHost(parsed.hostname)) {
      return { host: parsed.hostname, port: migrationPort(parsed.port) }
    }
  }
  return null
}

export function buildPoolerConnectionString(password, { host, port = '5432' } = {}) {
  const poolerHost = host || process.env.SUPABASE_DB_HOST || 'aws-0-ap-south-1.pooler.supabase.com'
  const poolerPort = migrationPort(port || process.env.SUPABASE_DB_PORT || '5432')
  return `postgresql://${POOLER_USER}:${encodeURIComponent(password)}@${poolerHost}:${poolerPort}/postgres`
}

/** Sync Postgres URL for migrations (pooler session mode; skips broken direct hosts). */
export function buildPgConnectionString() {
  for (const key of ENV_URL_KEYS) {
    const raw = String(process.env[key] || '').trim()
    if (!raw) continue
    const normalized = normalizePgUrlForMigration(raw)
    if (normalized) return normalized
  }

  const password = resolvePassword()
  if (!password) return null

  const pooler = extractPoolerHostFromEnv()
  if (pooler?.host) return buildPoolerConnectionString(password, pooler)

  return buildPoolerConnectionString(password)
}

function poolerRegionHint() {
  const fromEnv = String(process.env.SUPABASE_REGION || '').trim()
  if (fromEnv) return fromEnv
  const pooler = extractPoolerHostFromEnv()
  const match = pooler?.host?.match(/\.([a-z0-9-]+)\.pooler\.supabase\.com$/i)
  if (match) return match[1]
  return 'ap-south-1'
}

function poolerProbeHosts(region) {
  const hosts = new Set()
  const pooler = extractPoolerHostFromEnv()
  if (pooler?.host) hosts.add(pooler.host)
  if (process.env.SUPABASE_DB_HOST) hosts.add(process.env.SUPABASE_DB_HOST)
  for (const cluster of [0, 1, 2]) {
    hosts.add(`aws-${cluster}-${region}.pooler.supabase.com`)
  }
  return [...hosts]
}

async function testPgConnection(connectionString) {
  let pg
  try {
    pg = await import('pg')
  } catch {
    return { ok: false, error: 'pg_module_missing' }
  }

  const client = new pg.default.Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    await client.query('select 1 as ok')
    return { ok: true, host: parsePgHost(connectionString) }
  } catch (error) {
    return { ok: false, host: parsePgHost(connectionString), error: error?.message || String(error) }
  } finally {
    await client.end().catch(() => {})
  }
}

export async function fetchPoolerFromManagementApi() {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) return null

  const res = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/database/pooler`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) return null

  const configs = await res.json().catch(() => [])
  const rows = Array.isArray(configs) ? configs : [configs]
  const session =
    rows.find((row) => row?.pool_mode === 'session') ||
    rows.find((row) => Number(row?.db_port) === 5432) ||
    rows[0]
  if (!session?.db_host) return null

  return {
    host: session.db_host,
    port: migrationPort(session.db_port),
    poolMode: session.pool_mode || null,
  }
}

/** Async resolver — probes pooler clusters when sync URL fails (fixes aws-0 vs aws-1). */
export async function resolvePgConnectionString() {
  const candidates = []
  const seen = new Set()

  const push = (cs) => {
    if (!cs || seen.has(cs)) return
    seen.add(cs)
    candidates.push(cs)
  }

  push(buildPgConnectionString())

  const password = resolvePassword()
  const fromApi = await fetchPoolerFromManagementApi()
  if (password && fromApi?.host) push(buildPoolerConnectionString(password, fromApi))

  if (password) {
    const region = poolerRegionHint()
    for (const host of poolerProbeHosts(region)) {
      push(buildPoolerConnectionString(password, { host, port: '5432' }))
    }
  }

  const attempts = []
  for (const cs of candidates) {
    const result = await testPgConnection(cs)
    attempts.push({ host: result.host, ok: result.ok, error: result.error })
    if (result.ok) return { connectionString: cs, host: result.host, attempts }
  }

  return {
    connectionString: candidates[0] || null,
    host: candidates[0] ? parsePgHost(candidates[0]) : null,
    attempts,
  }
}

async function applyViaPg(sql) {
  const resolved = await resolvePgConnectionString()
  const connectionString = resolved.connectionString
  if (!connectionString) return { applied: false, reason: 'no_pg_connection', attempts: resolved.attempts }

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
    return {
      applied: false,
      reason: 'pg_connect_error',
      host: parsePgHost(connectionString),
      error: error?.message || String(error),
      attempts: resolved.attempts,
    }
  } finally {
    await client.end().catch(() => {})
  }
}

async function applyViaManagementApi(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) return { applied: false, reason: 'no_supabase_access_token' }

  const res = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`, {
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
    hint: 'Set SUPABASE_DB_PASSWORD, DATABASE_URL (pooler host from Supabase dashboard), or SUPABASE_ACCESS_TOKEN — or run SQL in Supabase SQL editor.',
  }
}
