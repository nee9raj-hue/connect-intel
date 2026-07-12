import { resolvePgConnectionString } from './supabaseSqlApply.js'

let pgPool = null
let pgPoolConnectionString = null

function sslForConnectionString(connectionString) {
  return String(connectionString || '').includes('localhost') ||
    String(connectionString || '').includes('@postgres:')
    ? false
    : { rejectUnauthorized: false }
}

/** Shared pg pool for SQL migrations, store_collections, and platform postgres adapter. */
export async function getPgPool() {
  const resolved = await resolvePgConnectionString()
  const connectionString = resolved?.connectionString
  if (!connectionString) {
    throw new Error('Postgres requires DATABASE_URL or SUPABASE_DB_PASSWORD')
  }
  if (pgPool && pgPoolConnectionString === connectionString) return pgPool
  if (pgPool) {
    await pgPool.end().catch(() => {})
    pgPool = null
  }
  const pg = await import('pg')
  pgPool = new pg.default.Pool({
    connectionString,
    ssl: sslForConnectionString(connectionString),
    max: Number(process.env.PG_POOL_MAX) || 10,
  })
  pgPoolConnectionString = connectionString
  return pgPool
}

export async function queryPg(sql, params = []) {
  const pool = await getPgPool()
  const result = await pool.query(sql, params)
  return { rows: result.rows || [] }
}

export function resetPgPoolForTests() {
  if (pgPool) {
    pgPool.end().catch(() => {})
  }
  pgPool = null
  pgPoolConnectionString = null
}
